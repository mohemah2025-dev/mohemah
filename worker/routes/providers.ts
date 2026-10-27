/**
 * Provider services requests (add a service with a certificate), working periods, the experience letter,
 * the admin provider profile (performance, shifts, ratings, customers) and account actions
 * (suspend / reactivate / delete with a reason and an attached letter).
 */
import { all, fail, first, json, now, run, stmt, str, uid, type Ctx, type Router } from "../lib/core";
import { requireFeature, requirePerm, requireProvider, requireUser, signFileUrl, verifyFileSignature } from "../lib/auth";
import { getSettings, notifyStmts, safeJson } from "../lib/domain";
import { deleteFiles, putFile } from "../lib/storage";
import { notifyExternal } from "../lib/messaging";
import { DOC_TYPES, formFile, validateDoc } from "./account";
import qrcode from "qrcode-generator";

const DAY = 86400000;
const riyadhDay = (iso: string) => new Date(Date.parse(iso) + 3 * 3600000).toISOString().slice(0, 10);

async function approvedIds(c: Ctx, providerId: string): Promise<string[]> {
  const row = await first<{ approved_services: string | null }>(c.env.DB, "SELECT approved_services FROM users WHERE id = ?", providerId);
  const list = safeJson<unknown[]>(row?.approved_services ?? null, []).filter((x): x is string => typeof x === "string");
  if (row?.approved_services) return list;
  return (await all<{ service_id: string }>(c.env.DB, "SELECT service_id FROM provider_services WHERE provider_id = ?", providerId)).map((x) => x.service_id);
}

/** Hours worked from online periods, grouped by day / month / year (Riyadh time). */
async function shiftSummary(c: Ctx, providerId: string, online: boolean) {
  const since = new Date(Date.now() - 400 * DAY).toISOString();
  const rows = await all<{ started_at: string; ended_at: string | null }>(c.env.DB,
    "SELECT started_at, ended_at FROM provider_shifts WHERE provider_id = ? AND started_at >= ? ORDER BY started_at", providerId, since);
  const nowMs = Date.now();
  const byDay: Record<string, number> = {};
  const list = rows.map((r) => {
    // An open period counts until now while the provider is still online (capped at 16 hours).
    const end = r.ended_at ? Date.parse(r.ended_at) : online ? nowMs : Date.parse(r.started_at);
    const hours = Math.max(0, Math.min(16, (end - Date.parse(r.started_at)) / 3600000));
    const d = riyadhDay(r.started_at);
    byDay[d] = (byDay[d] ?? 0) + hours;
    return { started_at: r.started_at, ended_at: r.ended_at, hours: Math.round(hours * 100) / 100 };
  });
  const byMonth: Record<string, { hours: number; days: number }> = {};
  const byYear: Record<string, { hours: number; days: number }> = {};
  for (const [d, h] of Object.entries(byDay)) {
    const m = (byMonth[d.slice(0, 7)] ||= { hours: 0, days: 0 });
    m.hours += h; m.days += 1;
    const y = (byYear[d.slice(0, 4)] ||= { hours: 0, days: 0 });
    y.hours += h; y.days += 1;
  }
  const r1 = (x: number) => Math.round(x * 10) / 10;
  const today = riyadhDay(new Date().toISOString());
  const thisMonth = today.slice(0, 7);
  return {
    today_hours: r1(byDay[today] ?? 0),
    month: { hours: r1(byMonth[thisMonth]?.hours ?? 0), days: byMonth[thisMonth]?.days ?? 0 },
    year: { hours: r1(byYear[today.slice(0, 4)]?.hours ?? 0), days: byYear[today.slice(0, 4)]?.days ?? 0 },
    total: { hours: r1(Object.values(byDay).reduce((a, b) => a + b, 0)), days: Object.keys(byDay).length },
    daily: Object.entries(byDay).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 31).map(([day, h]) => ({ day, hours: r1(h) })),
    monthly: Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12).map(([month, v]) => ({ month, hours: r1(v.hours), days: v.days })),
    yearly: Object.entries(byYear).sort((a, b) => b[0].localeCompare(a[0])).map(([year, v]) => ({ year, hours: r1(v.hours), days: v.days })),
    recent: list.reverse().slice(0, 40),
  };
}

function esc(v: unknown) {
  return String(v ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
}

const LETTER_FONT = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">`;

function qrSvg(text: string, color: string) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let d = "";
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) d += `M${x} ${y}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${n + 4} ${n + 4}" width="116" height="116" shape-rendering="crispEdges"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${d}" fill="${color}"/></svg>`;
}

