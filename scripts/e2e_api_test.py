"""End-to-end API test for Mohemah (run against a fresh local DB).
Usage: python3 scripts/e2e_api_test.py http://127.0.0.1:8788
"""
import json, sys, urllib.request, uuid

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8788"
ok_count = 0

def call(method, path, body=None, token=None, form=None, expect=None):
    global ok_count
    headers = {}
    data = None
    if token: headers["authorization"] = f"Bearer {token}"
    if form is not None:
        boundary = uuid.uuid4().hex
        parts = []
        for k, v in form.items():
            if isinstance(v, tuple):
                fname, ctype, content = v
                parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"; filename="{fname}"\r\nContent-Type: {ctype}\r\n\r\n'.encode() + content + b"\r\n")
            else:
                parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
        data = b"".join(parts) + f"--{boundary}--\r\n".encode()
        headers["content-type"] = f"multipart/form-data; boundary={boundary}"
    elif body is not None:
        data = json.dumps(body).encode()
        headers["content-type"] = "application/json"
    for attempt in range(3):
        req = urllib.request.Request(BASE + path, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                status, raw = r.status, r.read()
        except urllib.error.HTTPError as e:
            status, raw = e.code, e.read()
        # Local `wrangler dev` sometimes restarts the isolate mid-request; retry like the platform would.
        if not (status == 503 and b"restarted mid-request" in raw):
            break
    try: payload = json.loads(raw)
    except Exception: payload = raw
    if expect is not None:
        exp = expect if isinstance(expect, (list, tuple)) else [expect]
        assert status in exp, f"{method} {path}: expected {expect}, got {status}: {payload}"
        ok_count += 1
    return status, payload

def check(cond, msg):
    global ok_count
    assert cond, msg
    ok_count += 1

PNG = bytes.fromhex("89504e470d0a1a0a0000000d4948445200000001000000010806000000" "1f15c4890000000d49444154789c6300010000050001" "0d0a2db40000000049454e44ae426082")
PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"

# 1. owner setup
_, st = call("GET", "/api/setup/status", expect=200)
check(st["needs_admin"] is True, "fresh db needs admin")
_, r = call("POST", "/api/setup/admin", {"password": "Admin@12345", "full_name": "عبدالله الحربي"}, expect=201)
call("POST", "/api/setup/admin", {"password": "Another@123"}, expect=409)
_, r = call("POST", "/api/auth/login", {"identifier": "admin", "password": "Admin@12345", "app": "admin"}, expect=200)
ADMIN = r["token"]
check("admin" in r["roles"], "admin role")

# 2. services
call("POST", "/api/admin/services/suggested", {"list": [
    {"name": "السباكة", "icon": "Droplets", "color": "blue", "coinPrice": 5, "description": "سباكة", "subs": [
        {"name": "كشف التسربات", "icon": "Droplets", "deliveryMode": "in_person", "coinPrice": 6, "description": ""},
        {"name": "استشارة سباكة", "icon": "Headset", "deliveryMode": "remote", "coinPrice": 2, "description": ""}]},
    {"name": "الكهرباء", "icon": "Zap", "color": "gold", "coinPrice": 5, "description": "كهرباء", "subs": [
        {"name": "تركيب الإنارة", "icon": "Lightbulb", "deliveryMode": "in_person", "coinPrice": None, "description": ""}]},
]}, token=ADMIN, expect=200)
_, boot = call("GET", "/api/public/bootstrap", expect=200)
svc = {s["name"]: s["id"] for s in boot["services"]}
sub = {s["name"]: s for s in boot["sub_services"]}
check(len(svc) == 2 and len(sub) == 3, "services seeded")
check(sub["تركيب الإنارة"]["coin_price"] == 5, "sub price falls back to parent price")

# 3. customer registration (customer app)
_, r = call("POST", "/api/auth/register/customer", {"full_name": "خالد المطيري", "phone": "0551112233", "email": "khaled@test.sa", "password": "Pass@1234", "region": "بريدة"}, expect=201)
CUST = r["token"]
check(r["roles"] == ["customer"], "customer role only")
call("POST", "/api/auth/register/customer", {"full_name": "x y", "phone": "0551112233", "email": "khaled@test.sa", "password": "Pass@1234"}, expect=409)
call("POST", "/api/auth/register/customer", {"full_name": "x y", "phone": "123", "email": "a@b.sa", "password": "Pass@1234"}, expect=400)

# 4. provider registration (provider app) with documents
form = {"full_name": "فهد عبدالله الزهراني", "national_id": "1234567890", "phone": "0559998877", "nationality": "سعودي", "gender": "male",
        "region": "بريدة", "email": "fahad@test.sa", "password": "Pass@1234", "services": json.dumps([svc["السباكة"]]),
        "id_file": ("id.png", "image/png", PNG), "cert_file": ("cert.pdf", "application/pdf", PDF)}
_, r = call("POST", "/api/auth/register/provider", form=form, expect=201)
PROV = r["token"]
check(r["profile"]["verification_status"] == "pending" and "provider" not in r["roles"], "provider pending, no role yet")
call("GET", "/api/provider/feed", token=PROV, expect=403)
bad = dict(form, email="x2@test.sa", id_file=("id.exe", "application/x-msdownload", b"MZ"))
call("POST", "/api/auth/register/provider", form=bad, expect=400)

# 5. security: customer can't act as provider or admin; tokens are app-scoped
call("GET", "/api/provider/feed", token=CUST, expect=403)
call("GET", "/api/admin/users", token=CUST, expect=403)
call("GET", "/api/admin/users", token=PROV, expect=403)
call("POST", "/api/auth/login", {"identifier": "khaled@test.sa", "password": "Pass@1234", "app": "admin"}, expect=403)
call("POST", "/api/auth/login", {"identifier": "khaled@test.sa", "password": "wrong", "app": "customer"}, expect=401)

# 6. admin reviews the application and opens the document via signed URL
_, apps = call("GET", "/api/admin/applications?status=pending", token=ADMIN, expect=200)
pid = apps[0]["id"]
_, docs = call("GET", f"/api/admin/applications/{pid}/documents", token=ADMIN, expect=200)
check(len(docs) == 2, "two documents")
doc_path = docs[0]["url"].replace(BASE, "")
call("GET", doc_path, expect=200)
call("GET", doc_path[:-3] + "AAA", expect=403)
call("POST", f"/api/admin/applications/{pid}/review", {"approve": False}, token=ADMIN, expect=400)
call("POST", f"/api/admin/applications/{pid}/review", {"approve": True}, token=ADMIN, expect=200)
_, me = call("GET", "/api/auth/me", token=PROV, expect=200)
check("provider" in me["roles"], "provider approved")
call("POST", "/api/provider/online", {"online": True}, token=PROV, expect=200)

# 7. customer creates an order; client-sent cost is ignored
_, o1 = call("POST", "/api/orders", {"sub_service_id": sub["كشف التسربات"]["id"], "mode": "in_person", "description": "تسريب تحت المغسلة", "region": "بريدة", "address": "حي الصفراء", "coin_cost": 0}, token=CUST, expect=201)
call("POST", "/api/orders", {"sub_service_id": sub["كشف التسربات"]["id"], "mode": "remote", "description": "تسريب تحت المغسلة", "region": "بريدة"}, token=CUST, expect=400)
call("POST", "/api/orders", {"sub_service_id": sub["كشف التسربات"]["id"], "mode": "in_person", "description": "تسريب", "region": "بريدة", "address": "x"}, token=PROV, expect=403)
_, feed = call("GET", "/api/provider/feed", token=PROV, expect=200)
check(len(feed["available"]) == 1 and feed["available"][0]["coin_cost"] == 6, "server computed cost 6")
check("address" not in feed["available"][0], "address hidden before acceptance")

# 8. accept needs coins; test top-up then accept
s, r = call("POST", f"/api/orders/{o1['id']}/accept", token=PROV, expect=402)
check(r["error"] == "insufficient_balance", "insufficient balance")
call("POST", "/api/provider/topup", {"coins": 10, "gateway_id": "gw-mada"}, token=PROV, expect=200)
_, r = call("POST", f"/api/orders/{o1['id']}/accept", token=PROV, expect=200)
check(r["balance"] == 4 and r["mode"] == "coins", "6 coins deducted")
call("POST", f"/api/orders/{o1['id']}/accept", token=PROV, expect=409)

# 9. customer sees the provider; notifications; chat
_, mine = call("GET", "/api/orders/mine", token=CUST, expect=200)
check(mine[0]["status"] == "accepted" and mine[0]["provider"]["phone"] == "+966559998877", "customer sees provider contact")
_, notes = call("GET", "/api/me/notifications", token=CUST, expect=200)
check(any(n["title"] == "تم قبول طلبك" for n in notes), "acceptance notification")
call("POST", f"/api/orders/{o1['id']}/messages", {"body": "السلام عليكم، متى تصل؟"}, token=CUST, expect=201)
call("POST", f"/api/orders/{o1['id']}/messages", {"body": "خلال 20 دقيقة"}, token=PROV, expect=201)
_, msgs = call("GET", f"/api/orders/{o1['id']}/messages", token=CUST, expect=200)
check(len(msgs) == 2, "chat both ways")

# 10. job progress → completed; ratings both ways
for want in ["arrived", "in_progress", "completed"]:
    _, r = call("POST", f"/api/orders/{o1['id']}/advance", token=PROV, expect=200)
    check(r["status"] == want, f"advance to {want}")
call("POST", f"/api/orders/{o1['id']}/advance", token=PROV, expect=409)
call("POST", f"/api/orders/{o1['id']}/rate", {"rating": 1}, token=CUST, expect=400)
call("POST", f"/api/orders/{o1['id']}/rate", {"rating": 5, "review": "ممتاز"}, token=CUST, expect=200)
call("POST", f"/api/orders/{o1['id']}/rate", {"rating": 4}, token=CUST, expect=409)
call("POST", f"/api/orders/{o1['id']}/rate-customer", {"rating": 5}, token=PROV, expect=200)
_, me = call("GET", "/api/auth/me", token=PROV, expect=200)
check(me["profile"]["rating"] == 5, "provider rating recomputed")

# 11. cancel after acceptance refunds the provider
_, o2 = call("POST", "/api/orders", {"sub_service_id": sub["استشارة سباكة"]["id"], "mode": "remote", "description": "استشارة قبل الشراء", "region": "بريدة"}, token=CUST, expect=201)
_, r = call("POST", f"/api/orders/{o2['id']}/accept", token=PROV, expect=200)
check(r["balance"] == 2, "2 coins deducted")
call("POST", f"/api/orders/{o2['id']}/cancel", {"reason": "تغيّرت الخطة"}, token=CUST, expect=200)
_, me = call("GET", "/api/auth/me", token=PROV, expect=200)
check(me["profile"]["coin_balance"] == 4, "refund applied")

# 12. subscription gift → free acceptance
call("POST", "/api/admin/grant", {"kind": "subscription", "days": 7}, token=ADMIN, expect=409)
call("PUT", "/api/admin/settings", {"billing_subscription_enabled": True}, token=ADMIN, expect=200)
_, r = call("POST", "/api/admin/grant", {"kind": "subscription", "days": 7, "provider_id": pid, "note": "تجربة"}, token=ADMIN, expect=200)
check(r["count"] == 1, "granted to one")
_, o3 = call("POST", "/api/orders", {"sub_service_id": sub["كشف التسربات"]["id"], "mode": "in_person", "description": "تسريب في الحمام", "region": "بريدة", "address": "حي الريان"}, token=CUST, expect=201)
_, r = call("POST", f"/api/orders/{o3['id']}/accept", token=PROV, expect=200)
check(r["mode"] == "subscription" and r["balance"] == 4, "subscription covers order")
_, o4 = call("POST", "/api/orders", {"sub_service_id": sub["استشارة سباكة"]["id"], "mode": "remote", "description": "استشارة ثانية", "region": "بريدة"}, token=CUST, expect=201)
call("POST", f"/api/orders/{o4['id']}/accept", token=PROV, expect=409)  # busy with in-person job
call("POST", f"/api/orders/{o3['id']}/release", {"reason": "ظرف طارئ"}, token=PROV, expect=200)
_, feed = call("GET", "/api/provider/feed", token=PROV, expect=200)
check(all(x["id"] != o3["id"] for x in feed["available"]), "released order hidden from same provider")

# 13. electricity order is invisible to a plumbing-only provider
_, o5 = call("POST", "/api/orders", {"sub_service_id": sub["تركيب الإنارة"]["id"], "mode": "in_person", "description": "ثريا الصالة", "region": "بريدة", "address": "حي النخيل"}, token=CUST, expect=201)
_, feed = call("GET", "/api/provider/feed", token=PROV, expect=200)
check(all(x["id"] != o5["id"] for x in feed["available"]), "service matching")
call("POST", f"/api/orders/{o5['id']}/accept", token=PROV, expect=403)

# 14. provider reports, admin reports
for p in ["/api/provider/stats", "/api/provider/history", "/api/provider/transactions", "/api/provider/ratings", "/api/provider/billing"]:
    call("GET", p, token=PROV, expect=200)
for p in ["/api/admin/users", "/api/admin/transactions", "/api/admin/orders", "/api/admin/notifications", "/api/admin/messages", "/api/admin/settings", "/api/admin/gateways"]:
    call("GET", p, token=ADMIN, expect=200)
_, stats = call("GET", "/api/provider/stats", token=PROV, expect=200)
check(stats["completed"] == 1 and stats["rating"] == 5, "stats")

# 15. favorites, addresses, profile
call("PUT", "/api/me/favorites", {"ids": [sub["كشف التسربات"]["id"], "bogus"]}, token=CUST, expect=200)
_, fav = call("GET", "/api/me/favorites", token=CUST, expect=200)
check(fav == [sub["كشف التسربات"]["id"]], "favorites saved")
call("POST", "/api/me/addresses", {"label": "المنزل", "address": "بريدة - الصفراء", "region": "بريدة", "lat": 26.33, "lng": 43.97}, token=CUST, expect=201)
_, addrs = call("GET", "/api/me/addresses", token=CUST, expect=200)
check(addrs[0]["is_default"] == 1, "first address default")
call("PATCH", "/api/me", {"full_name": "خالد سعد المطيري"}, token=CUST, expect=200)

# 16. staff account + suspension + account deletion
call("POST", "/api/admin/staff", {"full_name": "موظف دعم", "login": "support1", "password": "Staff@1234"}, token=ADMIN, expect=201)
_, r = call("POST", "/api/auth/login", {"identifier": "support1", "password": "Staff@1234", "app": "admin"}, expect=200)
STAFF = r["token"]
call("PUT", "/api/admin/settings", {"app_name": "x"}, token=STAFF, expect=403)
_, r = call("POST", "/api/auth/register/customer", {"full_name": "حساب مؤقت", "phone": "0550000001", "email": "tmp@test.sa", "password": "Pass@1234", "region": "الرياض"}, expect=201)
TMP = r["token"]
call("POST", "/api/me/delete", {"password": "wrong"}, token=TMP, expect=400)
call("POST", "/api/me/delete", {"password": "Pass@1234"}, token=TMP, expect=200)
call("GET", "/api/me/addresses", token=TMP, expect=401)
_, users = call("GET", "/api/admin/users", token=ADMIN, expect=200)
cid = [u for u in users if u["email"] == "khaled@test.sa"][0]["id"]
call("PATCH", f"/api/admin/users/{cid}", {"is_active": False}, token=ADMIN, expect=200)
call("GET", "/api/orders/mine", token=CUST, expect=401)
call("POST", "/api/auth/login", {"identifier": "khaled@test.sa", "password": "Pass@1234", "app": "customer"}, expect=403)

print(f"ALL PASSED: {ok_count} checks")
