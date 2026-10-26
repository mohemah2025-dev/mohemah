import { audienceUserIds } from "../lib/push";
import {
  addDays, all, bool, fail, first, inList, json, normalizePhone, now, num, oneOf, readJson, REGIONS, run, stmt, str, strArray,
  uid, validEmail, validSaudiPhone, type Ctx, type Router,
} from "../lib/core";
import { ADMIN_SECTIONS, hashPassword, parsePermissions, permissionsOf, requireAdmin, requirePerm, requireUser, signFileUrl, validatePassword } from "../lib/auth";
import { getSettings, notifyStmts, safeJson } from "../lib/domain";
import { formFile, savePublicImage } from "./account";
import { EMAIL_PROVIDERS, notifyExternal, SMS_PROVIDERS, testEmail, testSms, testWhatsApp } from "../lib/messaging";

const ICON_RE = /^[A-Za-z0-9]{1,40}$/;
const COLORS = ["blue", "emerald", "gold", "ruby", "teal", "graphite"] as const;

function serviceFields(b: Record<string, unknown>, partial: boolean) {
  const f: Record<string, unknown> = {};
  const name = str(b, "name", { required: !partial, max: 100, label: "اسم الخدمة" });
  if (name !== null) f.name = name;
  const description = str(b, "description", { max: 500 });
  if (b.description !== undefined) f.description = description;
  const icon = str(b, "icon", { max: 40 });
  if (icon !== null) { if (!ICON_RE.test(icon)) fail(400, "invalid_icon", "أيقونة غير صالحة"); f.icon = icon; }
  const color = oneOf(b, "color", COLORS);
  if (color) f.color = color;
  const price = num(b, "coin_price", { min: 0, max: 100000, int: true, label: "سعر الكوينز" });
  if (price !== null) f.coin_price = price;
  const active = bool(b, "active");
  if (active !== null) f.active = active ? 1 : 0;
  const sort = num(b, "sort_order", { int: true, min: 0, max: 100000 });
  if (sort !== null) f.sort_order = sort;
  return f;
}

function subFields(b: Record<string, unknown>, partial: boolean) {
  const f = serviceFields(b, partial);
  if (b.coin_price === null) f.coin_price = null;
  if (b.details !== undefined) f.details = str(b, "details", { max: 2000 });
  if (b.estimated_duration !== undefined) f.estimated_duration = str(b, "estimated_duration", { max: 60 });
  const rp = bool(b, "requires_photos");
  if (rp !== null) f.requires_photos = rp ? 1 : 0;
  const dm = oneOf(b, "delivery_mode", ["in_person", "remote", "both"] as const);
  if (dm) f.delivery_mode = dm;
  const sid = str(b, "service_id", { max: 64 });
  if (sid) f.service_id = sid;
  return f;
}

function updateSql(table: string, f: Record<string, unknown>) {
  const keys = Object.keys(f);
  return { sql: `UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(", ")}${table === "payment_gateways" ? "" : ", updated_at = ?"} WHERE id = ?`, vals: keys.map((k) => f[k]) };
}

async function patchRow(c: Ctx, table: string, id: string, f: Record<string, unknown>) {
  if (!Object.keys(f).length) return;
  const { sql, vals } = updateSql(table, f);
  const res = table === "payment_gateways" ? await run(c.env.DB, sql, ...vals, id) : await run(c.env.DB, sql, ...vals, now(), id);
  if (!res.meta.changes) fail(404, "not_found", "العنصر غير موجود");
}

/** "moyasar" and "tap" are real gateways; anything else is a simulated (test-only) payment method. */
function gatewayKey(v: string | null) {
  const k = (v ?? "custom").toLowerCase();
  return /^[a-z0-9_-]{2,30}$/.test(k) ? k : "custom";
}

/** Changing an owner/staff account needs the staff permission (and an owner for owner accounts). */
async function guardAdminTarget(c: Ctx, id: string) {
  const roles = (await all<{ role: string }>(c.env.DB, "SELECT role FROM user_roles WHERE user_id = ?", id)).map((r) => r.role);
  if (roles.includes("admin")) await requireUser(c, { app: "admin", roles: ["admin"] });
  else if (roles.includes("staff")) await requirePerm(c, "staff", "edit");
}

