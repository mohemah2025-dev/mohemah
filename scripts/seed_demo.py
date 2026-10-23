"""Seeds a local database with realistic demo data for review (NOT for production).
Usage: python3 scripts/seed_demo.py http://127.0.0.1:5173  → prints the demo tokens as JSON
"""
import json, sys, uuid, urllib.request
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5173"

def call(method, path, body=None, token=None, form=None):
    headers, data = {}, None
    if token: headers["authorization"] = f"Bearer {token}"
    if form is not None:
        b = uuid.uuid4().hex; parts = []
        for k, v in form.items():
            if isinstance(v, tuple):
                parts.append(f'--{b}\r\nContent-Disposition: form-data; name="{k}"; filename="{v[0]}"\r\nContent-Type: {v[1]}\r\n\r\n'.encode() + v[2] + b"\r\n")
            else:
                parts.append(f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
        data = b"".join(parts) + f"--{b}--\r\n".encode(); headers["content-type"] = f"multipart/form-data; boundary={b}"
    elif body is not None:
        data = json.dumps(body).encode(); headers["content-type"] = "application/json"
    req = urllib.request.Request(BASE + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req) as r: return json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        raise SystemExit(f"{method} {path} -> {e.code} {e.read().decode()}")

PNG = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63000100000500010d0a2db40000000049454e44ae426082")
PDF = b"%PDF-1.4\n%%EOF"
S = lambda name, icon, mode, price, desc="": {"name": name, "icon": icon, "deliveryMode": mode, "coinPrice": price, "description": desc}
SERVICES = [
  {"name": "السباكة", "icon": "Droplets", "color": "blue", "coinPrice": 5, "description": "إصلاح وتركيب جميع أعمال السباكة المنزلية والتجارية.", "subs": [S("كشف التسربات", "Droplets", "in_person", 6), S("تركيب الأدوات الصحية", "Wrench", "in_person", 5), S("تسليك المجاري", "Wrench", "in_person", 5), S("استشارة سباكة", "Headset", "remote", 2)]},
  {"name": "الكهرباء", "icon": "Zap", "color": "gold", "coinPrice": 5, "description": "أعمال الكهرباء والتمديدات والإنارة بأعلى معايير السلامة.", "subs": [S("تمديدات كهربائية", "Plug", "in_person", 6), S("تركيب الإنارة", "Lightbulb", "in_person", 4), S("صيانة اللوحات والقواطع", "Zap", "in_person", 6)]},
  {"name": "التكييف", "icon": "AirVent", "color": "teal", "coinPrice": 6, "description": "تركيب وصيانة وتنظيف أجهزة التكييف.", "subs": [S("تنظيف المكيفات", "Sparkles", "in_person", 5), S("تعبئة الفريون", "AirVent", "in_person", 6), S("تركيب المكيفات", "Wrench", "in_person", 7)]},
  {"name": "الصيانة", "icon": "Hammer", "color": "graphite", "coinPrice": 5, "description": "دهانات ونجارة وتشطيبات بلمسة احترافية.", "subs": [S("دهانات", "Paintbrush", "in_person", 6), S("نجارة", "Hammer", "in_person", 5), S("تركيب الأثاث", "Sofa", "in_person", 4)]},
  {"name": "التعليم", "icon": "GraduationCap", "color": "emerald", "coinPrice": 4, "description": "معلمون متخصصون لجميع المراحل الدراسية.", "subs": [S("رياضيات", "Calculator", "both", 4), S("لغة إنجليزية", "Languages", "both", 4)]},
  {"name": "الخدمات الإدارية", "icon": "BriefcaseBusiness", "color": "ruby", "coinPrice": 5, "description": "خدمات إدارية وقانونية ومحاسبية.", "subs": [S("إعداد السير الذاتية", "FileText", "remote", 3), S("خدمات تعقيب", "ClipboardList", "in_person", 5)]},
]

if call("GET", "/api/setup/status")["needs_admin"]:
    call("POST", "/api/setup/admin", {"password": "Admin@12345", "full_name": "عبدالله الحربي"})
ADMIN = call("POST", "/api/auth/login", {"identifier": "admin", "password": "Admin@12345", "app": "admin"})["token"]
call("POST", "/api/admin/services/suggested", {"list": SERVICES}, ADMIN)
call("PUT", "/api/admin/settings", {"billing_subscription_enabled": True}, ADMIN)
call("POST", "/api/admin/ads", {"sponsor": "مهمة", "title": "أول طلب صيانة؟ مقدمو خدمة موثقون في مدينتك", "start_date": "2026-01-01", "end_date": "2027-12-31", "placement": "top_banner", "active": True}, ADMIN)
boot = call("GET", "/api/public/bootstrap")
svc = {s["name"]: s["id"] for s in boot["services"]}
sub = {s["name"]: s["id"] for s in boot["sub_services"]}

def customer(name, phone, email, region):
    return call("POST", "/api/auth/register/customer", {"full_name": name, "phone": phone, "email": email, "password": "Pass@1234", "region": region})["token"]
def provider(name, nid, phone, email, services, region="بريدة"):
    form = {"full_name": name, "national_id": nid, "phone": phone, "nationality": "سعودي", "gender": "male", "region": region, "email": email, "password": "Pass@1234",
            "services": json.dumps([svc[s] for s in services]), "id_file": ("id.png", "image/png", PNG), "cert_file": ("cert.pdf", "application/pdf", PDF)}
    r = call("POST", "/api/auth/register/provider", form=form)
    return r["token"], r["profile"]["id"]

C1 = customer("خالد سعد المطيري", "0551112233", "khaled@demo.sa", "بريدة")
C2 = customer("نورة عبدالرحمن", "0552223344", "noura@demo.sa", "بريدة")
call("POST", "/api/me/addresses", {"label": "المنزل", "address": "حي الصفراء - شارع الأمير سلطان", "region": "بريدة", "lat": 26.3381, "lng": 43.9682}, C1)
call("POST", "/api/me/addresses", {"label": "العمل", "address": "حي النخيل - طريق الملك عبدالعزيز", "region": "بريدة"}, C1)
call("PUT", "/api/me/favorites", {"ids": [sub["كشف التسربات"], sub["تنظيف المكيفات"], sub["تركيب الإنارة"]]}, C1)

P1, p1 = provider("فهد عبدالله الزهراني", "1234567890", "0559998877", "fahad@demo.sa", ["السباكة", "التكييف"])
P2, p2 = provider("سعد محمد الدوسري", "1098765432", "0557776655", "saad@demo.sa", ["الكهرباء"])
P3, p3 = provider("ماجد علي القحطاني", "2123456789", "0556665544", "majed@demo.sa", ["الصيانة"])  # stays pending
for pid in (p1, p2):
    call("POST", f"/api/admin/applications/{pid}/review", {"approve": True}, ADMIN)
call("POST", "/api/admin/grant", {"kind": "coins", "coins": 40, "provider_id": p1, "note": "رصيد ترحيبي"}, ADMIN)
call("POST", "/api/admin/grant", {"kind": "coins", "coins": 20, "provider_id": p2, "note": "رصيد ترحيبي"}, ADMIN)

def order(token, sub_name, mode, desc, address=None, region="بريدة"):
    return call("POST", "/api/orders", {"sub_service_id": sub[sub_name], "mode": mode, "description": desc, "region": region, "address": address, "lat": 26.34 if address else None, "lng": 43.97 if address else None}, token)["id"]

# completed + rated history for the plumber
for desc, stars, review in [("تسريب تحت مغسلة المطبخ", 5, "سريع ومحترف"), ("تغيير خلاط الحمام", 4, None)]:
    oid = order(C2, "تركيب الأدوات الصحية" if "خلاط" in desc else "كشف التسربات", "in_person", desc, "حي الريان")
    call("POST", f"/api/orders/{oid}/accept", None, P1)
    for _ in range(3): call("POST", f"/api/orders/{oid}/advance", None, P1)
    call("POST", f"/api/orders/{oid}/rate", {"rating": stars, "review": review}, C2)
oid = order(C1, "تنظيف المكيفات", "in_person", "تنظيف 3 مكيفات سبليت في الصالة والغرف", "حي الصفراء - شارع الأمير سلطان")
call("POST", f"/api/orders/{oid}/accept", None, P1)
call("POST", f"/api/orders/{oid}/advance", None, P1)
call("POST", f"/api/orders/{oid}/messages", {"body": "السلام عليكم، الباب الخلفي مفتوح"}, C1)
call("POST", f"/api/orders/{oid}/messages", {"body": "وعليكم السلام، وصلت الآن"}, P1)
order(C1, "كشف التسربات", "in_person", "صوت ماء مستمر داخل الجدار بجانب الحمام", "حي النخيل - طريق الملك عبدالعزيز")
order(C2, "استشارة سباكة", "remote", "أحتاج رأي قبل شراء سخان جديد")
order(C1, "تركيب الإنارة", "in_person", "تركيب ثريا في المجلس وإنارة مخفية", "حي الصفراء - شارع الأمير سلطان")
call("POST", "/api/provider/online", {"online": True}, P2)
call("POST", "/api/admin/notifications", {"title": "أهلاً بكم في النسخة التجريبية", "body": "شاركونا ملاحظاتكم لتحسين التطبيق", "audience": "all", "category": "general"}, ADMIN)
print(json.dumps({"admin": ADMIN, "customer": C1, "provider": P1, "provider_pending": P3}))