/** The letter itself (`verify` = the public check page reached by the QR code). */
async function letterPage(c: Ctx, ref: string, verify: boolean) {
  const L = await first<{ ref: string; provider_id: string; provider_name: string | null; period_from: string | null; period_to: string; completed: number; rating: number | null; services: string; issued_at: string }>(c.env.DB,
    "SELECT * FROM experience_letters WHERE ref = ?", ref);
  const s = await getSettings(c.env);
  const color = /^#[0-9a-f]{6}$/i.test(s.primary_color ?? "") ? s.primary_color! : "#2B6CD9";
  const html = (body: string, title: string) => new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>${LETTER_FONT}
<style>
*{box-sizing:border-box}body{margin:0;background:#eef1f6;font-family:Cairo,Tahoma,Arial,sans-serif;color:#1b2430}
.page{max-width:780px;margin:24px auto;background:#fff;padding:44px 44px 36px;border-radius:14px;box-shadow:0 4px 24px rgba(0,0,0,.08);position:relative;overflow:hidden}
.page:before{content:"";position:absolute;inset:0 0 auto 0;height:8px;background:linear-gradient(90deg,${color},${color}99)}
.head{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid ${color}33;padding-bottom:16px;gap:16px}
.brand{display:flex;align-items:center;gap:12px}.brand img{width:64px;height:64px;object-fit:contain}
.brand b{font-size:21px;font-weight:800;color:${color}}.meta{font-size:12.5px;color:#5b6573;text-align:left;line-height:2}
h1{text-align:center;font-size:24px;font-weight:800;margin:30px 0 22px;color:${color}}p,li{font-size:15.5px;line-height:2.15}
.box{background:${color}0d;border:1px solid ${color}33;border-radius:12px;padding:12px 16px;margin:16px 0;font-size:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:6px}
.box b{display:block;font-size:16px;color:${color}}
.foot{margin-top:40px;display:flex;justify-content:space-between;align-items:flex-end;gap:16px}
.sign{text-align:center;font-size:13px}.sign span{display:block;width:170px;border-bottom:2px solid #9aa3af;padding-bottom:4px;margin-bottom:6px}
.qr{text-align:center;font-size:11px;color:#5b6573}.qr div{border:1px solid #e3e7ee;border-radius:10px;padding:6px;display:inline-block}
.ok{display:flex;align-items:center;gap:10px;background:#e8f8ef;color:#137a3f;border:1px solid #b9e7cb;border-radius:12px;padding:12px 16px;font-weight:700;margin-bottom:16px}
.bad{background:#fdecec;color:#b42318;border-color:#f6c4c0}
.btn{display:block;margin:16px auto 32px;max-width:780px;padding:14px;border:0;border-radius:12px;background:${color};color:#fff;font-family:inherit;font-size:16px;font-weight:700;width:calc(100% - 32px);cursor:pointer}
@media print{body{background:#fff}.page{box-shadow:none;margin:0;border-radius:0}.btn,.noprint{display:none}}
</style></head><body>${body}</body></html>`, { status: L ? 200 : 404, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });

  if (!L) return html(`<div class="page"><div class="ok bad">✕ لم يُعثر على خطاب بهذا المرجع (${esc(ref)}). قد يكون الخطاب غير صادر من تطبيق ${esc(s.app_name)}.</div></div>`, "التحقق من خطاب");

  const u = await first<{ gender: string | null }>(c.env.DB, "SELECT gender FROM users WHERE id = ?", L.provider_id);
  const female = u?.gender === "female";
  const fmt = (d: string | Date) => new Date(d).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "long", year: "numeric" });
  const from = L.period_from ?? L.issued_at;
  const months = Math.max(0, Math.round((Date.parse(L.period_to) - Date.parse(from)) / (30.44 * DAY)));
  const services = safeJson<string[]>(L.services, []);
  const logoSrc = s.logo_url ?? s.app_logo_url;
  const logo = logoSrc ? (logoSrc.startsWith("/") ? `${c.url.origin}${logoSrc}` : logoSrc) : "";
  const verifyUrl = `${c.url.origin}/api/letters/verify/${L.ref}`;
  const banner = verify ? `<div class="ok">✓ خطاب صحيح صادر من تطبيق ${esc(s.app_name)} بتاريخ ${esc(fmt(L.issued_at))} — المرجع ${esc(L.ref)}</div>` : "";
  return html(`<div class="page">${banner}
<div class="head"><div class="brand">${logo ? `<img src="${esc(logo)}" alt="">` : ""}<div><b>تطبيق ${esc(s.app_name)}</b><div style="font-size:12px;color:#5b6573">منصة الخدمات الموثوقة</div></div></div>
<div class="meta">التاريخ: ${esc(fmt(L.issued_at))}<br>المرجع: <b dir="ltr">${esc(L.ref)}</b></div></div>
<h1>خطاب إثبات خبرة</h1>
<p>السلام عليكم ورحمة الله وبركاته،،</p>
<p>تشهد إدارة <b>تطبيق ${esc(s.app_name)}</b> بأن ${female ? "السيدة" : "السيد"}/ <b>${esc(L.provider_name)}</b> ${female ? "قد عملت" : "قد عمل"} عبر التطبيق كمقدم خدمة خلال الفترة من <b>${esc(fmt(from))}</b> إلى <b>${esc(fmt(L.period_to))}</b>، ${female ? "وأنجزت" : "وأنجز"} خلالها عدد <b>(${L.completed})</b> طلب خدمة${L.rating ? `، بتقييم متوسط بلغ <b>(${Number(L.rating).toFixed(1)} من 5)</b>` : ""}${services.length ? "، في مجالات الأعمال التالية:" : "."}</p>
${services.length ? `<ul>${services.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
<div class="box"><div>مدة الفترة<b>${Math.floor(months / 12)} سنة و${months % 12} شهر</b></div><div>الطلبات المنجزة<b>${L.completed}</b></div><div>متوسط التقييم<b>${L.rating ? `${Number(L.rating).toFixed(1)} / 5` : "—"}</b></div></div>
<p>وقد مُنح هذا الخطاب بناءً على ${female ? "طلبها" : "طلبه"} ليُستخدم لما ${female ? "تراه" : "يراه"} مناسباً.</p>
<p style="margin-top:18px">والله ولي التوفيق،،</p>
<div class="foot"><div class="sign"><span>ختم وتوقيع</span><b>إدارة تطبيق ${esc(s.app_name)}</b></div>
<div class="qr"><div>${qrSvg(verifyUrl, "#1b2430")}</div><br>امسح الرمز للتحقق من صحة الخطاب<br><span dir="ltr">${esc(L.ref)}</span></div></div>
</div>
${verify ? "" : `<button class="btn" onclick="window.print()">طباعة / حفظ PDF</button>`}`, `خطاب خبرة — ${L.provider_name ?? ""}`);
}

export function registerProviderRoutes(r: Router) {
  /* =================== Provider app =================== */

  /** Approved services (with on/off), add-service requests and the services that can still be requested. */
  r.get("/api/provider/my-services", async (c) => {
    const u = await requireUser(c, { app: "provider" });
    const [approved, enabled, services, requests] = await Promise.all([
      approvedIds(c, u.id),
      all<{ service_id: string }>(c.env.DB, "SELECT service_id FROM provider_services WHERE provider_id = ?", u.id),
      all<{ id: string; name: string; icon: string | null; color: string | null }>(c.env.DB, "SELECT id, name, icon, color FROM services WHERE active = 1 ORDER BY sort_order, name"),
      all<{ id: string; service_id: string; status: string; note: string | null; admin_note: string | null; created_at: string; reviewed_at: string | null }>(c.env.DB,
        "SELECT id, service_id, status, note, admin_note, created_at, reviewed_at FROM service_requests WHERE provider_id = ? ORDER BY created_at DESC LIMIT 50", u.id),
    ]);
    const on = new Set(enabled.map((x) => x.service_id));
    const ok = new Set(approved);
    const pending = new Set(requests.filter((x) => x.status === "pending").map((x) => x.service_id));
    const name = Object.fromEntries(services.map((s) => [s.id, s.name]));
    return json({
      approved: services.filter((s) => ok.has(s.id)).map((s) => ({ ...s, enabled: on.has(s.id) })),
      requestable: services.filter((s) => !ok.has(s.id) && !pending.has(s.id)),
      requests: requests.map((x) => ({ ...x, service_name: name[x.service_id] ?? "—" })),
    });
  });

  /** Ask the administration to add a service (multipart: service_id, note, doc_file). */
  r.post("/api/provider/service-requests", async (c) => {
    const u = await requireProvider(c);
    const form = await c.req.formData();
    const serviceId = String(form.get("service_id") ?? "").trim();
    const note = String(form.get("note") ?? "").trim().slice(0, 500) || null;
    const file = formFile(form, "doc_file");
    if (!serviceId) fail(400, "missing_service", "اختر الخدمة");
    if (!file) fail(400, "missing_doc", "أرفق الشهادة أو إثبات الخبرة");
    validateDoc(file!);
    if (!(await first(c.env.DB, "SELECT 1 FROM services WHERE id = ? AND active = 1", serviceId))) fail(404, "service_unavailable", "الخدمة غير متاحة");
    if ((await approvedIds(c, u.id)).includes(serviceId)) fail(409, "already_approved", "هذه الخدمة معتمدة لك مسبقاً");
    if (await first(c.env.DB, "SELECT 1 FROM service_requests WHERE provider_id = ? AND service_id = ? AND status = 'pending'", u.id, serviceId)) fail(409, "already_pending", "لديك طلب قيد المراجعة لهذه الخدمة");
    const id = uid();
    const key = `docs/${u.id}/service-${id}.${DOC_TYPES[file!.type]}`;
    await putFile(c.env, key, file!);
    await run(c.env.DB, "INSERT INTO service_requests (id, provider_id, service_id, note, doc_key, doc_type) VALUES (?,?,?,?,?,?)", id, u.id, serviceId, note, key, file!.type);
    return json({ id }, 201);
  });

  /**
   * Issues an experience letter for the whole period, a date range (from–to) or up to a given date.
   * Every letter gets a reference number and a QR code that opens the public verification page.
   */
  r.get("/api/provider/experience-letter", async (c) => {
    const u = await requireProvider(c);
    const q = c.url.searchParams;
    const day = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null);
    const me = await first<{ full_name: string | null; created_at: string; reviewed_at: string | null }>(c.env.DB, "SELECT full_name, created_at, reviewed_at FROM users WHERE id = ?", u.id);
    const joined = (me!.reviewed_at ?? me!.created_at).slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    let from = day(q.get("from")) ?? joined;
    let to = day(q.get("to")) ?? day(q.get("date")) ?? today;
    if (to < joined) fail(400, "before_joining", "الفترة المختارة قبل تاريخ انضمامك للتطبيق");
    if (from < joined) from = joined;
    if (to > today) to = today;
    if (from > to) fail(400, "invalid_period", "تاريخ البداية بعد تاريخ النهاية");
    const end = new Date(Date.parse(to) + DAY).toISOString();
    const [done, rating, services] = await Promise.all([
      first<{ n: number }>(c.env.DB, "SELECT COUNT(*) AS n FROM orders WHERE provider_id = ? AND status = 'completed' AND completed_at >= ? AND completed_at < ?", u.id, from, end),
      first<{ r: number | null }>(c.env.DB, "SELECT AVG(rating) AS r FROM orders WHERE provider_id = ? AND status = 'completed' AND rating IS NOT NULL AND completed_at >= ? AND completed_at < ?", u.id, from, end),
      all<{ name: string }>(c.env.DB, "SELECT DISTINCT service_name AS name FROM orders WHERE provider_id = ? AND status = 'completed' AND completed_at >= ? AND completed_at < ?", u.id, from, end),
    ]);
    if (!done?.n) fail(409, "no_completed_orders", "لا توجد طلبات مكتملة في الفترة المختارة، يُصدر الخطاب بعد إكمال طلب واحد على الأقل");
    const ref = `MHM-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase().padStart(7, "0").slice(-7)}`;
    await run(c.env.DB, "INSERT INTO experience_letters (ref, provider_id, provider_name, period_from, period_to, completed, rating, services) VALUES (?,?,?,?,?,?,?,?)",
      ref, u.id, me!.full_name, from, to, done!.n, rating?.r ?? null, JSON.stringify(services.map((x) => x.name)));
    const signed = await signFileUrl(c.env, `letter:${ref}`, 900);
    return json({ url: `${c.url.origin}/api/letters/experience?${signed.split("?")[1]}`, ref, from, to });
  });

  r.get("/api/letters/experience", async (c) => {
    const k = c.url.searchParams.get("k") ?? "";
    if (!k.startsWith("letter:") || !(await verifyFileSignature(c.env, k, c.url.searchParams.get("e") ?? "", c.url.searchParams.get("s") ?? ""))) {
      return new Response("الرابط منتهي، افتح الخطاب من التطبيق مرة أخرى", { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } });
    }
    return letterPage(c, k.slice(7), false);
  });

  /** Public verification page opened by the QR code (or by typing the reference). */
  r.get("/api/letters/verify/:ref", async (c) => letterPage(c, c.params.ref.toUpperCase(), true));

  /* =================== Administration =================== */

  r.get("/api/admin/service-requests", async (c) => {
    await requirePerm(c, "providers", "view");
    const status = c.url.searchParams.get("status") ?? "pending";
    return json(await all(c.env.DB,
      `SELECT r.id, r.provider_id, r.service_id, r.status, r.note, r.created_at, u.full_name AS provider_name, s.name AS service_name
         FROM service_requests r JOIN users u ON u.id = r.provider_id JOIN services s ON s.id = r.service_id
        WHERE r.status = ? ORDER BY r.created_at DESC LIMIT 200`, status));
  });

  r.post("/api/admin/service-requests/:id/review", async (c) => {
    const admin = await requirePerm(c, "providers", "edit");
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const approve = b.approve === true;
    const note = typeof b.note === "string" ? b.note.trim().slice(0, 300) || null : null;
    if (!approve && !note) fail(400, "missing_note", "اكتب سبب عدم القبول");
    const req = await first<{ provider_id: string; service_id: string; status: string }>(c.env.DB, "SELECT provider_id, service_id, status FROM service_requests WHERE id = ?", c.params.id);
    if (!req) fail(404, "not_found", "الطلب غير موجود");
    if (req!.status !== "pending") fail(409, "already_reviewed", "تمت مراجعة هذا الطلب");
    const svc = await first<{ name: string }>(c.env.DB, "SELECT name FROM services WHERE id = ?", req!.service_id);
    const t = now();
    const ids = [...new Set([...(await approvedIds(c, req!.provider_id)), ...(approve ? [req!.service_id] : [])])];
    await c.env.DB.batch([
      stmt(c.env.DB, "UPDATE service_requests SET status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?", approve ? "approved" : "rejected", note, admin.id, t, c.params.id),
      ...(approve ? [
        stmt(c.env.DB, "UPDATE users SET approved_services = ? WHERE id = ?", JSON.stringify(ids), req!.provider_id),
        stmt(c.env.DB, "INSERT OR IGNORE INTO provider_services (provider_id, service_id) VALUES (?,?)", req!.provider_id, req!.service_id),
      ] : []),
      ...notifyStmts(c, [req!.provider_id], approve
        ? { title: "تمت إضافة خدمة لك", body: `اعتمدت الإدارة خدمة «${svc?.name ?? ""}» وأصبحت مفعّلة في خدماتك.`, link: "/provider/account", icon: "CheckCircle2", category: "general", created_by: admin.id }
        : { title: "طلب إضافة خدمة", body: `لم تُعتمد خدمة «${svc?.name ?? ""}»: ${note}`, link: "/provider/account", icon: "XCircle", category: "general", created_by: admin.id }),
    ]);
    return json({ ok: true });
  });

  /** Everything about one provider for the admin profile page. */
  r.get("/api/admin/providers/:id/profile", async (c) => {
    await requirePerm(c, ["providers", "analytics"], "view");
    const id = c.params.id;
    const days = Math.min(3650, Math.max(1, Number(c.url.searchParams.get("days") ?? 30) || 30));
    const from = new Date(Date.now() - days * DAY).toISOString();
    const stale = new Date(Date.now() - 30 * 60000).toISOString();
    const u = await first<Record<string, unknown> & { id: string; is_online: number; is_active: number }>(c.env.DB,
      `SELECT id, member_no, full_name, phone, email, region, gender, nationality, company_name, avatar_url, rating, rating_count, coin_balance, is_active, is_online,
              verification_status, suspend_reason, created_at, reviewed_at, last_seen_at FROM users WHERE id = ?`, id);
    if (!u) fail(404, "not_found", "مقدم الخدمة غير موجود");
    // Opening the profile counts as reviewing the provider's performance notes (clears the admin counter).
    await run(c.env.DB, "UPDATE users SET perf_reviewed_at = ? WHERE id = ?", now(), id);
    const [approved, enabled, services, requests, perf, reasons, ratings, customers, actions, shifts] = await Promise.all([
      approvedIds(c, id),
      all<{ service_id: string }>(c.env.DB, "SELECT service_id FROM provider_services WHERE provider_id = ?", id),
      all<{ id: string; name: string; icon: string | null; color: string | null }>(c.env.DB, "SELECT id, name, icon, color FROM services ORDER BY sort_order, name"),
      all<{ id: string; service_id: string; status: string; note: string | null; admin_note: string | null; doc_key: string | null; created_at: string }>(c.env.DB,
        "SELECT id, service_id, status, note, admin_note, doc_key, created_at FROM service_requests WHERE provider_id = ? ORDER BY created_at DESC LIMIT 50", id),
      first<{ offered: number; accepted_now: number; released: number; rejected: number; ignored: number; completed: number; customer_cancelled: number; warnings: number }>(c.env.DB,
        `SELECT (SELECT COUNT(*) FROM (SELECT order_id FROM order_offers WHERE provider_id = ?1 AND offered_at >= ?2
                   UNION SELECT order_id FROM order_rejections WHERE provider_id = ?1 AND created_at >= ?2
                   UNION SELECT id FROM orders WHERE provider_id = ?1 AND accepted_at >= ?2)) AS offered,
                (SELECT COUNT(*) FROM orders WHERE provider_id = ?1 AND accepted_at >= ?2) AS accepted_now,
                (SELECT COUNT(*) FROM order_rejections WHERE provider_id = ?1 AND kind = 'release' AND created_at >= ?2) AS released,
                (SELECT COUNT(*) FROM order_rejections WHERE provider_id = ?1 AND kind = 'reject' AND created_at >= ?2) AS rejected,
                (SELECT COUNT(*) FROM order_offers f JOIN orders o ON o.id = f.order_id
                   WHERE f.provider_id = ?1 AND f.offered_at >= ?2 AND (o.provider_id IS NULL OR o.provider_id <> ?1)
                     AND NOT EXISTS (SELECT 1 FROM order_rejections x WHERE x.order_id = f.order_id AND x.provider_id = ?1)
                     AND (o.status <> 'pending' OR f.offered_at < ?3)) AS ignored,
                (SELECT COUNT(*) FROM orders WHERE provider_id = ?1 AND status = 'completed' AND completed_at >= ?2) AS completed,
                (SELECT COUNT(*) FROM orders WHERE provider_id = ?1 AND status = 'cancelled' AND cancelled_by = 'customer' AND cancelled_at >= ?2) AS customer_cancelled,
                (SELECT COUNT(*) FROM notification_targets t JOIN notifications n ON n.id = t.notification_id
                   WHERE t.user_id = ?1 AND n.category = 'alert' AND n.sent_at >= ?2) AS warnings`, id, from, stale),
      all<{ kind: string; reason: string | null; created_at: string; order_no: number; service_name: string; sub_service_name: string | null; customer_name: string | null }>(c.env.DB,
        `SELECT x.kind, x.reason, x.created_at, o.order_no, o.service_name, o.sub_service_name, cu.full_name AS customer_name
           FROM order_rejections x JOIN orders o ON o.id = x.order_id LEFT JOIN users cu ON cu.id = o.customer_id
          WHERE x.provider_id = ? ORDER BY x.created_at DESC LIMIT 100`, id),
      all<{ order_no: number; rating: number; review: string | null; service_name: string; customer_name: string | null; completed_at: string | null }>(c.env.DB,
        `SELECT o.order_no, o.rating, o.review, o.service_name, cu.full_name AS customer_name, o.completed_at
           FROM orders o LEFT JOIN users cu ON cu.id = o.customer_id WHERE o.provider_id = ? AND o.rating IS NOT NULL ORDER BY o.completed_at DESC LIMIT 100`, id),
      all<{ customer_id: string; name: string | null; phone: string | null; orders: number; completed: number; cancelled: number; reasons: string | null }>(c.env.DB,
        `SELECT o.customer_id, cu.full_name AS name, cu.phone, COUNT(*) AS orders,
                SUM(o.status = 'completed') AS completed, SUM(o.status = 'cancelled') AS cancelled,
                GROUP_CONCAT(CASE WHEN o.status = 'cancelled' THEN COALESCE(o.cancel_reason, 'بدون سبب') END, ' | ') AS reasons
           FROM orders o LEFT JOIN users cu ON cu.id = o.customer_id
          WHERE (o.provider_id = ?1 OR o.id IN (SELECT order_id FROM order_rejections WHERE provider_id = ?1 AND kind = 'release')) AND o.customer_id IS NOT NULL
          GROUP BY o.customer_id ORDER BY orders DESC LIMIT 100`, id),
      all<{ id: string; action: string; reason: string; letter_key: string | null; created_at: string }>(c.env.DB,
        "SELECT id, action, reason, letter_key, created_at FROM account_actions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50", id),
      shiftSummary(c, id, !!u!.is_online),
    ]);
    const on = new Set(enabled.map((x) => x.service_id));
    const ok = new Set(approved);
    const name = Object.fromEntries(services.map((s) => [s.id, s.name]));
    const p = perf!;
    // Charts: the last 12 months (Riyadh time) and the rating distribution.
    const since12 = new Date(Date.now() - 365 * DAY).toISOString();
    const month = (col: string) => `substr(datetime(${col}, '+3 hours'), 1, 7)`;
    const [mOffered, mAccepted, mCompleted, mReleased, mRejected, ratingDist, bySvc] = await Promise.all([
      all<{ m: string; n: number }>(c.env.DB, `SELECT ${month("offered_at")} AS m, COUNT(*) AS n FROM order_offers WHERE provider_id = ? AND offered_at >= ? GROUP BY m`, id, since12),
      all<{ m: string; n: number }>(c.env.DB, `SELECT ${month("accepted_at")} AS m, COUNT(*) AS n FROM orders WHERE provider_id = ? AND accepted_at >= ? GROUP BY m`, id, since12),
      all<{ m: string; n: number }>(c.env.DB, `SELECT ${month("completed_at")} AS m, COUNT(*) AS n FROM orders WHERE provider_id = ? AND status = 'completed' AND completed_at >= ? GROUP BY m`, id, since12),
      all<{ m: string; n: number }>(c.env.DB, `SELECT ${month("created_at")} AS m, COUNT(*) AS n FROM order_rejections WHERE provider_id = ? AND kind = 'release' AND created_at >= ? GROUP BY m`, id, since12),
      all<{ m: string; n: number }>(c.env.DB, `SELECT ${month("created_at")} AS m, COUNT(*) AS n FROM order_rejections WHERE provider_id = ? AND kind = 'reject' AND created_at >= ? GROUP BY m`, id, since12),
      all<{ rating: number; n: number }>(c.env.DB, "SELECT rating, COUNT(*) AS n FROM orders WHERE provider_id = ? AND rating IS NOT NULL GROUP BY rating", id),
      all<{ name: string; n: number }>(c.env.DB, "SELECT service_name AS name, COUNT(*) AS n FROM orders WHERE provider_id = ? AND status = 'completed' GROUP BY service_name ORDER BY n DESC LIMIT 8", id),
    ]);
    const months: string[] = [];
    for (let i = 11; i >= 0; i--) { const d = new Date(Date.now() + 3 * 3600000); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i); months.push(d.toISOString().slice(0, 7)); }
    const pick = (rows: { m: string; n: number }[], m: string) => rows.find((x) => x.m === m)?.n ?? 0;
    const released12 = new Map(mReleased.map((x) => [x.m, x.n]));
    const charts = {
      monthly: months.map((m) => {
        const accepted = pick(mAccepted, m) + (released12.get(m) ?? 0);
        const rejected = pick(mRejected, m);
        // Orders that reached the provider (offers are logged since this report exists; accepted/declined ones reached them too).
        return { month: m, offered: Math.max(pick(mOffered, m), accepted + rejected), accepted, completed: pick(mCompleted, m), rejected, cancelled: pick(mReleased, m) };
      }),
      ratings: [5, 4, 3, 2, 1].map((r) => ({ rating: r, n: ratingDist.find((x) => x.rating === r)?.n ?? 0 })),
      services: bySvc,
    };
    const accepted = p.accepted_now + p.released;
    return json({
      user: u,
      days,
      services: services.filter((s) => ok.has(s.id)).map((s) => ({ ...s, enabled: on.has(s.id) })),
      requests: await Promise.all(requests.map(async (x) => ({ ...x, service_name: name[x.service_id] ?? "—", doc_url: x.doc_key ? await signFileUrl(c.env, x.doc_key) : null, doc_key: undefined }))),
      performance: {
        offered: p.offered, accepted, rejected: p.rejected, ignored: p.ignored, released: p.released, completed: p.completed,
        customer_cancelled: p.customer_cancelled, warnings: p.warnings,
        accept_rate: p.offered ? Math.round((accepted / p.offered) * 100) : null,
        flag_ignored: p.ignored >= 5, flag_cancelled: p.released >= 3,
      },
      reasons, ratings, customers, shifts, charts,
      actions: await Promise.all(actions.map(async (a) => ({ ...a, letter_url: a.letter_key ? await signFileUrl(c.env, a.letter_key) : null, letter_key: undefined }))),
    });
  });

  /** Reminder sent by the administration from the provider profile (yellow: no response, red: cancellations). */
  r.post("/api/admin/providers/:id/remind", async (c) => {
    const admin = await requirePerm(c, "providers", "edit");
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const kind = b.kind === "cancelled" ? "cancelled" : "ignored";
    const extra = typeof b.message === "string" ? b.message.trim().slice(0, 500) : "";
    const msg = kind === "cancelled"
      ? { title: "تنبيه أداء: طلبات ملغاة", body: `لاحظت الإدارة تكرار إلغاء الطلبات بعد قبولها. نرجو قبول ما تستطيع تنفيذه فقط، فتكرار الإلغاء قد يؤدي لإيقاف الحساب.${extra ? `\n${extra}` : ""}` }
      : { title: "تنبيه أداء: طلبات بلا رد", body: `وصلتك طلبات لم تقبلها أو ترفضها. إذا كنت مشغولاً اجعل حالتك «غير متصل» حتى لا تتأخر طلبات العملاء.${extra ? `\n${extra}` : ""}` };
    await c.env.DB.batch(notifyStmts(c, [c.params.id], { ...msg, link: "/provider/orders", icon: "AlertTriangle", category: "alert", created_by: admin.id }));
    notifyExternal(c, [c.params.id], { ...msg, email: false });
    return json({ ok: true });
  });

  /**
   * Suspend / reactivate / delete a customer or provider account (multipart: action, reason, letter_file).
   * The reason and the letter are kept in account_actions; the user is informed in the app and by SMS/e-mail.
   */
  r.post("/api/admin/users/:id/account-action", async (c) => {
    const id = c.params.id;
    const target = await first<{ id: string; full_name: string | null }>(c.env.DB, "SELECT id, full_name FROM users WHERE id = ?", id);
    if (!target) fail(404, "not_found", "الحساب غير موجود");
    const roles = (await all<{ role: string }>(c.env.DB, "SELECT role FROM user_roles WHERE user_id = ?", id)).map((x) => x.role);
    if (roles.includes("admin") || roles.includes("staff")) fail(400, "admin_account", "حسابات الإدارة تُدار من صفحة المستخدمين والصلاحيات");
    const admin = await requireFeature(c, roles.includes("provider") ? "providers" : "customers", "suspend");
    const form = await c.req.formData();
    const action = String(form.get("action") ?? "");
    if (!["suspend", "reactivate", "delete"].includes(action)) fail(400, "invalid_action", "إجراء غير صحيح");
    const reason = String(form.get("reason") ?? "").trim().slice(0, 1000);
    if (reason.length < 3) fail(400, "missing_reason", "اكتب سبب الإجراء");
    const file = formFile(form, "letter_file");
    let letterKey: string | null = null;
    if (file) {
      validateDoc(file);
      letterKey = `letters/${id}/${action}-${Date.now()}.${DOC_TYPES[file.type]}`;
      await putFile(c.env, letterKey, file);
    }
    const t = now();
    const log = stmt(c.env.DB, "INSERT INTO account_actions (id, user_id, user_name, action, reason, letter_key, letter_type, created_by) VALUES (?,?,?,?,?,?,?,?)",
      uid(), id, target!.full_name, action, reason, letterKey, file?.type ?? null, admin.id);

    if (action === "suspend") {
      await c.env.DB.batch([
        log,
        stmt(c.env.DB, "UPDATE users SET is_active = 0, is_online = 0, suspend_reason = ?, updated_at = ? WHERE id = ?", reason, t, id),
        stmt(c.env.DB, "UPDATE provider_shifts SET ended_at = ? WHERE provider_id = ? AND ended_at IS NULL", t, id),
        stmt(c.env.DB, "DELETE FROM sessions WHERE user_id = ?", id),
      ]);
      notifyExternal(c, [id], { title: "تم تعليق حسابك", body: `تم تعليق حسابك في التطبيق. السبب: ${reason}. للاستفسار تواصل مع الدعم.` });
    } else if (action === "reactivate") {
      await c.env.DB.batch([
        log,
        stmt(c.env.DB, "UPDATE users SET is_active = 1, suspend_reason = NULL, updated_at = ? WHERE id = ?", t, id),
        ...notifyStmts(c, [id], { title: "تمت إعادة تفعيل حسابك", body: reason, category: "general", created_by: admin.id }),
      ]);
      notifyExternal(c, [id], { title: "تمت إعادة تفعيل حسابك", body: reason });
    } else {
      const active = await first<{ n: number }>(c.env.DB, "SELECT COUNT(*) AS n FROM orders WHERE (customer_id = ?1 OR provider_id = ?1) AND status IN ('accepted','arrived','in_progress')", id);
      if (active?.n) fail(409, "active_orders", "لدى الحساب طلبات جارية، علّق الحساب أولاً حتى تنتهي");
      // Inform before deleting (contact details disappear with the account).
      notifyExternal(c, [id], { title: "تم حذف حسابك", body: `تم حذف حسابك من التطبيق. السبب: ${reason}.` });
      await c.tasks[c.tasks.length - 1]?.catch(() => {});
      const docs = await all<{ r2_key: string }>(c.env.DB, "SELECT r2_key FROM provider_documents WHERE user_id = ? UNION SELECT doc_key FROM service_requests WHERE provider_id = ? AND doc_key IS NOT NULL", id, id);
      await c.env.DB.batch([
        log,
        stmt(c.env.DB, "UPDATE orders SET status = 'cancelled', cancelled_by = 'admin', cancel_reason = 'حذف الحساب من الإدارة', cancelled_at = ? WHERE customer_id = ? AND status = 'pending'", t, id),
        stmt(c.env.DB, "DELETE FROM users WHERE id = ?", id),
      ]);
      c.tasks.push(deleteFiles(c.env, docs.map((d) => d.r2_key)));
    }
    return json({ ok: true });
  });

  /** Account actions history (customers and providers) with letter links. */
  r.get("/api/admin/users/:id/actions", async (c) => {
    await requirePerm(c, ["customers", "providers"], "view");
    const rows = await all<{ id: string; action: string; reason: string; letter_key: string | null; created_at: string }>(c.env.DB,
      "SELECT id, action, reason, letter_key, created_at FROM account_actions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50", c.params.id);
    return json(await Promise.all(rows.map(async (a) => ({ ...a, letter_url: a.letter_key ? await signFileUrl(c.env, a.letter_key) : null, letter_key: undefined }))));
  });
}