export function registerAdminRoutes(r: Router) {
  /* ---------- Users ---------- */
  r.get("/api/admin/users", async (c) => {
    await requirePerm(c, ["customers", "providers", "staff", "dashboard", "billing", "finance"], "view");
    const [users, roles, provSvcs, orderStats] = await Promise.all([
      all<Record<string, unknown> & { id: string }>(c.env.DB,
        `SELECT id, full_name, email, username, phone, region, gender, rating, rating_count, coin_balance, is_active, is_online,
                verification_status, admin_permissions, created_at, updated_at, last_seen_at FROM users ORDER BY created_at DESC LIMIT 5000`),
      all<{ user_id: string; role: string }>(c.env.DB, "SELECT user_id, role FROM user_roles"),
      all<{ provider_id: string; name: string }>(c.env.DB, "SELECT ps.provider_id, s.name FROM provider_services ps JOIN services s ON s.id = ps.service_id"),
      all<{ customer_id: string; service_name: string; n: number }>(c.env.DB, "SELECT customer_id, service_name, COUNT(*) AS n FROM orders WHERE customer_id IS NOT NULL GROUP BY customer_id, service_name"),
    ]);
    const rolesBy: Record<string, string[]> = {};
    roles.forEach((x) => (rolesBy[x.user_id] ||= []).push(x.role));
    const svcBy: Record<string, string[]> = {};
    provSvcs.forEach((x) => (svcBy[x.provider_id] ||= []).push(x.name));
    const ordersBy: Record<string, { total: number; fav: string; favN: number }> = {};
    orderStats.forEach((x) => {
      const o = (ordersBy[x.customer_id] ||= { total: 0, fav: "", favN: 0 });
      o.total += x.n;
      if (x.n > o.favN) { o.fav = x.service_name; o.favN = x.n; }
    });
    return json(users.map((u) => ({
      ...u, permissions: (rolesBy[u.id] ?? []).includes("staff") && !(rolesBy[u.id] ?? []).includes("admin") ? parsePermissions(u.admin_permissions) : null,
      admin_permissions: undefined, is_active: !!u.is_active, is_online: !!u.is_online, roles: rolesBy[u.id] ?? [], services: svcBy[u.id] ?? [],
      orders_count: ordersBy[u.id]?.total ?? 0, favorite_service: ordersBy[u.id]?.fav || null,
    })));
  });

  r.patch("/api/admin/users/:id", async (c) => {
    const admin = await requirePerm(c, ["customers", "providers", "staff"], "edit");
    const id = c.params.id;
    const target = await first<{ coin_balance: number }>(c.env.DB, "SELECT coin_balance FROM users WHERE id = ?", id);
    if (!target) fail(404, "not_found", "المستخدم غير موجود");
    await guardAdminTarget(c, id);
    const b = await readJson(c.req);
    const f: Record<string, unknown> = {};
    const name = str(b, "full_name", { max: 150 });
    if (name) f.full_name = name;
    const phone = str(b, "phone", { max: 20 });
    if (phone) { const p = normalizePhone(phone); if (!validSaudiPhone(p)) fail(400, "invalid_phone", "رقم الجوال غير صحيح"); f.phone = p; }
    const region = str(b, "region", { max: 40 });
    if (region) { if (!REGIONS.includes(region as (typeof REGIONS)[number])) fail(400, "invalid_region", "مدينة غير صحيحة"); f.region = region; }
    const gender = oneOf(b, "gender", ["male", "female"] as const);
    if (gender) f.gender = gender;
    const active = bool(b, "is_active");
    if (active !== null) {
      if (id === admin.id && !active) fail(400, "self_suspend", "لا يمكنك إيقاف حسابك");
      f.is_active = active ? 1 : 0;
      if (!active) f.is_online = 0;
    }
    const batch = [];
    if (Object.keys(f).length) { const { sql, vals } = updateSql("users", f); batch.push(stmt(c.env.DB, sql, ...vals, now(), id)); }
    const balance = num(b, "coin_balance", { min: 0, max: 10000000, int: true, label: "الرصيد" });
    if (balance !== null && balance !== target!.coin_balance) {
      const diff = balance - target!.coin_balance;
      batch.push(stmt(c.env.DB, "UPDATE users SET coin_balance = ? WHERE id = ?", balance, id));
      batch.push(stmt(c.env.DB, "INSERT INTO coin_transactions (id, provider_id, amount, tx_type, balance_after, description, method) VALUES (?,?,?,?,?,?,?)",
        uid(), id, Math.abs(diff), diff > 0 ? "bonus" : "deduction", balance, "تعديل الرصيد من الإدارة", "الإدارة"));
    }
    if (Array.isArray(b.services)) {
      const names = strArray(b, "services", 60);
      const ids = names.length ? (await all<{ id: string }>(c.env.DB, `SELECT id FROM services WHERE name IN ${inList(names.length)} OR id IN ${inList(names.length)}`, ...names, ...names)).map((x) => x.id) : [];
      batch.push(stmt(c.env.DB, "DELETE FROM provider_services WHERE provider_id = ?", id));
      ids.forEach((sid) => batch.push(stmt(c.env.DB, "INSERT OR IGNORE INTO provider_services (provider_id, service_id) VALUES (?,?)", id, sid)));
      // Services set by the administration become the provider's approved services.
      batch.push(stmt(c.env.DB, "UPDATE users SET approved_services = ? WHERE id = ?", JSON.stringify(ids), id));
    }
    if (active === false) batch.push(stmt(c.env.DB, "DELETE FROM sessions WHERE user_id = ?", id));
    if (batch.length) await c.env.DB.batch(batch);
    return json({ ok: true });
  });

  r.post("/api/admin/users/:id/role", async (c) => {
    const b = await readJson(c.req);
    const role = oneOf(b, "role", ["admin", "staff", "provider", "customer"] as const, { required: true })!;
    // Only an owner grants or removes the owner role; other roles follow the matching page permission.
    const owner = role === "admin"
      ? await requireUser(c, { app: "admin", roles: ["admin"] })
      : await requirePerm(c, role === "staff" ? "staff" : role === "provider" ? "providers" : "customers", "edit");
    const enable = bool(b, "enable") ?? false;
    const id = c.params.id;
    if (!(await first(c.env.DB, "SELECT 1 FROM users WHERE id = ?", id))) fail(404, "not_found", "المستخدم غير موجود");
    if (!enable && role === "admin") {
      if (id === owner.id) fail(400, "self_demote", "لا يمكنك إزالة صلاحية المالك عن نفسك");
      const n = await first<{ n: number }>(c.env.DB, "SELECT COUNT(*) AS n FROM user_roles WHERE role = 'admin'");
      if ((n?.n ?? 0) <= 1) fail(409, "last_admin", "يجب أن يبقى مالك واحد على الأقل");
    }
    const batch = [enable
      ? stmt(c.env.DB, "INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?,?)", id, role)
      : stmt(c.env.DB, "DELETE FROM user_roles WHERE user_id = ? AND role = ?", id, role)];
    if (role === "provider") {
      batch.push(enable
        ? stmt(c.env.DB, "UPDATE users SET verification_status = 'approved', reviewed_at = ?, reviewed_by = ? WHERE id = ?", now(), owner.id, id)
        : stmt(c.env.DB, "UPDATE users SET is_online = 0 WHERE id = ?", id));
      if (!enable) batch.push(stmt(c.env.DB, "DELETE FROM provider_services WHERE provider_id = ?", id));
    }
    if (!enable && (role === "admin" || role === "staff")) batch.push(stmt(c.env.DB, "DELETE FROM sessions WHERE user_id = ? AND app = 'admin'", id));
    await c.env.DB.batch(batch);
    return json({ ok: true });
  });

  /** Page permissions of a staff member: {"section": "none" | "view" | "edit"}. */
  r.put("/api/admin/users/:id/permissions", async (c) => {
    const me = await requirePerm(c, "staff", "edit");
    const id = c.params.id;
    if (id === me.id) fail(400, "self_permissions", "لا يمكنك تعديل صلاحياتك بنفسك");
    const roles = (await all<{ role: string }>(c.env.DB, "SELECT role FROM user_roles WHERE user_id = ?", id)).map((r) => r.role);
    if (roles.includes("admin")) fail(400, "owner_permissions", "المالك يملك كل الصلاحيات");
    if (!roles.includes("staff")) fail(404, "not_staff", "المستخدم ليس من مشرفي اللوحة");
    const perms = parsePermissions((await readJson(c.req)).permissions);
    // A staff member cannot grant more than they have.
    if (!me.roles.includes("admin")) {
      const mine = await permissionsOf(c, me);
      const rank = { none: 0, view: 1, edit: 2 } as const;
      for (const s of ADMIN_SECTIONS) if (rank[perms[s]] > rank[mine[s]]) fail(403, "forbidden", "لا يمكنك منح صلاحية أعلى من صلاحياتك");
    }
    await run(c.env.DB, "UPDATE users SET admin_permissions = ?, updated_at = ? WHERE id = ?", JSON.stringify(perms), now(), id);
    return json({ ok: true, permissions: perms });
  });

  r.post("/api/admin/users/:id/password", async (c) => {
    await requirePerm(c, ["customers", "providers", "staff"], "edit");
    const password = str(await readJson(c.req), "password", { required: true, label: "كلمة المرور" });
    validatePassword(password);
    await guardAdminTarget(c, c.params.id);
    const res = await run(c.env.DB, "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", await hashPassword(c.env, password!), now(), c.params.id);
    if (!res.meta.changes) fail(404, "not_found", "المستخدم غير موجود");
    await run(c.env.DB, "DELETE FROM sessions WHERE user_id = ?", c.params.id);
    return json({ ok: true });
  });

  /** Owner creates a staff/owner account directly (sign-in by email or username). */
  r.post("/api/admin/staff", async (c) => {
    await requirePerm(c, "staff", "edit");
    const b = await readJson(c.req);
    const full_name = str(b, "full_name", { required: true, max: 150, label: "الاسم" })!;
    const login = str(b, "login", { required: true, max: 255, label: "البريد أو اسم المستخدم" })!.toLowerCase();
    const isEmail = login.includes("@");
    if (isEmail ? !validEmail(login) : !/^[a-z0-9_.]{3,30}$/.test(login)) fail(400, "invalid_login", "اسم المستخدم: أحرف إنجليزية وأرقام (3–30) أو بريد صحيح");
    const password = str(b, "password", { required: true, label: "كلمة المرور" });
    validatePassword(password);
    const role = oneOf(b, "role", ["admin", "staff"] as const) ?? "staff";
    if (role === "admin") await requireUser(c, { app: "admin", roles: ["admin"] });
    const permissions = b.permissions !== undefined && role === "staff" ? JSON.stringify(parsePermissions(b.permissions)) : null;
    if (await first(c.env.DB, "SELECT 1 FROM users WHERE email = ?1 OR username = ?1", login)) fail(409, "taken", "البريد أو اسم المستخدم مستخدم");
    const id = uid();
    await c.env.DB.batch([
      stmt(c.env.DB, `INSERT INTO users (id, ${isEmail ? "email" : "username"}, full_name, password_hash, admin_permissions) VALUES (?,?,?,?,?)`, id, login, full_name, await hashPassword(c.env, password!), permissions),
      stmt(c.env.DB, "INSERT INTO user_roles (user_id, role) VALUES (?,?)", id, role),
    ]);
    return json({ id }, 201);
  });

  /* ---------- Provider applications ---------- */
  r.get("/api/admin/applications", async (c) => {
    await requirePerm(c, ["providers", "dashboard"], "view");
    const status = c.url.searchParams.get("status") ?? "pending";
    if (!["pending", "approved", "rejected"].includes(status)) fail(400, "invalid_status");
    const rows = await all<Record<string, unknown> & { requested_services: string }>(c.env.DB,
      `SELECT id, full_name, phone, email, national_id, nationality, gender, region, verification_status, review_note, requested_services, created_at, reviewed_at
         FROM users WHERE verification_status = ? ORDER BY created_at DESC LIMIT 200`, status);
    // Names come from all services (also inactive ones) so the admin always sees what was requested.
    const names = Object.fromEntries((await all<{ id: string; name: string }>(c.env.DB, "SELECT id, name FROM services")).map((s) => [s.id, s.name]));
    return json(rows.map((x) => {
      const ids = safeJson<string[]>(x.requested_services, []);
      return { ...x, requested_services: ids, requested_service_names: ids.map((id) => names[id]).filter(Boolean) };
    }));
  });

  r.get("/api/admin/applications/:id/documents", async (c) => {
    await requirePerm(c, "providers", "view");
    const docs = await all<{ id: string; kind: string; r2_key: string; created_at: string; status: string; note: string | null }>(c.env.DB, "SELECT id, kind, r2_key, created_at, status, note FROM provider_documents WHERE user_id = ? ORDER BY created_at DESC", c.params.id);
    return json(await Promise.all(docs.map(async (d) => ({ id: d.id, kind: d.kind, created_at: d.created_at, status: d.status, note: d.note, url: `${c.url.origin}${await signFileUrl(c.env, d.r2_key)}` }))));
  });

  r.post("/api/admin/applications/:id/review", async (c) => {
    const admin = await requirePerm(c, "providers", "edit");
    const b = await readJson(c.req);
    const approve = bool(b, "approve") ?? false;
    let note = str(b, "note", { max: 500 });
    // Per-document decision: "ok" or "rejected" for the latest ID and certificate, each with an optional reason.
    const docDecision = (kind: "id" | "certificate") => {
      const v = str(b, kind === "id" ? "id_status" : "cert_status", { max: 10 });
      return v === "ok" || v === "rejected" ? v : approve ? "ok" : null;
    };
    const idStatus = docDecision("id");
    const certStatus = docDecision("certificate");
    const idNote = str(b, "id_note", { max: 300 });
    const certNote = str(b, "cert_note", { max: 300 });
    if (!approve && !note && idStatus !== "rejected" && certStatus !== "rejected") fail(400, "missing_note", "حدد المستند غير المقبول أو اكتب سبب الرفض");
    if (!approve && !note) note = [idStatus === "rejected" ? `الهوية: ${idNote ?? "غير واضحة"}` : null, certStatus === "rejected" ? `الشهادة: ${certNote ?? "غير مقبولة"}` : null].filter(Boolean).join(" — ");
    const latest = (kind: string) => `id = (SELECT id FROM provider_documents WHERE user_id = ? AND kind = '${kind}' ORDER BY created_at DESC LIMIT 1)`;
    const docStmts = [
      ...(idStatus ? [stmt(c.env.DB, `UPDATE provider_documents SET status = ?, note = ? WHERE ${latest("id")}`, idStatus === "ok" ? "approved" : "rejected", idStatus === "rejected" ? idNote : null, c.params.id)] : []),
      ...(certStatus ? [stmt(c.env.DB, `UPDATE provider_documents SET status = ?, note = ? WHERE ${latest("certificate")}`, certStatus === "ok" ? "approved" : "rejected", certStatus === "rejected" ? certNote : null, c.params.id)] : []),
    ];
    const u = await first<{ requested_services: string }>(c.env.DB, "SELECT requested_services FROM users WHERE id = ?", c.params.id);
    if (!u) fail(404, "not_found", "الطلب غير موجود");
    const t = now();
    const services = safeJson<string[]>(u!.requested_services, []);
    await c.env.DB.batch([
      ...docStmts,
      stmt(c.env.DB, "UPDATE users SET verification_status = ?, review_note = ?, reviewed_at = ?, reviewed_by = ?, updated_at = ? WHERE id = ?", approve ? "approved" : "rejected", note, t, admin.id, t, c.params.id),
      ...(approve ? [stmt(c.env.DB, "UPDATE users SET approved_services = ? WHERE id = ?", JSON.stringify(services), c.params.id)] : []),
      ...(approve ? [
        stmt(c.env.DB, "INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, 'provider')", c.params.id),
        ...services.map((sid) => stmt(c.env.DB, "INSERT OR IGNORE INTO provider_services (provider_id, service_id) SELECT ?, id FROM services WHERE id = ?", c.params.id, sid)),
      ] : []),
      ...notifyStmts(c, [c.params.id], approve
        ? { title: "تمت الموافقة على حسابك", body: "تم قبولك كمقدم خدمة في مهمة، فعّل الاتصال من الرئيسية لاستقبال الطلبات.", link: "/provider", category: "general", created_by: admin.id }
        : { title: "تحديث طلب التسجيل", body: `لم تتم الموافقة على طلبك${note ? `: ${note}` : "."}`, link: "/provider/account", category: "general", created_by: admin.id }),
    ]);
    notifyExternal(c, [c.params.id], approve
      ? { title: "تمت الموافقة على حسابك", body: "تم قبولك كمقدم خدمة، افتح تطبيق «مهمة شريك» وفعّل الاتصال لاستقبال الطلبات." }
      : { title: "تحديث طلب التسجيل", body: `لم تتم الموافقة على طلبك${note ? `: ${note}` : "."} يمكنك تعديل المستندات من التطبيق.` });
    return json({ success: true });
  });

  /* ---------- Services ---------- */
  r.get("/api/admin/services", async (c) => {
    await requirePerm(c, ["services", "providers", "dashboard", "finance"], "view");
    const [services, subs] = await Promise.all([
      all(c.env.DB, "SELECT * FROM services ORDER BY sort_order, name"),
      all(c.env.DB, "SELECT * FROM sub_services ORDER BY sort_order, name"),
    ]);
    return json({ services, sub_services: subs });
  });
  r.post("/api/admin/services", async (c) => {
    await requirePerm(c, "services", "edit");
    const f = serviceFields(await readJson(c.req), false);
    const id = uid();
    const keys = Object.keys(f);
    await run(c.env.DB, `INSERT INTO services (id, ${keys.join(", ")}) VALUES (?, ${keys.map(() => "?").join(", ")})`, id, ...keys.map((k) => f[k]));
    return json({ id }, 201);
  });
  r.patch("/api/admin/services/:id", async (c) => {
    await requirePerm(c, "services", "edit");
    await patchRow(c, "services", c.params.id, serviceFields(await readJson(c.req), true));
    return json({ ok: true });
  });
  r.delete("/api/admin/services/:id", async (c) => {
    await requirePerm(c, "services", "edit");
    await run(c.env.DB, "DELETE FROM services WHERE id = ?", c.params.id);
    return json({ ok: true });
  });
  r.post("/api/admin/sub-services", async (c) => {
    await requirePerm(c, "services", "edit");
    const f = subFields(await readJson(c.req), false);
    if (!f.service_id || !(await first(c.env.DB, "SELECT 1 FROM services WHERE id = ?", f.service_id))) fail(400, "invalid_service", "الخدمة الرئيسية غير موجودة");
    const id = uid();
    const keys = Object.keys(f);
    await run(c.env.DB, `INSERT INTO sub_services (id, ${keys.join(", ")}) VALUES (?, ${keys.map(() => "?").join(", ")})`, id, ...keys.map((k) => f[k]));
    return json({ id }, 201);
  });
  r.patch("/api/admin/sub-services/:id", async (c) => {
    await requirePerm(c, "services", "edit");
    const f = subFields(await readJson(c.req), true);
    if (f.service_id && !(await first(c.env.DB, "SELECT 1 FROM services WHERE id = ?", f.service_id))) fail(400, "invalid_service", "الخدمة الرئيسية غير موجودة");
    await patchRow(c, "sub_services", c.params.id, f);
    return json({ ok: true });
  });
  r.delete("/api/admin/sub-services/:id", async (c) => {
    await requirePerm(c, "services", "edit");
    await run(c.env.DB, "DELETE FROM sub_services WHERE id = ?", c.params.id);
    return json({ ok: true });
  });
  r.post("/api/admin/reorder", async (c) => {
    await requirePerm(c, "services", "edit");
    const b = await readJson(c.req);
    const table = oneOf(b, "table", ["services", "sub_services"] as const, { required: true })!;
    const ids = strArray(b, "ids", 500);
    if (ids.length) await c.env.DB.batch(ids.map((id, i) => stmt(c.env.DB, `UPDATE ${table} SET sort_order = ? WHERE id = ?`, i, id)));
    return json({ ok: true });
  });
  r.post("/api/admin/services/suggested", async (c) => {
    await requirePerm(c, "services", "edit");
    const b = await readJson(c.req);
    const list = Array.isArray(b.list) ? (b.list as Record<string, unknown>[]).slice(0, 50) : [];
    const existing = new Set((await all<{ name: string }>(c.env.DB, "SELECT name FROM services")).map((x) => x.name));
    let order = (await first<{ n: number }>(c.env.DB, "SELECT COUNT(*) AS n FROM services"))?.n ?? 0;
    const batch = [];
    for (const m of list) {
      const f = serviceFields({ ...m, coin_price: m.coinPrice ?? m.coin_price }, false);
      if (existing.has(f.name as string)) continue;
      const id = uid();
      batch.push(stmt(c.env.DB, "INSERT INTO services (id, name, description, icon, color, coin_price, sort_order) VALUES (?,?,?,?,?,?,?)", id, f.name, f.description ?? null, f.icon ?? "Wrench", f.color ?? "blue", f.coin_price ?? 5, order++));
      const subs = Array.isArray(m.subs) ? (m.subs as Record<string, unknown>[]).slice(0, 30) : [];
      subs.forEach((s, i) => {
        const sf = subFields({ ...s, coin_price: s.coinPrice ?? s.coin_price, delivery_mode: s.deliveryMode ?? s.delivery_mode, color: f.color }, false);
        batch.push(stmt(c.env.DB, "INSERT INTO sub_services (id, service_id, name, description, icon, color, coin_price, delivery_mode, sort_order) VALUES (?,?,?,?,?,?,?,?,?)",
          uid(), id, sf.name, sf.description ?? null, sf.icon ?? "Wrench", f.color ?? "blue", sf.coin_price ?? null, sf.delivery_mode ?? "both", i));
      });
    }
    if (batch.length) await c.env.DB.batch(batch);
    return json({ ok: true });
  });

  /* ---------- Finance ---------- */
  r.get("/api/admin/transactions", async (c) => {
    await requirePerm(c, ["finance", "billing", "dashboard"], "view");
    return json(await all(c.env.DB,
      `SELECT t.id, t.provider_id, t.order_id, t.amount, t.tx_type, t.balance_after, t.description, t.method, t.created_at,
              u.full_name AS provider_name, u.phone AS provider_phone, o.service_name
         FROM coin_transactions t LEFT JOIN users u ON u.id = t.provider_id LEFT JOIN orders o ON o.id = t.order_id
        ORDER BY t.created_at DESC LIMIT 1000`));
  });

  r.get("/api/admin/orders", async (c) => {
    await requirePerm(c, ["finance", "dashboard", "customers", "providers"], "view");
    return json(await all(c.env.DB,
      `SELECT o.id, o.order_no + 100000 AS order_no, o.service_id, o.service_name, o.sub_service_name, o.mode, o.status, o.region, o.coin_cost, o.charged_coins,
              o.billing_mode, o.rating, o.created_at, o.accepted_at, o.completed_at, o.cancelled_at, o.provider_id, o.customer_id,
              c.full_name AS customer_name, p.full_name AS provider_name
         FROM orders o LEFT JOIN users c ON c.id = o.customer_id LEFT JOIN users p ON p.id = o.provider_id
        ORDER BY o.created_at DESC LIMIT 2000`));
  });

  r.post("/api/admin/grant", async (c) => {
    const admin = await requirePerm(c, "billing", "edit");
    const b = await readJson(c.req);
    const kind = oneOf(b, "kind", ["coins", "subscription"] as const, { required: true })!;
    const target = str(b, "provider_id", { max: 64 });
    const note = str(b, "note", { max: 500 }) ?? "";
    const s = await getSettings(c.env);
    const providers = target
      ? await all<{ id: string }>(c.env.DB, "SELECT u.id FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'provider' WHERE u.id = ?", target)
      : await all<{ id: string }>(c.env.DB, "SELECT u.id FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'provider'");
    if (!providers.length) fail(404, "no_providers", "لا يوجد مقدمو خدمة مطابقون");
    const batch = [];
    let endIso: string | null = null;
    if (kind === "coins") {
      const coins = num(b, "coins", { required: true, min: 1, max: 1000000, int: true, label: "عدد الكوينز" })!;
      for (const p of providers) {
        batch.push(stmt(c.env.DB, "UPDATE users SET coin_balance = coin_balance + ? WHERE id = ?", coins, p.id));
        batch.push(stmt(c.env.DB, `INSERT INTO coin_transactions (id, provider_id, amount, tx_type, balance_after, description, method) SELECT ?, id, ?, 'bonus', coin_balance, ?, 'هدية الإدارة' FROM users WHERE id = ?`, uid(), coins, `كوينز هدية: ${note}`.trim(), p.id));
      }
      batch.push(...notifyStmts(c, providers.map((p) => p.id), { title: "كوينز هدية", body: `تمت إضافة ${coins} كوين إلى رصيدك. ${note}`.trim(), category: "general", created_by: admin.id, link: "/provider/coins" }));
    } else {
      if (!s.billing_subscription_enabled) fail(409, "subscription_disabled", "فعّل الاشتراك الدوري واحفظ الإعدادات أولاً");
      const startRaw = str(b, "starts_at", { max: 40 });
      const start = startRaw ? new Date(startRaw).toISOString() : now();
      const endRaw = str(b, "ends_at", { max: 40 });
      const days = num(b, "days", { int: true, min: 1, max: 3660 });
      const end = endRaw ? new Date(endRaw).toISOString() : days ? addDays(start, days) : fail(400, "invalid_period", "حدد المدة");
      if (end <= start || end <= now()) fail(400, "invalid_period", "حدد وقت بداية ونهاية صحيحين");
      endIso = end;
      for (const p of providers) {
        batch.push(stmt(c.env.DB, "INSERT INTO provider_subscriptions (id, provider_id, months, amount, method, starts_at, ends_at, granted_by, grant_note) VALUES (?,?,0,0,'اشتراك مجاني من الإدارة',?,?,?,?)", uid(), p.id, start, end, admin.id, note));
        batch.push(stmt(c.env.DB, "UPDATE users SET billing_mode = 'subscription' WHERE id = ?", p.id));
      }
      const ids = providers.map((p) => p.id);
      batch.push(...notifyStmts(c, ids, { title: "اشتراك مجاني", body: `تم منحك اشتراكاً مجانياً حتى ${end.slice(0, 16).replace("T", " ")}. ${note}`.trim(), category: "general", created_by: admin.id, link: "/provider/billing" }));
      const remind = new Date(Math.max(Date.parse(start), Date.parse(end) - 86400000)).toISOString();
      batch.push(...notifyStmts(c, ids, { title: "تذكير بانتهاء الاشتراك المجاني", body: `ينتهي اشتراكك المجاني في ${end.slice(0, 16).replace("T", " ")}`, category: "general", created_by: admin.id, scheduled_at: remind, link: "/provider/billing" }));
    }
    // D1 batches are limited in size; split large grants.
    for (let i = 0; i < batch.length; i += 90) await c.env.DB.batch(batch.slice(i, i + 90));
    return json({ success: true, count: providers.length, ends_at: endIso });
  });

  /* ---------- Notifications ---------- */
  r.get("/api/admin/notifications", async (c) => {
    await requirePerm(c, "notifications", "view");
    const rows = await all<Record<string, unknown> & { id: string }>(c.env.DB, "SELECT * FROM notifications WHERE category <> 'order' ORDER BY sent_at DESC LIMIT 300");
    const targets = await all<{ notification_id: string; user_id: string }>(c.env.DB,
      `SELECT notification_id, user_id FROM notification_targets WHERE notification_id IN (SELECT id FROM notifications WHERE category <> 'order' ORDER BY sent_at DESC LIMIT 300)`);
    const by: Record<string, string[]> = {};
    targets.forEach((t) => (by[t.notification_id] ||= []).push(t.user_id));
    return json(rows.map((n) => ({ ...n, target_ids: by[n.id] ?? [] })));
  });
  r.post("/api/admin/notifications", async (c) => {
    const admin = await requirePerm(c, "notifications", "edit");
    const b = await readJson(c.req);
    const title = str(b, "title", { required: true, max: 200, label: "العنوان" })!;
    const body = str(b, "body", { required: true, max: 1000, label: "النص" })!;
    const audience = oneOf(b, "audience", ["all", "customers", "providers", "specific"] as const) ?? "all";
    const category = oneOf(b, "category", ["general", "national", "religious", "promo", "alert", "maintenance"] as const) ?? "general";
    const targets = strArray(b, "target_ids", 5000);
    if (audience === "specific" && !targets.length) fail(400, "no_targets", "اختر مستلماً واحداً على الأقل");
    const sched = str(b, "scheduled_at", { max: 40 });
    const scheduled_at = sched ? new Date(sched).toISOString() : null;
    const id = uid();
    // Icon: a key from the shared icon set (e.g. "moon"), an uploaded image URL, or a legacy emoji.
    const icon = str(b, "icon", { max: 500 });
    const sound = bool(b, "sound") ?? true;
    const batch = [
      stmt(c.env.DB, "INSERT INTO notifications (id, title, body, audience, category, icon, accent_color, link, scheduled_at, sent_at, created_by, sound) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        id, title, body, audience, category, icon, str(b, "accent_color", { max: 20 }), str(b, "link", { max: 200 }), scheduled_at, scheduled_at ?? now(), admin.id, sound ? 1 : 0),
      ...(audience === "specific" ? targets.map((t) => stmt(c.env.DB, "INSERT OR IGNORE INTO notification_targets (notification_id, user_id) SELECT ?, id FROM users WHERE id = ?", id, t)) : []),
    ];
    for (let i = 0; i < batch.length; i += 90) await c.env.DB.batch(batch.slice(i, i + 90));
    if (!scheduled_at || scheduled_at <= now()) {
      const ids = audience === "specific" ? targets : await audienceUserIds(c.env, audience);
      const app = audience === "customers" ? "customer" : audience === "providers" ? "provider" : undefined;
      if (ids.length) c.push.push({ userIds: ids, app, message: { title, body, sound, data: { link: str(b, "link", { max: 200 }) ?? "", notification_id: id, sound: sound ? "1" : "0", icon: icon ?? "", accent: str(b, "accent_color", { max: 20 }) ?? "" } } });
    }
    return json({ id }, 201);
  });
  r.delete("/api/admin/notifications/:id", async (c) => {
    await requirePerm(c, "notifications", "edit");
    await run(c.env.DB, "DELETE FROM notifications WHERE id = ?", c.params.id);
    return json({ ok: true });
  });

  /* ---------- Ads ---------- */
  function adFields(b: Record<string, unknown>, partial: boolean) {
    const f: Record<string, unknown> = {};
    const sponsor = str(b, "sponsor", { required: !partial, max: 120, label: "الجهة المعلنة" }); if (sponsor !== null) f.sponsor = sponsor;
    const title = str(b, "title", { required: !partial, max: 200, label: "عنوان الإعلان" }); if (title !== null) f.title = title;
    if (b.image_url !== undefined) { const v = str(b, "image_url", { max: 500 }); if (v && !/^https?:\/\//.test(v)) fail(400, "invalid_image", "رابط الصورة غير صالح"); f.image_url = v; }
    if (b.link !== undefined) { const v = str(b, "link", { max: 500 }); if (v && !/^https?:\/\//.test(v)) fail(400, "invalid_link", "الرابط يجب أن يبدأ بـ https://"); f.link = v; }
    const placement = oneOf(b, "placement", ["top_banner", "bottom_banner", "popup_card"] as const); if (placement) f.placement = placement;
    const sd = str(b, "start_date", { required: !partial, max: 10, label: "تاريخ البداية" }); if (sd) f.start_date = sd;
    const ed = str(b, "end_date", { required: !partial, max: 10, label: "تاريخ النهاية" }); if (ed) f.end_date = ed;
    const active = bool(b, "active"); if (active !== null) f.active = active ? 1 : 0;
    return f;
  }
  r.get("/api/admin/ads", async (c) => { await requirePerm(c, "ads", "view"); return json(await all(c.env.DB, "SELECT * FROM ads ORDER BY created_at DESC")); });
  r.post("/api/admin/ads", async (c) => {
    await requirePerm(c, "ads", "edit");
    const f = adFields(await readJson(c.req), false);
    const keys = Object.keys(f);
    const id = uid();
    await run(c.env.DB, `INSERT INTO ads (id, ${keys.join(", ")}) VALUES (?, ${keys.map(() => "?").join(", ")})`, id, ...keys.map((k) => f[k]));
    return json({ id }, 201);
  });
  r.patch("/api/admin/ads/:id", async (c) => { await requirePerm(c, "ads", "edit"); await patchRow(c, "ads", c.params.id, adFields(await readJson(c.req), true)); return json({ ok: true }); });
  r.delete("/api/admin/ads/:id", async (c) => { await requirePerm(c, "ads", "edit"); await run(c.env.DB, "DELETE FROM ads WHERE id = ?", c.params.id); return json({ ok: true }); });

  /* ---------- Policies ---------- */
  function policyFields(b: Record<string, unknown>, partial: boolean) {
    const f: Record<string, unknown> = {};
    const title = str(b, "title", { required: !partial, max: 200, label: "العنوان" }); if (title !== null) f.title = title;
    const body = str(b, "body", { required: !partial, max: 50000, label: "النص" }); if (body !== null) f.body = body;
    const aud = oneOf(b, "audience", ["all", "customers", "providers"] as const); if (aud) f.audience = aud;
    const type = str(b, "policy_type", { max: 60 }); if (type) f.policy_type = type;
    const version = str(b, "version", { max: 20 }); if (version) f.version = version;
    const pub = bool(b, "published"); if (pub !== null) f.published = pub ? 1 : 0;
    if (Array.isArray(b.placements)) {
      const allowed = ["registration", "account", "order", "billing", "application"];
      const list = (b.placements as unknown[]).filter((x): x is string => typeof x === "string" && allowed.includes(x));
      if (!list.length) fail(400, "missing_placement", "اختر مكاناً واحداً على الأقل لظهور السياسة");
      f.placements = JSON.stringify([...new Set(list)]);
    }
    return f;
  }
  r.get("/api/admin/policies", async (c) => { await requirePerm(c, "policies", "view"); return json(await all(c.env.DB, "SELECT * FROM policies ORDER BY updated_at DESC")); });
  r.post("/api/admin/policies", async (c) => {
    await requirePerm(c, "policies", "edit");
    const f = policyFields(await readJson(c.req), false);
    const keys = Object.keys(f);
    const id = uid();
    await run(c.env.DB, `INSERT INTO policies (id, ${keys.join(", ")}) VALUES (?, ${keys.map(() => "?").join(", ")})`, id, ...keys.map((k) => f[k]));
    return json({ id }, 201);
  });
  r.patch("/api/admin/policies/:id", async (c) => { await requirePerm(c, "policies", "edit"); await patchRow(c, "policies", c.params.id, policyFields(await readJson(c.req), true)); return json({ ok: true }); });
  r.delete("/api/admin/policies/:id", async (c) => { await requirePerm(c, "policies", "edit"); await run(c.env.DB, "DELETE FROM policies WHERE id = ?", c.params.id); return json({ ok: true }); });

  /* ---------- Settings ---------- */
  r.get("/api/admin/settings", async (c) => { await requireAdmin(c); return json(await getSettings(c.env)); });
  r.put("/api/admin/settings", async (c) => {
    const b = await readJson(c.req);
    const billingKeys = ["billing_coins_enabled", "billing_subscription_enabled", "test_payments_enabled", "sub_price_1m", "sub_price_3m", "sub_price_6m", "sub_price_12m", "vat_percent", "coin_price"];
    const generalKeys = Object.keys(b).filter((k) => !billingKeys.includes(k));
    if (generalKeys.length) await requirePerm(c, "settings", "edit");
    if (Object.keys(b).some((k) => billingKeys.includes(k))) await requirePerm(c, ["billing", "gateways"], "edit");
    const f: Record<string, unknown> = {};
    for (const [k, max] of [["app_name", 60], ["currency_label", 30], ["support_email", 255], ["support_phone", 30], ["welcome_customer", 500], ["welcome_provider", 500], ["primary_color", 20]] as const) {
      if (b[k] !== undefined) f[k] = str(b, k, { max });
    }
    if (b.logo_url !== undefined) { const v = str(b, "logo_url", { max: 500 }); if (v && !/^https?:\/\//.test(v)) fail(400, "invalid_logo", "ارفع الشعار من زر إضافة شعار"); f.logo_url = v; }
    for (const k of ["billing_coins_enabled", "billing_subscription_enabled", "test_payments_enabled"] as const) {
      const v = bool(b, k); if (v !== null) f[k] = v ? 1 : 0;
    }
    for (const k of ["sub_price_1m", "sub_price_3m", "sub_price_6m", "sub_price_12m", "vat_percent", "coin_price"] as const) {
      const v = num(b, k, { min: 0, max: 1000000 }); if (v !== null) f[k] = v;
    }
    if (f.billing_coins_enabled === 0 && f.billing_subscription_enabled === 0) fail(400, "no_billing", "فعّل طريقة تحصيل واحدة على الأقل");
    if (Object.keys(f).length) {
      const keys = Object.keys(f);
      await run(c.env.DB, `UPDATE app_settings SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = ? WHERE id = 1`, ...keys.map((k) => f[k]), now());
    }
    return json(await getSettings(c.env));
  });

  r.post("/api/admin/upload", async (c) => {
    await requirePerm(c, ["services", "ads", "settings", "notifications"], "edit");
    const form = await c.req.formData();
    const file = formFile(form, "file");
    if (!file) return fail(400, "no_file", "اختر صورة");
    return json({ url: await savePublicImage(c, file) }, 201);
  });

  /* ---------- Payment gateways ---------- */
  r.get("/api/admin/gateways", async (c) => { await requirePerm(c, ["gateways", "billing"], "view"); return json(await all(c.env.DB, "SELECT * FROM payment_gateways ORDER BY sort_order, created_at")); });
  r.post("/api/admin/gateways", async (c) => {
    await requirePerm(c, "gateways", "edit");
    const b = await readJson(c.req);
    const id = uid();
    await run(c.env.DB, "INSERT INTO payment_gateways (id, name, provider_key, merchant_id, public_key, fee_percent, sort_order) VALUES (?,?,?,?,?,?,?)",
      id, str(b, "name", { required: true, max: 60, label: "اسم البوابة" }), gatewayKey(str(b, "provider_key", { max: 30 })),
      str(b, "merchant_id", { max: 120 }), str(b, "public_key", { max: 300 }), num(b, "fee_percent", { min: 0, max: 100 }) ?? 0, num(b, "sort_order", { int: true, min: 0 }) ?? 99);
    return json({ id }, 201);
  });
  r.patch("/api/admin/gateways/:id", async (c) => {
    await requirePerm(c, "gateways", "edit");
    const b = await readJson(c.req);
    const f: Record<string, unknown> = {};
    for (const k of ["test_mode", "active"] as const) { const v = bool(b, k); if (v !== null) f[k] = v ? 1 : 0; }
    const fee = num(b, "fee_percent", { min: 0, max: 100 }); if (fee !== null) f.fee_percent = fee;
    const name = str(b, "name", { max: 60 }); if (name) f.name = name;
    await patchRow(c, "payment_gateways", c.params.id, f);
    return json({ ok: true });
  });
  r.delete("/api/admin/gateways/:id", async (c) => { await requirePerm(c, "gateways", "edit"); await run(c.env.DB, "DELETE FROM payment_gateways WHERE id = ?", c.params.id); return json({ ok: true }); });

  /* ---------- SMS and e-mail (keys are Worker secrets; only the non-secret settings are saved here) ---------- */
  r.put("/api/admin/integrations", async (c) => {
    await requirePerm(c, "integrations", "edit");
    const b = await readJson(c.req);
    const f: Record<string, unknown> = {};
    for (const k of ["sms_enabled", "email_enabled", "whatsapp_enabled"] as const) { const v = bool(b, k); if (v !== null) f[k] = v ? 1 : 0; }
    if (b.whatsapp_phone_id !== undefined) { const v = str(b, "whatsapp_phone_id", { max: 40 }); if (v && !/^\d{6,30}$/.test(v)) fail(400, "invalid_phone_id", "معرّف رقم الهاتف أرقام فقط"); f.whatsapp_phone_id = v; }
    if (b.whatsapp_template !== undefined) { const v = str(b, "whatsapp_template", { max: 100 }); if (v && !/^[a-z0-9_]+$/.test(v)) fail(400, "invalid_template", "اسم القالب بأحرف إنجليزية صغيرة وأرقام و _"); f.whatsapp_template = v; }
    if (b.whatsapp_lang !== undefined) f.whatsapp_lang = str(b, "whatsapp_lang", { max: 10 }) ?? "ar";
    if (b.sms_provider !== undefined) { const v = str(b, "sms_provider", { max: 20 }); if (v && !(SMS_PROVIDERS as readonly string[]).includes(v)) fail(400, "invalid_provider", "مزود رسائل غير مدعوم"); f.sms_provider = v; }
    if (b.email_provider !== undefined) { const v = str(b, "email_provider", { max: 20 }); if (v && !(EMAIL_PROVIDERS as readonly string[]).includes(v)) fail(400, "invalid_provider", "مزود بريد غير مدعوم"); f.email_provider = v; }
    if (b.sms_sender !== undefined) f.sms_sender = str(b, "sms_sender", { max: 11 });
    if (b.sms_username !== undefined) f.sms_username = str(b, "sms_username", { max: 100 });
    if (b.email_from !== undefined) { const v = str(b, "email_from", { max: 255 }); if (v && !validEmail(v)) fail(400, "invalid_email", "بريد المرسل غير صحيح"); f.email_from = v; }
    if (b.email_from_name !== undefined) f.email_from_name = str(b, "email_from_name", { max: 80 });
    if (Object.keys(f).length) {
      const keys = Object.keys(f);
      await run(c.env.DB, `UPDATE app_settings SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = ? WHERE id = 1`, ...keys.map((k) => f[k]), now());
    }
    return json(await getSettings(c.env));
  });
  r.post("/api/admin/integrations/test-sms", async (c) => {
    await requirePerm(c, "integrations", "edit");
    const to = str(await readJson(c.req), "to", { required: true, max: 20, label: "رقم الجوال" })!;
    const p = normalizePhone(to);
    if (!validSaudiPhone(p)) fail(400, "invalid_phone", "رقم الجوال غير صحيح");
    const r2 = await testSms(c.env, p);
    if (!r2.ok) fail(502, "sms_failed", `فشل الإرسال: ${r2.error}`);
    return json({ ok: true });
  });
  r.post("/api/admin/integrations/test-email", async (c) => {
    await requirePerm(c, "integrations", "edit");
    const to = str(await readJson(c.req), "to", { required: true, max: 255, label: "البريد" })!;
    if (!validEmail(to)) fail(400, "invalid_email", "البريد غير صحيح");
    const r2 = await testEmail(c.env, to);
    if (!r2.ok) fail(502, "email_failed", `فشل الإرسال: ${r2.error}`);
    return json({ ok: true });
  });
  r.post("/api/admin/integrations/test-whatsapp", async (c) => {
    await requirePerm(c, "integrations", "edit");
    const to = str(await readJson(c.req), "to", { required: true, max: 20, label: "رقم الجوال" })!;
    const p = normalizePhone(to);
    if (!validSaudiPhone(p)) fail(400, "invalid_phone", "رقم الجوال غير صحيح");
    const r2 = await testWhatsApp(c.env, p);
    if (!r2.ok) fail(502, "whatsapp_failed", `فشل الإرسال: ${r2.error}`);
    return json({ ok: true });
  });
  r.get("/api/admin/integrations/log", async (c) => {
    await requirePerm(c, "integrations", "view");
    return json(await all(c.env.DB, "SELECT id, channel, recipient, subject, status, error, created_at FROM message_log ORDER BY created_at DESC LIMIT 100"));
  });

  /* ---------- Occasion discounts (promotions) ---------- */
  function promoFields(b: Record<string, unknown>, partial: boolean) {
    const f: Record<string, unknown> = {};
    const title = str(b, "title", { required: !partial, max: 120, label: "اسم العرض" }); if (title !== null) f.title = title;
    const kind = oneOf(b, "kind", ["percent", "free", "amount"] as const, { required: !partial, label: "نوع الخصم" }); if (kind) f.kind = kind;
    const value = num(b, "value", { min: 0, max: 100000 }); if (value !== null) f.value = value;
    if ((f.kind ?? b.kind) === "percent" && typeof f.value === "number" && (f.value <= 0 || f.value > 100)) fail(400, "invalid_value", "النسبة بين 1 و100");
    if ((f.kind ?? b.kind) === "amount" && typeof f.value === "number" && f.value <= 0) fail(400, "invalid_value", "اكتب مبلغ الخصم");
    if (f.kind === "free") f.value = 100;
    const scope = oneOf(b, "scope", ["all", "service"] as const); if (scope) f.scope = scope;
    if (b.service_id !== undefined) f.service_id = str(b, "service_id", { max: 64 });
    if (f.scope === "service" && !f.service_id) fail(400, "missing_service", "اختر القسم");
    if (f.scope === "all") f.service_id = null;
    const to = oneOf(b, "applies_to", ["orders", "subscriptions", "topups", "all"] as const); if (to) f.applies_to = to;
    for (const k of ["starts_at", "ends_at"] as const) {
      const v = str(b, k, { required: !partial && k === "ends_at", max: 40 });
      if (v) { const t = Date.parse(v); if (!Number.isFinite(t)) fail(400, "invalid_date", "تاريخ غير صحيح"); f[k] = new Date(t).toISOString(); }
    }
    if (!partial && !f.starts_at) f.starts_at = now();
    if (f.starts_at && f.ends_at && String(f.ends_at) <= String(f.starts_at)) fail(400, "invalid_range", "تاريخ النهاية بعد البداية");
    const active = bool(b, "active"); if (active !== null) f.active = active ? 1 : 0;
    return f;
  }
  r.get("/api/admin/promotions", async (c) => {
    await requirePerm(c, ["billing", "notifications"], "view");
    return json(await all(c.env.DB, "SELECT p.*, s.name AS service_name FROM promotions p LEFT JOIN services s ON s.id = p.service_id ORDER BY p.created_at DESC LIMIT 200"));
  });
  r.post("/api/admin/promotions", async (c) => {
    const admin = await requirePerm(c, "billing", "edit");
    const b = await readJson(c.req);
    const f = promoFields(b, false);
    const id = uid();
    const keys = Object.keys(f);
    await run(c.env.DB, `INSERT INTO promotions (id, created_by, ${keys.join(", ")}) VALUES (?, ?, ${keys.map(() => "?").join(", ")})`, id, admin.id, ...keys.map((k) => f[k]));
    // Optional announcement to providers (with sound) when the offer is created.
    if (bool(b, "notify")) {
      const title = str(b, "notify_title", { max: 200 }) ?? String(f.title);
      const body = str(b, "notify_body", { max: 1000 }) ?? "عرض خاص لفترة محدودة، تفاصيله في صفحة الرصيد والاشتراك.";
      const nid = uid();
      await run(c.env.DB, "INSERT INTO notifications (id, title, body, audience, category, icon, accent_color, link, sent_at, created_by, sound) VALUES (?,?,?,?,?,?,?,?,?,?,1)",
        nid, title, body, "providers", "promo", str(b, "notify_icon", { max: 500 }) ?? "percent", "#EC4899", "/provider/billing", now(), admin.id);
      const ids = await audienceUserIds(c.env, "providers");
      if (ids.length) c.push.push({ userIds: ids, app: "provider", message: { title, body, sound: true, data: { link: "/provider/billing", notification_id: nid, sound: "1", icon: "percent" } } });
    }
    return json({ id }, 201);
  });
  r.patch("/api/admin/promotions/:id", async (c) => {
    await requirePerm(c, "billing", "edit");
    const f = promoFields(await readJson(c.req), true);
    const keys = Object.keys(f);
    if (keys.length) await run(c.env.DB, `UPDATE promotions SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`, ...keys.map((k) => f[k]), c.params.id);
    return json({ ok: true });
  });
  r.delete("/api/admin/promotions/:id", async (c) => {
    await requirePerm(c, "billing", "edit");
    await run(c.env.DB, "DELETE FROM promotions WHERE id = ?", c.params.id);
    return json({ ok: true });
  });

  /* ---------- Messages ---------- */
  r.get("/api/admin/messages", async (c) => {
    await requirePerm(c, "messages", "view");
    return json(await all(c.env.DB,
      `SELECT m.id, m.sender_id, m.recipient_id, m.subject, m.body, m.created_at, m.read_at, s.full_name AS sender_name, t.full_name AS recipient_name
         FROM messages m LEFT JOIN users s ON s.id = m.sender_id LEFT JOIN users t ON t.id = m.recipient_id
        WHERE m.order_id IS NULL ORDER BY m.created_at DESC LIMIT 300`));
  });
  r.post("/api/admin/messages", async (c) => {
    const admin = await requirePerm(c, "messages", "edit");
    const b = await readJson(c.req);
    const recipient = str(b, "recipient_id", { required: true, max: 64, label: "المستلم" })!;
    if (!(await first(c.env.DB, "SELECT 1 FROM users WHERE id = ?", recipient))) fail(404, "not_found", "المستلم غير موجود");
    const id = uid();
    await c.env.DB.batch([
      stmt(c.env.DB, "INSERT INTO messages (id, sender_id, recipient_id, subject, body) VALUES (?,?,?,?,?)", id, admin.id, recipient, str(b, "subject", { max: 200 }), str(b, "body", { required: true, max: 2000, label: "الرسالة" })),
      ...notifyStmts(c, [recipient], { title: "رسالة جديدة من الإدارة", body: str(b, "subject", { max: 200 }) ?? "لديك رسالة جديدة", category: "general", created_by: admin.id }),
    ]);
    return json({ id }, 201);
  });
  r.get("/api/admin/people", async (c) => {
    await requirePerm(c, ["messages", "notifications", "billing", "staff"], "view");
    return json(await all(c.env.DB, "SELECT id, full_name, phone, email FROM users ORDER BY created_at DESC LIMIT 2000"));
  });
}
