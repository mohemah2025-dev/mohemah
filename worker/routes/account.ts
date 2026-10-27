import {
  all, bool, fail, first, json, normalizePhone, now, num, oneOf, readJson, REGIONS, run, stmt, str, strArray, uid,
  validEmail, validSaudiPhone, inList, type App, type Ctx, type Router,
} from "../lib/core";
import {
  clearRateLimit, createSession, destroySession, getUser, hashPassword, rateLimit, requireUser, signFileUrl,
  validatePassword, verifyFileSignature, verifyPassword,
  ADMIN_SECTIONS, parseFeatures, parsePermissions, type AdminFeatures, type AdminPermissions,
} from "../lib/auth";
import { deleteFiles, getFile, putFile } from "../lib/storage";
import { userWrites } from "./support";
import { sendDirect } from "../lib/messaging";
import { langOf, rememberLang, translateRows } from "../lib/translate";
import { activeSubscriptionEnd, getSettings, publicSettings, referralCodeFor, serializeProfile, type UserRow } from "../lib/domain";

export const DOC_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
const IMG_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/svg+xml": "svg" };
const DOC_MAX = 5 * 1024 * 1024;

export function validateDoc(file: File) {
  if (!DOC_TYPES[file.type]) fail(400, "invalid_file", "المرفقات: صورة (JPG/PNG/WEBP) أو PDF فقط");
  if (file.size > DOC_MAX) fail(400, "invalid_file", "حجم المرفق الأقصى 5MB");
}

function validateAvatar(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) fail(400, "invalid_file", "الصورة الشخصية يجب أن تكون JPG أو PNG");
  if (file.size > 3 * 1024 * 1024) fail(400, "invalid_file", "حجم الصورة الشخصية الأقصى 3MB");
}

export async function saveProviderDoc(c: Ctx, userId: string, kind: "id" | "certificate", file: File) {
  validateDoc(file);
  const ext = DOC_TYPES[file.type];
  const key = `docs/${userId}/${kind}-${Date.now()}.${ext}`;
  await putFile(c.env, key, file);
  await run(c.env.DB, "INSERT INTO provider_documents (id, user_id, kind, r2_key, content_type, size) VALUES (?,?,?,?,?,?)", uid(), userId, kind, key, file.type, file.size);
}

export async function savePublicImage(c: Ctx, file: File, maxBytes = 3 * 1024 * 1024) {
  const ext = IMG_TYPES[file.type];
  if (!ext) fail(400, "invalid_file", "الصورة يجب أن تكون PNG أو JPG أو WEBP أو SVG");
  if (file.size > maxBytes) fail(400, "invalid_file", `حجم الصورة الأقصى ${Math.round(maxBytes / 1048576)}MB`);
  const name = `${uid()}.${ext}`;
  await putFile(c.env, `public/${name}`, file);
  return `${c.url.origin}/api/files/public/${name}`;
}

export async function loadProfile(c: Ctx, id: string) {
  const u = await first<UserRow>(c.env.DB, "SELECT * FROM users WHERE id = ?", id);
  return u ? serializeProfile(u) : null;
}

async function mePayload(c: Ctx, userId: string, app: App) {
  const profile = await loadProfile(c, userId);
  const roles = (await all<{ role: string }>(c.env.DB, "SELECT role FROM user_roles WHERE user_id = ?", userId)).map((r) => r.role);
  const subscription_end = roles.includes("provider") ? await activeSubscriptionEnd(c.env, userId) : null;
  // Admin panel: pages this account may view or edit (the owner has everything).
  let permissions: AdminPermissions | null = null;
  let features: AdminFeatures | null = null;
  if (app === "admin" && (roles.includes("admin") || roles.includes("staff"))) {
    if (roles.includes("admin")) permissions = Object.fromEntries(ADMIN_SECTIONS.map((x) => [x, "edit"])) as AdminPermissions;
    else {
      const row = await first<{ admin_permissions: string | null; admin_features: string | null }>(c.env.DB, "SELECT admin_permissions, admin_features FROM users WHERE id = ?", userId);
      permissions = parsePermissions(row?.admin_permissions);
      features = parseFeatures(row?.admin_features);
    }
  }
  return { profile, roles, app, subscription_end, permissions, features };
}

export function formFile(f: FormData, k: string): File | null {
  const v = f.get(k) as unknown;
  return v && typeof v === "object" && "arrayBuffer" in (v as object) && (v as File).size > 0 ? (v as File) : null;
}

function formStr(f: FormData, k: string) {
  const v = f.get(k);
  return typeof v === "string" ? v.trim() : "";
}

/** Saudi, Kuwaiti, Emirati, Qatari and Bahraini providers do not need to name an establishment. */
const COMPANY_EXEMPT = /(سعود|كويت|[إاأ]مارات|قطر|بحرين)/;
export function companyFor(form: FormData, nationality: string | null) {
  const company = formStr(form, "company_name").slice(0, 150) || null;
  if (nationality && !COMPANY_EXEMPT.test(nationality) && !company) fail(400, "company_required", "اكتب اسم المؤسسة أو الشركة التي تتبع لها");
  if (!nationality) fail(400, "nationality_required", "اختر الجنسية");
  return nationality && COMPANY_EXEMPT.test(nationality) ? null : company;
}

const maskPhone = (p: string) => `${p.slice(0, 3)}*****${p.slice(-2)}`;
const maskEmail = (e: string) => { const [a, d] = e.split("@"); return `${a.slice(0, 2)}***@${d}`; };
async function codeHash(userId: string, code: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${userId}:${code}`));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function registerAccountRoutes(r: Router) {
  /** Welcome popup for new members: receive the gift once (coins or subscription days for providers). */
  r.post("/api/ads/:id/claim", async (c) => {
    const u = await requireUser(c);
    const ad = await first<{ audience: string; new_days: number; app: string; gift_kind: string; gift_value: number; title: string; active: number; end_date: string }>(c.env.DB,
      "SELECT audience, new_days, app, gift_kind, gift_value, title, active, end_date FROM ads WHERE id = ?", c.params.id);
    if (!ad || !ad.active || ad.end_date < now().slice(0, 10)) fail(404, "not_found", "العرض غير متاح");
    const me = await first<{ created_at: string }>(c.env.DB, "SELECT created_at FROM users WHERE id = ?", u.id);
    if (ad!.audience === "new_users" && Date.parse(me!.created_at) < Date.now() - (ad!.new_days || 7) * 86400000) fail(409, "not_new", "الهدية للمسجلين الجدد فقط");
    if (ad!.app !== "all" && ad!.app !== u.app) fail(409, "other_app", "العرض لتطبيق آخر");
    const res = await run(c.env.DB, "INSERT OR IGNORE INTO ad_claims (ad_id, user_id) VALUES (?,?)", c.params.id, u.id);
    if (!res.meta.changes) return json({ ok: true, already: true });
    const isProvider = u.roles.includes("provider");
    const v = Math.max(0, Math.round(ad!.gift_value || 0));
    if (isProvider && ad!.gift_kind === "coins" && v > 0) {
      await c.env.DB.batch([
        stmt(c.env.DB, "UPDATE users SET coin_balance = coin_balance + ? WHERE id = ?", v, u.id),
        stmt(c.env.DB, "INSERT INTO coin_transactions (id, provider_id, amount, tx_type, balance_after, description, method) SELECT ?, ?, ?, 'bonus', coin_balance, ?, 'هدية' FROM users WHERE id = ?", uid(), u.id, v, `هدية ترحيب: ${ad!.title}`, u.id),
      ]);
      return json({ ok: true, gift: "coins", value: v });
    }
    if (isProvider && ad!.gift_kind === "subscription" && v > 0) {
      const end = await first<{ e: string | null }>(c.env.DB, "SELECT MAX(ends_at) AS e FROM provider_subscriptions WHERE provider_id = ? AND ends_at > ?", u.id, now());
      const start = end?.e ?? now();
      await run(c.env.DB, "INSERT INTO provider_subscriptions (id, provider_id, months, amount, method, starts_at, ends_at, grant_note) VALUES (?,?,?,?,?,?,?,?)",
        uid(), u.id, 0, 0, "هدية", start, new Date(Date.parse(start) + v * 86400000).toISOString(), `هدية ترحيب: ${ad!.title}`);
      return json({ ok: true, gift: "subscription", value: v });
    }
    return json({ ok: true, gift: "none" });
  });

  /* ---------- Account / password recovery by SMS or e-mail ---------- */
  r.post("/api/auth/forgot", async (c) => {
    await rateLimit(c.env, `forgot:${c.ip}`, 10, 60);
    const b = await readJson(c.req);
    const identifier = (str(b, "identifier", { required: true, max: 255, label: "الجوال أو البريد" }) ?? "").trim().toLowerCase();
    const channel = oneOf(b, "channel", ["sms", "email"] as const) ?? (identifier.includes("@") ? "email" : "sms");
    const phone = normalizePhone(identifier);
    const u = await first<{ id: string; phone: string | null; email: string | null; full_name: string | null; member_no: number | null }>(c.env.DB,
      "SELECT id, phone, email, full_name, member_no FROM users WHERE email = ?1 OR (phone = ?2 AND ?2 <> '') ORDER BY created_at LIMIT 1", identifier, validSaudiPhone(phone) ? phone : "");
    if (!u) fail(404, "not_found", "لا يوجد حساب بهذا الجوال أو البريد");
    const to = channel === "sms" ? u!.phone : u!.email;
    if (!to) fail(400, "no_destination", channel === "sms" ? "لا يوجد رقم جوال في الحساب، اختر البريد" : "لا يوجد بريد في الحساب، اختر الجوال");
    await rateLimit(c.env, `forgot-user:${u!.id}`, 5, 60);
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
    const lines = [`رمز استعادة حسابك: ${code} (صالح 15 دقيقة).`, "بيانات الدخول:"];
    if (u!.email) lines.push(`البريد: ${u!.email}`);
    if (u!.phone) lines.push(`الجوال: ${u!.phone}`);
    if (u!.member_no) lines.push(`رقم العضوية: #${u!.member_no}`);
    const sent = await sendDirect(c.env, channel, to!, "استعادة الحساب", lines.join("\n"));
    if (!sent.ok) fail(503, "send_failed", sent.error.startsWith("الإرسال") ? sent.error : "تعذر إرسال الرمز الآن، حاول لاحقاً أو تواصل مع الدعم");
    await run(c.env.DB, "INSERT INTO password_resets (id, user_id, code_hash, channel, expires_at) VALUES (?,?,?,?,?)",
      uid(), u!.id, await codeHash(u!.id, code), channel, new Date(Date.now() + 15 * 60000).toISOString());
    return json({ ok: true, sent_to: channel === "sms" ? maskPhone(to!) : maskEmail(to!) });
  });

  r.post("/api/auth/reset", async (c) => {
    await rateLimit(c.env, `reset:${c.ip}`, 20, 60);
    const b = await readJson(c.req);
    const identifier = (str(b, "identifier", { required: true, max: 255, label: "الجوال أو البريد" }) ?? "").trim().toLowerCase();
    const code = (str(b, "code", { required: true, max: 10, label: "الرمز" }) ?? "").trim();
    const password = str(b, "password", { required: true, label: "كلمة المرور" });
    validatePassword(password);
    const phone = normalizePhone(identifier);
    const u = await first<{ id: string }>(c.env.DB, "SELECT id FROM users WHERE email = ?1 OR (phone = ?2 AND ?2 <> '') ORDER BY created_at LIMIT 1", identifier, validSaudiPhone(phone) ? phone : "");
    const req = u ? await first<{ id: string; code_hash: string; attempts: number }>(c.env.DB,
      "SELECT id, code_hash, attempts FROM password_resets WHERE user_id = ? AND used_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1", u.id, now()) : null;
    if (!u || !req) fail(400, "invalid_code", "الرمز غير صحيح أو منتهي، اطلب رمزاً جديداً");
    if (req!.attempts >= 5) fail(429, "too_many_attempts", "محاولات كثيرة، اطلب رمزاً جديداً");
    if ((await codeHash(u!.id, code)) !== req!.code_hash) {
      await run(c.env.DB, "UPDATE password_resets SET attempts = attempts + 1 WHERE id = ?", req!.id);
      fail(400, "invalid_code", "الرمز غير صحيح");
    }
    await c.env.DB.batch([
      stmt(c.env.DB, "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", await hashPassword(c.env, password!), now(), u!.id),
      stmt(c.env.DB, "UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL", now(), u!.id),
      stmt(c.env.DB, "DELETE FROM sessions WHERE user_id = ?", u!.id),
    ]);
    return json({ ok: true });
  });

  /* ---------- Public data ---------- */
  r.get("/api/public/bootstrap", async (c) => {
    const today = now().slice(0, 10);
    const [settings, services, subs, ads, policies] = await Promise.all([
      getSettings(c.env),
      all<Record<string, unknown>>(c.env.DB, "SELECT id, name, description, icon, color, coin_price, sort_order FROM services WHERE active = 1 ORDER BY sort_order, name"),
      all<Record<string, unknown>>(c.env.DB, `SELECT s.id, s.service_id, s.name, s.description, s.icon, s.color, COALESCE(s.coin_price, p.coin_price) AS coin_price, s.delivery_mode, s.sort_order
                     FROM sub_services s JOIN services p ON p.id = s.service_id WHERE s.active = 1 AND p.active = 1 ORDER BY s.sort_order, s.name`),
      all<Record<string, unknown>>(c.env.DB, "SELECT id, title, sponsor, image_url, link, placement, audience, new_days, app, gift_kind, gift_value FROM ads WHERE active = 1 AND start_date <= ? AND end_date >= ? ORDER BY created_at DESC LIMIT 10", today, today),
      all<Record<string, unknown>>(c.env.DB, "SELECT id, title, body, audience, policy_type, version, placements, updated_at FROM policies WHERE published = 1 ORDER BY updated_at DESC"),
    ]);
    // English / Urdu apps: admin-entered content is machine-translated once and cached.
    const lang = langOf(c);
    if (lang !== "ar") {
      await Promise.all([
        translateRows(c.env, services, ["name", "description"], lang),
        translateRows(c.env, subs, ["name", "description"], lang),
        translateRows(c.env, ads, ["title"], lang),
        translateRows(c.env, policies, ["title", "body", "policy_type"], lang),
      ]);
    }
    return json({ settings: publicSettings(settings), services, sub_services: subs, ads, policies, regions: REGIONS });
  });

  r.get("/api/setup/status", async (c) => {
    const row = await first<{ n: number }>(c.env.DB, "SELECT COUNT(*) AS n FROM user_roles WHERE role = 'admin'");
    return json({ needs_admin: !row?.n });
  });

  /** First-run only: creates the owner account with username "admin". */
  r.post("/api/setup/admin", async (c) => {
    const row = await first<{ n: number }>(c.env.DB, "SELECT COUNT(*) AS n FROM user_roles WHERE role = 'admin'");
    if (row?.n) fail(409, "already_initialized", "تم إنشاء حساب المالك مسبقاً");
    const b = await readJson(c.req);
    const password = str(b, "password", { required: true, label: "كلمة المرور" });
    validatePassword(password);
    const name = str(b, "full_name", { max: 150 }) ?? "مالك التطبيق";
    const email = str(b, "email", { max: 255 });
    if (email && !validEmail(email)) fail(400, "invalid_email", "البريد الإلكتروني غير صحيح");
    const id = uid();
    await c.env.DB.batch([
      stmt(c.env.DB, "INSERT INTO users (id, username, email, full_name, password_hash) VALUES (?,?,?,?,?)", id, "admin", email, name, await hashPassword(c.env, password!)),
      stmt(c.env.DB, "INSERT INTO user_roles (user_id, role) VALUES (?, 'admin')", id),
    ]);
    const token = await createSession(c.env, id, "admin", c.req.headers.get("user-agent"));
    return json({ token, ...(await mePayload(c, id, "admin")) }, 201);
  });

  /* ---------- Registration: customer app ---------- */
  r.post("/api/auth/register/customer", async (c) => {
    await rateLimit(c.env, `register:${c.ip}`, 20, 60);
    const b = await readJson(c.req);
    const full_name = str(b, "full_name", { required: true, max: 150, min: 2, label: "الاسم" })!;
    const phone = normalizePhone(str(b, "phone", { required: true, label: "رقم الجوال" })!);
    if (!validSaudiPhone(phone)) fail(400, "invalid_phone", "رقم الجوال غير صحيح (05XXXXXXXX)");
    const email = str(b, "email", { required: true, max: 255, label: "البريد الإلكتروني" })!.toLowerCase();
    if (!validEmail(email)) fail(400, "invalid_email", "البريد الإلكتروني غير صحيح");
    const password = str(b, "password", { required: true, label: "كلمة المرور" });
    validatePassword(password);
    const region = oneOf(b, "region", REGIONS);
    if (await first(c.env.DB, "SELECT 1 FROM users WHERE email = ?", email)) fail(409, "email_taken", "هذا البريد مسجّل مسبقاً، سجّل الدخول");
    const id = uid();
    await c.env.DB.batch([
      stmt(c.env.DB, "INSERT INTO users (id, email, phone, full_name, region, password_hash, referral_code) VALUES (?,?,?,?,?,?,?)",
        id, email, phone, full_name, region, await hashPassword(c.env, password!), referralCodeFor(full_name)),
      stmt(c.env.DB, "INSERT INTO user_roles (user_id, role) VALUES (?, 'customer')", id),
    ]);
    const token = await createSession(c.env, id, "customer", c.req.headers.get("user-agent"));
    return json({ token, ...(await mePayload(c, id, "customer")) }, 201);
  });

  /* ---------- Registration: provider app (multipart with documents) ---------- */
  r.post("/api/auth/register/provider", async (c) => {
    await rateLimit(c.env, `register:${c.ip}`, 20, 60);
    let form: FormData;
    try { form = await c.req.formData(); } catch { return fail(400, "invalid_form", "بيانات النموذج غير صالحة"); }
    const full_name = formStr(form, "full_name");
    if (full_name.split(/\s+/).filter(Boolean).length < 3 || full_name.length > 150) fail(400, "invalid_name", "أدخل الاسم الثلاثي");
    const national_id = formStr(form, "national_id");
    if (!/^[12]\d{9}$/.test(national_id)) fail(400, "invalid_national_id", "رقم الهوية/الإقامة 10 أرقام يبدأ بـ 1 أو 2");
    const phone = normalizePhone(formStr(form, "phone"));
    if (!validSaudiPhone(phone)) fail(400, "invalid_phone", "رقم الجوال غير صحيح (05XXXXXXXX)");
    const nationality = formStr(form, "nationality").slice(0, 60) || null;
    const company_name = companyFor(form, nationality);
    const gender = formStr(form, "gender");
    if (!["male", "female"].includes(gender)) fail(400, "invalid_gender", "اختر الجنس");
    const region = formStr(form, "region");
    if (!REGIONS.includes(region as (typeof REGIONS)[number])) fail(400, "invalid_region", "اختر المدينة");
    const email = formStr(form, "email").toLowerCase();
    if (!validEmail(email) || email.length > 255) fail(400, "invalid_email", "البريد الإلكتروني غير صحيح");
    const password = formStr(form, "password");
    validatePassword(password);
    let services: string[] = [];
    try { services = (JSON.parse(formStr(form, "services") || "[]") as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 50); } catch { /* empty */ }
    if (services.length) {
      const valid = await all<{ id: string }>(c.env.DB, `SELECT id FROM services WHERE active = 1 AND id IN ${inList(services.length)}`, ...services);
      services = valid.map((v) => v.id);
    }
    if (!services.length) fail(400, "no_services", "اختر خدمة واحدة على الأقل");
    const idFile = formFile(form, "id_file");
    const certFile = formFile(form, "cert_file");
    if (!idFile) fail(400, "missing_id_file", "أرفق صورة الهوية / الإقامة");
    if (!certFile) fail(400, "missing_cert_file", "أرفق الشهادة");
    validateDoc(idFile!);
    validateDoc(certFile!);
    const avatarFile = formFile(form, "avatar_file");
    if (avatarFile) validateAvatar(avatarFile);
    if (await first(c.env.DB, "SELECT 1 FROM users WHERE email = ?", email)) fail(409, "email_taken", "هذا البريد مسجّل مسبقاً، سجّل الدخول من تطبيق مقدم الخدمة لإكمال طلبك");

    const id = uid();
    await run(c.env.DB,
      `INSERT INTO users (id, email, phone, full_name, region, gender, national_id, nationality, company_name, password_hash, verification_status, requested_services, referral_code)
       VALUES (?,?,?,?,?,?,?,?,?,?,'pending',?,?)`,
      id, email, phone, full_name, region, gender, national_id, nationality, company_name, await hashPassword(c.env, password), JSON.stringify(services), referralCodeFor(full_name));
    await saveProviderDoc(c, id, "id", idFile!);
    await saveProviderDoc(c, id, "certificate", certFile!);
    if (avatarFile) await run(c.env.DB, "UPDATE users SET avatar_url = ? WHERE id = ?", await savePublicImage(c, avatarFile), id);
    const token = await createSession(c.env, id, "provider", c.req.headers.get("user-agent"));
    return json({ token, ...(await mePayload(c, id, "provider")) }, 201);
  });

  /** An existing account (signed in to the provider app) applies to become a provider. */
  r.post("/api/provider/apply", async (c) => {
    const u = await requireUser(c, { app: "provider" });
    if (u.roles.includes("provider")) fail(409, "already_provider", "حسابك مفعّل كمقدم خدمة");
    if (u.verification_status === "pending") fail(409, "already_pending", "طلبك قيد المراجعة");
    const form = await c.req.formData();
    const national_id = formStr(form, "national_id");
    if (!/^[12]\d{9}$/.test(national_id)) fail(400, "invalid_national_id", "رقم الهوية/الإقامة 10 أرقام يبدأ بـ 1 أو 2");
    const gender = formStr(form, "gender");
    if (!["male", "female"].includes(gender)) fail(400, "invalid_gender", "اختر الجنس");
    const region = formStr(form, "region");
    if (!REGIONS.includes(region as (typeof REGIONS)[number])) fail(400, "invalid_region", "اختر المدينة");
    let services: string[] = [];
    try { services = (JSON.parse(formStr(form, "services") || "[]") as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 50); } catch { /* empty */ }
    if (services.length) services = (await all<{ id: string }>(c.env.DB, `SELECT id FROM services WHERE active = 1 AND id IN ${inList(services.length)}`, ...services)).map((v) => v.id);
    if (!services.length) fail(400, "no_services", "اختر خدمة واحدة على الأقل");
    const idFile = formFile(form, "id_file");
    const certFile = formFile(form, "cert_file");
    if (!idFile) fail(400, "missing_id_file", "أرفق صورة الهوية / الإقامة");
    if (!certFile) fail(400, "missing_cert_file", "أرفق الشهادة");
    validateDoc(idFile!);
    validateDoc(certFile!);
    const avatarFile = formFile(form, "avatar_file");
    if (avatarFile) validateAvatar(avatarFile);
    const nationality = formStr(form, "nationality").slice(0, 60) || null;
    const company_name = companyFor(form, nationality);
    await saveProviderDoc(c, u.id, "id", idFile!);
    await saveProviderDoc(c, u.id, "certificate", certFile!);
    if (avatarFile) await run(c.env.DB, "UPDATE users SET avatar_url = ? WHERE id = ?", await savePublicImage(c, avatarFile), u.id);
    await run(c.env.DB,
      "UPDATE users SET national_id = ?, nationality = ?, company_name = ?, gender = ?, region = ?, requested_services = ?, verification_status = 'pending', review_note = NULL, updated_at = ? WHERE id = ?",
      national_id, nationality, company_name, gender, region, JSON.stringify(services), now(), u.id);
    return json(await mePayload(c, u.id, "provider"));
  });

  /** Re-upload documents while an application is pending or rejected. */
  r.post("/api/provider/documents", async (c) => {
    const u = await requireUser(c, { app: "provider" });
    if (!["pending", "rejected"].includes(u.verification_status)) fail(409, "not_applicant", "لا يوجد طلب تسجيل مفتوح");
    const form = await c.req.formData();
    const idFile = formFile(form, "id_file");
    const certFile = formFile(form, "cert_file");
    if (idFile) validateDoc(idFile);
    if (certFile) validateDoc(certFile);
    let n = 0;
    if (idFile) { await saveProviderDoc(c, u.id, "id", idFile); n++; }
    if (certFile) { await saveProviderDoc(c, u.id, "certificate", certFile); n++; }
    if (!n) fail(400, "no_files", "أرفق ملفاً واحداً على الأقل");
    // Back to review once no latest document is still marked as rejected.
    const stillRejected = await first(c.env.DB,
      `SELECT 1 FROM provider_documents d WHERE d.user_id = ?1 AND d.status = 'rejected'
         AND d.created_at = (SELECT MAX(created_at) FROM provider_documents x WHERE x.user_id = ?1 AND x.kind = d.kind)`, u.id);
    if (u.verification_status === "rejected" && !stillRejected) await run(c.env.DB, "UPDATE users SET verification_status = 'pending', updated_at = ? WHERE id = ?", now(), u.id);
    return json(await mePayload(c, u.id, "provider"));
  });

  /* ---------- Sign in / out ---------- */
  r.post("/api/auth/login", async (c) => {
    const b = await readJson(c.req);
    const identifier = str(b, "identifier", { required: true, max: 255, label: "البريد أو اسم المستخدم أو رقم الجوال" })!.trim().toLowerCase();
    const password = str(b, "password", { required: true, max: 128, label: "كلمة المرور" })!;
    const app = oneOf(b, "app", ["customer", "provider", "admin"] as const, { required: true })!;
    const key = `login:${identifier}`;
    await rateLimit(c.env, key, 10, 15);
    await rateLimit(c.env, `login-ip:${c.ip}`, 60, 15);
    // Sign in with e-mail, username or mobile number. One phone may belong to two accounts (customer and
    // provider), so every account with that number is tried against the password.
    const phone = /^[+\d\s-]{9,16}$/.test(identifier) ? normalizePhone(identifier) : null;
    const candidates = await all<{ id: string; password_hash: string; is_active: number }>(c.env.DB,
      "SELECT id, password_hash, is_active FROM users WHERE email = ?1 OR username = ?1 OR (?2 IS NOT NULL AND phone = ?2) LIMIT 5", identifier, phone);
    let user: { id: string; password_hash: string; is_active: number } | null = null;
    for (const cand of candidates) {
      if (await verifyPassword(password, cand.password_hash)) { user = cand; break; }
    }
    if (!user) fail(401, "invalid_credentials", "بيانات الدخول أو كلمة المرور غير صحيحة");
    if (!user!.is_active) {
      const why = (await first<{ suspend_reason: string | null }>(c.env.DB, "SELECT suspend_reason FROM users WHERE id = ?", user!.id))?.suspend_reason;
      fail(403, "account_suspended", `تم تعليق هذا الحساب${why ? `: ${why}` : ""}. تواصل مع الدعم`);
    }
    const roles = (await all<{ role: string }>(c.env.DB, "SELECT role FROM user_roles WHERE user_id = ?", user!.id)).map((r) => r.role);
    if (app === "admin" && !roles.some((r) => r === "admin" || r === "staff")) fail(403, "not_admin", "هذا الحساب لا يملك صلاحية لوحة التحكم");
    if (app === "customer" && !roles.includes("customer")) await run(c.env.DB, "INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, 'customer')", user!.id);
    await clearRateLimit(c.env, key);
    const token = await createSession(c.env, user!.id, app, c.req.headers.get("user-agent"));
    await run(c.env.DB, "UPDATE users SET last_seen_at = ? WHERE id = ?", now(), user!.id);
    return json({ token, ...(await mePayload(c, user!.id, app)) });
  });

  r.post("/api/auth/logout", async (c) => {
    const h = c.req.headers.get("authorization") ?? "";
    if (h.startsWith("Bearer ")) {
      const u = await getUser(c);
      if (u?.app === "provider") await run(c.env.DB, "UPDATE users SET is_online = 0 WHERE id = ?", u.id);
      await destroySession(c.env, h.slice(7).trim());
    }
    return json({ ok: true });
  });

  r.get("/api/auth/me", async (c) => {
    const u = await getUser(c);
    if (!u) return json({ profile: null, roles: [], app: null }, 200);
    return json(await mePayload(c, u.id, u.app));
  });

  /* ---------- Own profile ---------- */
  r.patch("/api/me", async (c) => {
    const u = await requireUser(c);
    const b = await readJson(c.req);
    const sets: string[] = [];
    const vals: unknown[] = [];
    const name = str(b, "full_name", { max: 150, min: 2, label: "الاسم" });
    if (name) { sets.push("full_name = ?"); vals.push(name); }
    const phoneRaw = str(b, "phone", { max: 20 });
    if (phoneRaw) {
      const p = normalizePhone(phoneRaw);
      if (!validSaudiPhone(p)) fail(400, "invalid_phone", "رقم الجوال غير صحيح (05XXXXXXXX)");
      sets.push("phone = ?"); vals.push(p);
    }
    const region = oneOf(b, "region", REGIONS, { label: "المدينة" });
    if (region) { sets.push("region = ?"); vals.push(region); }
    const gender = oneOf(b, "gender", ["male", "female"] as const);
    if (gender) { sets.push("gender = ?"); vals.push(gender); }
    const bio = str(b, "bio", { max: 500 });
    if (bio !== null) { sets.push("bio = ?"); vals.push(bio); }
    const email = str(b, "email", { max: 255 });
    if (email) {
      const e = email.toLowerCase();
      if (!validEmail(e)) fail(400, "invalid_email", "البريد الإلكتروني غير صحيح");
      if (await first(c.env.DB, "SELECT 1 FROM users WHERE email = ? AND id <> ?", e, u.id)) fail(409, "email_taken", "البريد مستخدم في حساب آخر");
      sets.push("email = ?"); vals.push(e);
    }
    if (sets.length) await run(c.env.DB, `UPDATE users SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`, ...vals, now(), u.id);
    return json(await mePayload(c, u.id, u.app));
  });

  r.post("/api/me/password", async (c) => {
    const u = await requireUser(c);
    const b = await readJson(c.req);
    const current = str(b, "current", { required: true, label: "كلمة المرور الحالية" })!;
    const next = str(b, "next", { required: true, label: "كلمة المرور الجديدة" });
    validatePassword(next);
    const row = await first<{ password_hash: string }>(c.env.DB, "SELECT password_hash FROM users WHERE id = ?", u.id);
    if (!row || !(await verifyPassword(current, row.password_hash))) fail(400, "wrong_password", "كلمة المرور الحالية غير صحيحة");
    await run(c.env.DB, "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", await hashPassword(c.env, next!), now(), u.id);
    return json({ ok: true });
  });

  /** Permanent account deletion (App Store / Google Play requirement). */
  r.post("/api/me/delete", async (c) => {
    const u = await requireUser(c);
    const b = await readJson(c.req);
    const password = str(b, "password", { required: true, label: "كلمة المرور" })!;
    const row = await first<{ password_hash: string }>(c.env.DB, "SELECT password_hash FROM users WHERE id = ?", u.id);
    if (!row || !(await verifyPassword(password, row.password_hash))) fail(400, "wrong_password", "كلمة المرور غير صحيحة");
    if (u.roles.includes("admin")) {
      const admins = await first<{ n: number }>(c.env.DB, "SELECT COUNT(*) AS n FROM user_roles WHERE role = 'admin'");
      if ((admins?.n ?? 0) <= 1) fail(409, "last_admin", "لا يمكن حذف حساب المالك الوحيد");
    }
    const active = await first<{ n: number }>(c.env.DB, "SELECT COUNT(*) AS n FROM orders WHERE (customer_id = ?1 OR provider_id = ?1) AND status IN ('accepted','arrived','in_progress')", u.id);
    if (active?.n) fail(409, "active_orders", "أكمل أو ألغِ طلباتك الجارية قبل حذف الحساب");
    const docs = await all<{ r2_key: string }>(c.env.DB, "SELECT r2_key FROM provider_documents WHERE user_id = ?", u.id);
    await deleteFiles(c.env, docs.map((d) => d.r2_key));
    const t = now();
    await c.env.DB.batch([
      stmt(c.env.DB, "UPDATE orders SET status = 'cancelled', cancelled_by = 'customer', cancel_reason = 'حذف الحساب', cancelled_at = ? WHERE customer_id = ? AND status = 'pending'", t, u.id),
      stmt(c.env.DB, "DELETE FROM users WHERE id = ?", u.id),
    ]);
    return json({ ok: true });
  });

  /* ---------- Addresses ---------- */
  r.get("/api/me/addresses", async (c) => {
    const u = await requireUser(c);
    return json(await all(c.env.DB, "SELECT id, label, address, region, lat, lng, is_default FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at", u.id));
  });
  r.post("/api/me/addresses", async (c) => {
    const u = await requireUser(c);
    const b = await readJson(c.req);
    const label = str(b, "label", { required: true, max: 60, label: "اسم العنوان" })!;
    const address = str(b, "address", { required: true, max: 300, label: "تفاصيل العنوان" })!;
    const region = oneOf(b, "region", REGIONS, { required: true, label: "المدينة" });
    const lat = num(b, "lat", { min: -90, max: 90 });
    const lng = num(b, "lng", { min: -180, max: 180 });
    const count = await first<{ n: number }>(c.env.DB, "SELECT COUNT(*) AS n FROM addresses WHERE user_id = ?", u.id);
    if ((count?.n ?? 0) >= 20) fail(400, "too_many", "الحد الأقصى 20 عنواناً");
    const makeDefault = bool(b, "is_default") || !count?.n;
    const id = uid();
    await c.env.DB.batch([
      ...(makeDefault ? [stmt(c.env.DB, "UPDATE addresses SET is_default = 0 WHERE user_id = ?", u.id)] : []),
      stmt(c.env.DB, "INSERT INTO addresses (id, user_id, label, address, region, lat, lng, is_default) VALUES (?,?,?,?,?,?,?,?)", id, u.id, label, address, region, lat, lng, makeDefault ? 1 : 0),
      ...(makeDefault && region ? [stmt(c.env.DB, "UPDATE users SET region = ? WHERE id = ?", region, u.id)] : []),
    ]);
    return json({ id }, 201);
  });
  r.post("/api/me/addresses/:id/default", async (c) => {
    const u = await requireUser(c);
    const a = await first<{ region: string | null }>(c.env.DB, "SELECT region FROM addresses WHERE id = ? AND user_id = ?", c.params.id, u.id);
    if (!a) fail(404, "not_found", "العنوان غير موجود");
    await c.env.DB.batch([
      stmt(c.env.DB, "UPDATE addresses SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END WHERE user_id = ?", c.params.id, u.id),
      ...(a!.region ? [stmt(c.env.DB, "UPDATE users SET region = ? WHERE id = ?", a!.region, u.id)] : []),
    ]);
    return json({ ok: true });
  });
  r.delete("/api/me/addresses/:id", async (c) => {
    const u = await requireUser(c);
    await run(c.env.DB, "DELETE FROM addresses WHERE id = ? AND user_id = ?", c.params.id, u.id);
    return json({ ok: true });
  });

  /* ---------- Favorites (sub-services) ---------- */
  r.get("/api/me/favorites", async (c) => {
    const u = await requireUser(c);
    return json((await all<{ sub_service_id: string }>(c.env.DB, "SELECT sub_service_id FROM favorites WHERE user_id = ? ORDER BY created_at", u.id)).map((x) => x.sub_service_id));
  });
  r.put("/api/me/favorites", async (c) => {
    const u = await requireUser(c);
    const ids = strArray(await readJson(c.req), "ids", 60);
    const valid = ids.length ? (await all<{ id: string }>(c.env.DB, `SELECT id FROM sub_services WHERE id IN ${inList(ids.length)}`, ...ids)).map((x) => x.id) : [];
    await c.env.DB.batch([
      stmt(c.env.DB, "DELETE FROM favorites WHERE user_id = ?", u.id),
      ...valid.map((id) => stmt(c.env.DB, "INSERT OR IGNORE INTO favorites (user_id, sub_service_id) VALUES (?,?)", u.id, id)),
    ]);
    return json(valid);
  });

  /* ---------- Notifications ---------- */
  r.get("/api/me/notifications", async (c) => {
    const u = await requireUser(c);
    const created = (await first<{ created_at: string }>(c.env.DB, "SELECT created_at FROM users WHERE id = ?", u.id))?.created_at ?? "";
    const aud = u.app === "provider" ? "providers" : u.app === "customer" ? "customers" : "none";
    const rows = await all(c.env.DB,
      `SELECT n.id, n.title, n.body, n.category, n.icon, n.accent_color, n.link, n.sound, COALESCE(n.scheduled_at, n.sent_at) AS at,
              CASE WHEN r.user_id IS NULL THEN 0 ELSE 1 END AS read
         FROM notifications n
         LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = ?1
        WHERE COALESCE(n.scheduled_at, n.sent_at) <= ?2
          AND ((n.audience = 'specific' AND EXISTS (SELECT 1 FROM notification_targets t WHERE t.notification_id = n.id AND t.user_id = ?1))
               OR (n.audience IN ('all', ?3) AND n.sent_at >= ?4))
        ORDER BY at DESC LIMIT 60`,
      u.id, now(), aud, addDaysSafe(created, -14));
    const lang = await rememberLang(c, u.id);
    return json(await translateRows(c.env, rows as Record<string, unknown>[], ["title", "body"], lang));
  });
  r.post("/api/me/notifications/read", async (c) => {
    const u = await requireUser(c);
    const ids = strArray(await readJson(c.req), "ids", 100);
    if (ids.length) await c.env.DB.batch(ids.map((id) => stmt(c.env.DB, "INSERT OR IGNORE INTO notification_reads (notification_id, user_id) SELECT id, ? FROM notifications WHERE id = ?", u.id, id)));
    return json({ ok: true });
  });

  /* ---------- Profile photo ---------- */
  r.post("/api/me/avatar", async (c) => {
    const u = await requireUser(c);
    let form: FormData;
    try { form = await c.req.formData(); } catch { return fail(400, "invalid_form", "بيانات النموذج غير صالحة"); }
    const file = formFile(form, "file");
    if (!file) fail(400, "no_file", "اختر صورة");
    if (file!.type === "image/svg+xml") fail(400, "invalid_file", "الصورة يجب أن تكون PNG أو JPG أو WEBP");
    const url = await savePublicImage(c, file!, 3 * 1024 * 1024);
    await run(c.env.DB, "UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ?", url, now(), u.id);
    return json(await mePayload(c, u.id, u.app));
  });

  /* ---------- Push notification devices ---------- */
  r.post("/api/me/push-token", async (c) => {
    const u = await requireUser(c, { app: ["customer", "provider"] });
    const b = await readJson(c.req);
    const token = str(b, "token", { required: true, max: 4096, label: "token" })!;
    const platform = oneOf(b, "platform", ["android", "ios"] as const) ?? "android";
    await run(c.env.DB,
      `INSERT INTO push_tokens (token, user_id, app, platform) VALUES (?,?,?,?)
       ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, app = excluded.app, platform = excluded.platform, updated_at = ?`,
      token, u.id, u.app, platform, now());
    return json({ ok: true });
  });
  r.post("/api/me/push-token/delete", async (c) => {
    const token = str(await readJson(c.req), "token", { max: 4096 });
    if (token) await run(c.env.DB, "DELETE FROM push_tokens WHERE token = ?", token);
    return json({ ok: true });
  });

  /* ---------- Messages with administration (not order chat) ---------- */
  r.get("/api/me/messages", async (c) => {
    const u = await requireUser(c);
    return json(await all(c.env.DB,
      `SELECT m.id, m.subject, m.body, m.created_at, m.sender_id, m.recipient_id, m.read_at, s.full_name AS sender_name
         FROM messages m LEFT JOIN users s ON s.id = m.sender_id
        WHERE m.order_id IS NULL AND (m.recipient_id = ?1 OR m.sender_id = ?1) ORDER BY m.created_at DESC LIMIT 50`, u.id));
  });
  r.post("/api/me/messages", async (c) => {
    const u = await requireUser(c);
    const b = await readJson(c.req);
    const body = str(b, "body", { required: true, max: 2000, label: "الرسالة" })!;
    // Goes into the user's conversation with the administration (see routes/support.ts).
    return json({ id: await userWrites(c, u.id, body, str(b, "subject", { max: 200 })) }, 201);
  });
  r.post("/api/me/messages/:id/read", async (c) => {
    const u = await requireUser(c);
    await run(c.env.DB, "UPDATE messages SET read_at = ? WHERE id = ? AND recipient_id = ? AND read_at IS NULL", now(), c.params.id, u.id);
    return json({ ok: true });
  });

  /* ---------- Applicant documents (own) ---------- */
  r.get("/api/me/documents", async (c) => {
    const u = await requireUser(c);
    const docs = await all<{ id: string; kind: string; r2_key: string; created_at: string; status: string; note: string | null }>(c.env.DB, "SELECT id, kind, r2_key, created_at, status, note FROM provider_documents WHERE user_id = ? ORDER BY created_at DESC", u.id);
    return json(await Promise.all(docs.map(async (d) => ({ id: d.id, kind: d.kind, created_at: d.created_at, status: d.status, note: d.note, url: `${c.url.origin}${await signFileUrl(c.env, d.r2_key)}` }))));
  });

  /* ---------- Files ---------- */
  r.get("/api/files/public/:name", async (c) => {
    if (!/^[\w-]+\.(png|jpg|webp|svg)$/.test(c.params.name)) fail(404, "not_found");
    const obj = await getFile(c.env, `public/${c.params.name}`);
    if (!obj) return fail(404, "not_found");
    const h = new Headers({ "content-type": obj.contentType });
    h.set("cache-control", "public, max-age=31536000, immutable");
    if (c.params.name.endsWith(".svg")) h.set("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'");
    return new Response(obj.body, { headers: h });
  });
  r.get("/api/files/doc", async (c) => {
    const k = c.url.searchParams.get("k") ?? "";
    if (!/^(docs|letters|orders|chat)\//.test(k) || !(await verifyFileSignature(c.env, k, c.url.searchParams.get("e") ?? "", c.url.searchParams.get("s") ?? ""))) fail(403, "forbidden", "الرابط منتهي أو غير صالح");
    const obj = await getFile(c.env, k);
    if (!obj) return fail(404, "not_found");
    const h = new Headers({ "content-type": obj.contentType });
    h.set("cache-control", "private, no-store");
    h.set("content-disposition", "inline");
    return new Response(obj.body, { headers: h });
  });
}

function addDaysSafe(iso: string, days: number) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t + days * 86400000).toISOString() : "1970-01-01T00:00:00.000Z";
}
