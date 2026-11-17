/**
 * Public website (/site): content managed from the admin panel (إدارة الموقع), extra pages, contact messages
 * and simple analytics (daily counters only: views, visitors, sources, devices, countries, button clicks).
 */
import { all, fail, first, json, now, num, bool, oneOf, readJson, run, stmt, str, uid, type Ctx, type Router } from "../lib/core";
import { rateLimit, requirePerm } from "../lib/auth";
import { getSettings } from "../lib/domain";

type Json = Record<string, unknown>;

/** Default content: shown until the administration edits it. */
export function defaultSite(appName: string): Json {
  return {
    domain: "",
    seo: { title: `${appName} — كل مهامك اليومية بضغطة زر`, description: `منصة ${appName} تربطك بمقدمي خدمات موثوقين في مدينتك: صيانة، تنظيف، تعليم، خدمات إدارية وأكثر. اطلب خدمتك خلال دقيقة.`, keywords: "خدمات منزلية, صيانة, سباكة, كهرباء, مقدم خدمة, تطبيق مهمة" },
    announcement: { active: false, text: "", link: "" },
    hero: {
      badge: "منصة الخدمات الموثوقة",
      title: "كل مهامك اليومية… بضغطة زر",
      subtitle: `اطلب الخدمة التي تحتاجها ويصلك مقدم خدمة موثوق في مدينتك. بدون عمولة على طالب الخدمة، والسعر تتفق عليه مباشرة.`,
      image_url: "",
    },
    banners: [] as Json[],
    stats: [
      { label: "مقدم خدمة موثّق", source: "providers", value: "" },
      { label: "طلب مكتمل", source: "orders", value: "" },
      { label: "خدمة متاحة", source: "services", value: "" },
      { label: "مدينة نخدمها", source: "cities", value: "" },
    ],
    about: {
      title: `ما هي ${appName}؟`,
      body: `${appName} منصة رقمية تجمع طالبي الخدمات اليومية بمقدمي خدمات محترفين وموثّقين. تختار الخدمة، يصل طلبك لمقدمي الخدمة في مدينتك، وتتابع التنفيذ حتى الإنجاز ثم تقيّم التجربة.`,
      image_url: "",
      points: ["مقدمو خدمة موثّقون بالهوية", "محادثة مباشرة مع ترجمة تلقائية", "تتبّع الطلب خطوة بخطوة", "تقييمات حقيقية بعد كل طلب"],
    },
    services: { title: "خدماتنا", subtitle: "اختر التصنيف ثم المهمة التي تحتاجها", limit: 12 },
    how_customer: {
      title: "لطالب الخدمة",
      steps: [
        { title: "حمّل التطبيق واختر الخدمة", text: "حدد المهمة ونوعها: حضوري في موقعك أو عن بُعد." },
        { title: "يصل طلبك لمقدمي الخدمة", text: "يُنشر الطلب فوراً لمقدمي الخدمة المعتمدين في مدينتك." },
        { title: "اتفق على السعر وتابع التنفيذ", text: "يعرض مقدم الخدمة المبلغ، توافق أو تتفاوض في المحادثة، ثم تتابع حتى الإنجاز." },
        { title: "قيّم التجربة", text: "بعد اكتمال الطلب تقيّم مقدم الخدمة ليستفيد غيرك." },
      ],
    },
    how_provider: {
      title: "لمقدم الخدمة",
      steps: [
        { title: "سجّل في تطبيق «مهمة شريك»", text: "أدخل بياناتك وأرفق الهوية، والشهادة اختيارية." },
        { title: "اعتماد الإدارة", text: "تُراجع الإدارة طلبك وتفعّل حسابك وخدماتك." },
        { title: "اشترك أو اشحن رصيدك", text: "اختر الاشتراك الشهري أو الدفع بالكوينز عن كل طلب تقبله." },
        { title: "استقبل الطلبات واربح", text: "تصلك الطلبات في مدينتك، تحدد مبلغك وتبدأ العمل." },
      ],
    },
    features: [
      { title: "بدون عمولة على العميل", text: "التطبيق لا يأخذ رسوماً من طالب الخدمة." },
      { title: "مقدمو خدمة موثّقون", text: "مراجعة الهوية واعتماد الإدارة قبل استقبال الطلبات." },
      { title: "ثلاث لغات", text: "العربية والإنجليزية والأردو مع ترجمة تلقائية للمحادثات." },
      { title: "حفظ حقوق الطرفين", text: "تقييمات ومتابعة من الإدارة عند أي ملاحظة." },
    ],
    subscription: {
      show: true,
      title: "كيف يشترك مقدم الخدمة؟",
      subtitle: "طريقتان للدفع عند قبول الطلبات، اختر ما يناسب حجم عملك.",
      note: "الأسعار تُحدّث تلقائياً من لوحة التحكم وتُضاف عليها الضريبة إن وُجدت.",
    },
    testimonials: [] as Json[],
    faqs: [
      { q: "هل يدفع طالب الخدمة رسوماً للتطبيق؟", a: "لا، التطبيق لا يأخذ أي رسوم من طالب الخدمة. تتفق على مبلغ الخدمة مع مقدمها مباشرة." },
      { q: "كيف أصبح مقدم خدمة؟", a: "حمّل تطبيق «مهمة شريك»، سجّل بياناتك وأرفق هويتك، وبعد اعتماد الإدارة تبدأ استقبال الطلبات." },
      { q: "ما الفرق بين الاشتراك والكوينز؟", a: "الاشتراك يغطي قبول الطلبات طوال مدته، والكوينز تُخصم عن كل طلب تقبله فقط." },
      { q: "ماذا لو لم أتفق مع مقدم الخدمة على المبلغ؟", a: "يمكنك التفاوض في المحادثة، وإن لم تتفقا تلغي الطلب مع ذكر السبب وتراجعه الإدارة." },
    ],
    contact: { phone: "", whatsapp: "", email: "", address: "", hours: "", show_form: true },
    social: { x: "", instagram: "", snapchat: "", tiktok: "", youtube: "", linkedin: "" },
    footer: { text: `${appName} — منصة سعودية لربط طالبي الخدمات بمقدميها.` },
    sections: [
      { key: "stats", visible: true }, { key: "about", visible: true }, { key: "services", visible: true }, { key: "how", visible: true },
      { key: "features", visible: true }, { key: "subscription", visible: true }, { key: "testimonials", visible: true },
      { key: "faq", visible: true }, { key: "download", visible: true }, { key: "contact", visible: true },
    ],
  };
}

const SECTION_KEYS = ["stats", "about", "services", "how", "features", "subscription", "testimonials", "faq", "download", "contact"];

async function loadSite(c: Ctx) {
  const s = await getSettings(c.env);
  const row = await first<{ data: string; updated_at: string | null }>(c.env.DB, "SELECT data, updated_at FROM site_content WHERE id = 1").catch(() => null);
  let saved: Json = {};
  try { saved = JSON.parse(row?.data || "{}"); } catch { saved = {}; }
  const def = defaultSite(s.app_name);
  const out: Json = { ...def };
  for (const k of Object.keys(def)) {
    const v = saved[k];
    if (v === undefined || v === null) continue;
    out[k] = Array.isArray(def[k]) ? (Array.isArray(v) ? v : def[k]) : typeof def[k] === "object" ? { ...(def[k] as Json), ...(v as Json) } : v;
  }
  // Sections: keep the saved order, add any new section at the end.
  const secs = (out.sections as { key: string; visible: boolean }[]).filter((x) => SECTION_KEYS.includes(x.key));
  for (const k of SECTION_KEYS) if (!secs.some((x) => x.key === k)) secs.push({ key: k, visible: true });
  out.sections = secs;
  return { content: out, settings: s, updated_at: row?.updated_at ?? null };
}

/** Live numbers for «source» statistics. */
async function liveNumbers(c: Ctx) {
  const n = async (sql: string) => (await first<{ n: number }>(c.env.DB, sql).catch(() => null))?.n ?? 0;
  const [providers, customers, orders, services, cities, rating] = await Promise.all([
    n("SELECT COUNT(*) AS n FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'provider' WHERE u.is_active = 1"),
    n("SELECT COUNT(*) AS n FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'customer'"),
    n("SELECT COUNT(*) AS n FROM orders WHERE status = 'completed'"),
    n("SELECT COUNT(*) AS n FROM sub_services WHERE active = 1"),
    n("SELECT COUNT(DISTINCT region) AS n FROM users WHERE region IS NOT NULL AND region <> ''"),
    first<{ r: number | null }>(c.env.DB, "SELECT AVG(rating) AS r FROM orders WHERE rating IS NOT NULL").catch(() => null),
  ]);
  return { providers, customers, orders, services, cities, rating: rating?.r ? Math.round(rating.r * 10) / 10 : 0 };
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const bump = (c: Ctx, day: string, kind: string, key: string) =>
  stmt(c.env.DB, "INSERT INTO site_stats (day, kind, key, count) VALUES (?,?,?,1) ON CONFLICT(day, kind, key) DO UPDATE SET count = count + 1", day, kind, key.slice(0, 80) || "-");

/** Where a visit came from, from the referrer / utm_source. */
function sourceOf(ref: string, utm: string, host: string) {
  if (utm) return utm.toLowerCase().slice(0, 40);
  if (!ref) return "مباشر";
  let h = "";
  try { h = new URL(ref).hostname.replace(/^www\./, ""); } catch { return "مباشر"; }
  if (!h || h === host.replace(/^www\./, "")) return "مباشر";
  if (/google\./.test(h)) return "Google";
  if (/bing\.|yahoo\.|duckduckgo\.|yandex\./.test(h)) return "محركات بحث أخرى";
  if (/t\.co$|twitter\.com|x\.com/.test(h)) return "X (تويتر)";
  if (/instagram\./.test(h)) return "Instagram";
  if (/snapchat\./.test(h)) return "Snapchat";
  if (/tiktok\./.test(h)) return "TikTok";
  if (/facebook\.|fb\./.test(h)) return "Facebook";
  if (/whatsapp\.|wa\.me/.test(h)) return "WhatsApp";
  if (/youtube\.|youtu\.be/.test(h)) return "YouTube";
  if (/linkedin\./.test(h)) return "LinkedIn";
  return h;
}

export function registerSiteRoutes(r: Router) {
  /* =================== Public =================== */
  r.get("/api/site", async (c) => {
    const { content, settings: s } = await loadSite(c);
    const [numbers, services, pages, policies] = await Promise.all([
      liveNumbers(c),
      all(c.env.DB, `SELECT s.id, s.name, s.description, s.icon, s.color, (SELECT COUNT(*) FROM sub_services x WHERE x.service_id = s.id AND x.active = 1) AS tasks
                       FROM services s WHERE s.active = 1 ORDER BY s.sort_order, s.name`),
      all(c.env.DB, "SELECT slug, title, show_in_nav, show_in_footer FROM site_pages WHERE published = 1 ORDER BY sort_order, created_at"),
      all(c.env.DB, "SELECT id, title FROM policies WHERE published = 1 ORDER BY updated_at DESC LIMIT 8").catch(() => []),
    ]);
    return json({
      content, numbers, services, pages, policies,
      app: {
        name: s.app_name, logo_url: s.logo_url ?? s.app_logo_url, primary_color: s.primary_color, currency_label: s.currency_label,
        support_phone: s.support_phone, support_email: s.support_email,
        customer: { ios: s.customer_ios_url, android: s.customer_android_url, other: s.customer_other_url },
        provider: { ios: s.provider_ios_url, android: s.provider_android_url, other: s.provider_other_url },
        billing: {
          coins: !!s.billing_coins_enabled, subscription: !!s.billing_subscription_enabled, coin_price: s.coin_price ?? 1, vat_percent: s.vat_percent,
          plans: [{ months: 1, price: s.sub_price_1m }, { months: 3, price: s.sub_price_3m }, { months: 6, price: s.sub_price_6m }, { months: 12, price: s.sub_price_12m }].filter((p) => p.price > 0),
        },
      },
    }, 200, { "cache-control": "public, max-age=60" });
  });

  /** Tiny lookup used by the web app to open the website on the website's own domain. */
  r.get("/api/site/domain", async (c) => json({ domain: clean((await loadSite(c)).content.domain, 120).toLowerCase() }, 200, { "cache-control": "public, max-age=300" }));

  r.get("/api/site/pages/:slug", async (c) => {
    const slug = c.params.slug;
    if (slug.startsWith("policy-")) {
      const p = await first(c.env.DB, "SELECT title, body, updated_at FROM policies WHERE id = ? AND published = 1", slug.slice(7));
      if (!p) fail(404, "not_found", "الصفحة غير موجودة");
      return json(p);
    }
    const p = await first(c.env.DB, "SELECT title, body, updated_at FROM site_pages WHERE slug = ? AND published = 1", slug);
    if (!p) fail(404, "not_found", "الصفحة غير موجودة");
    return json(p);
  });

  /** One page view or one button click. Only counters are stored. */
  r.post("/api/site/track", async (c) => {
    await rateLimit(c.env, `site-track:${c.ip}`, 600, 60);
    const b = await readJson(c.req).catch(() => ({} as Json));
    const day = now().slice(0, 10);
    const batch = [];
    const event = clean(b.event, 40);
    if (event) batch.push(bump(c, day, "event", event));
    else {
      const path = clean(b.path, 80) || "/site";
      batch.push(bump(c, day, "view", path));
      if (b.first_today === true) {
        batch.push(bump(c, day, "visitor", b.returning === true ? "عائد" : "جديد"));
        batch.push(bump(c, day, "source", sourceOf(clean(b.ref, 300), clean(b.utm, 40), c.url.hostname)));
        batch.push(bump(c, day, "device", b.mobile === true ? "جوال" : "كمبيوتر"));
        const country = ((c.req as unknown as { cf?: { country?: string } }).cf?.country ?? "").toUpperCase();
        if (country) batch.push(bump(c, day, "country", country));
      }
    }
    await c.env.DB.batch(batch);
    return json({ ok: true });
  });

  r.post("/api/site/contact", async (c) => {
    await rateLimit(c.env, `site-contact:${c.ip}`, 5, 60);
    const b = await readJson(c.req);
    if (clean(b.website, 50)) return json({ ok: true }); // honeypot for bots
    const name = str(b, "name", { required: true, min: 2, max: 100, label: "الاسم" })!;
    const message = str(b, "message", { required: true, min: 5, max: 2000, label: "الرسالة" })!;
    const phone = clean(b.phone, 20) || null;
    const email = clean(b.email, 150) || null;
    if (!phone && !email) fail(400, "no_contact", "اكتب رقم الجوال أو البريد لنتواصل معك");
    const topic = oneOf(b, "topic", ["customer", "provider", "partnership", "complaint", "general"] as const) ?? "general";
    await c.env.DB.batch([
      stmt(c.env.DB, "INSERT INTO site_messages (id, name, phone, email, topic, message) VALUES (?,?,?,?,?,?)", uid(), name, phone, email, topic, message),
      bump(c, now().slice(0, 10), "event", "contact_form"),
    ]);
    return json({ ok: true }, 201);
  });

  /* =================== Administration (إدارة الموقع) =================== */
  r.get("/api/admin/site", async (c) => {
    await requirePerm(c, "website", "view");
    const { content, updated_at } = await loadSite(c);
    return json({ content, updated_at, numbers: await liveNumbers(c) });
  });

  r.put("/api/admin/site", async (c) => {
    const u = await requirePerm(c, "website", "edit");
    const b = await readJson(c.req);
    const content = b.content;
    if (!content || typeof content !== "object" || Array.isArray(content)) fail(400, "invalid", "بيانات غير صالحة");
    const text = JSON.stringify(content);
    if (text.length > 200000) fail(400, "too_large", "المحتوى كبير جداً، اختصر النصوص");
    for (const m of text.matchAll(/"(?:image_url|link)":"([^"]*)"/g)) {
      if (m[1] && !/^(https?:\/\/|\/|#|mailto:|tel:)/.test(m[1])) fail(400, "invalid_link", `رابط غير صالح: ${m[1].slice(0, 60)}`);
    }
    await run(c.env.DB, "UPDATE site_content SET data = ?, updated_at = ?, updated_by = ? WHERE id = 1", text, now(), u.id);
    return json({ ok: true });
  });

  r.get("/api/admin/site/pages", async (c) => { await requirePerm(c, "website", "view"); return json(await all(c.env.DB, "SELECT * FROM site_pages ORDER BY sort_order, created_at")); });
  const pageFields = (b: Json, create: boolean) => {
    const f: Json = {};
    const title = str(b, "title", { required: create, max: 150, label: "عنوان الصفحة" }); if (title) f.title = title;
    if (b.slug !== undefined || create) {
      const slug = clean(b.slug, 60).toLowerCase().replace(/\s+/g, "-");
      if (!/^[a-z0-9][a-z0-9-]{1,58}$/.test(slug) || slug.startsWith("policy-")) fail(400, "invalid_slug", "رابط الصفحة: أحرف إنجليزية صغيرة وأرقام وشرطة (مثال: about-us)");
      f.slug = slug;
    }
    if (b.body !== undefined) f.body = clean(b.body, 30000);
    for (const k of ["show_in_nav", "show_in_footer", "published"]) { const v = bool(b, k); if (v !== null) f[k] = v ? 1 : 0; }
    const so = num(b, "sort_order", { min: 0, max: 9999, int: true }); if (so !== null) f.sort_order = so;
    return f;
  };
  r.post("/api/admin/site/pages", async (c) => {
    await requirePerm(c, "website", "edit");
    const f = pageFields(await readJson(c.req), true);
    if (await first(c.env.DB, "SELECT 1 FROM site_pages WHERE slug = ?", f.slug)) fail(409, "slug_taken", "رابط الصفحة مستخدم");
    const id = uid();
    const keys = Object.keys(f);
    await run(c.env.DB, `INSERT INTO site_pages (id, ${keys.join(", ")}) VALUES (?, ${keys.map(() => "?").join(", ")})`, id, ...keys.map((k) => f[k]));
    return json({ id }, 201);
  });
  r.patch("/api/admin/site/pages/:id", async (c) => {
    await requirePerm(c, "website", "edit");
    const f = pageFields(await readJson(c.req), false);
    if (f.slug && (await first(c.env.DB, "SELECT 1 FROM site_pages WHERE slug = ? AND id <> ?", f.slug, c.params.id))) fail(409, "slug_taken", "رابط الصفحة مستخدم");
    const keys = Object.keys(f);
    if (keys.length) await run(c.env.DB, `UPDATE site_pages SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = ? WHERE id = ?`, ...keys.map((k) => f[k]), now(), c.params.id);
    return json({ ok: true });
  });
  r.delete("/api/admin/site/pages/:id", async (c) => { await requirePerm(c, "website", "edit"); await run(c.env.DB, "DELETE FROM site_pages WHERE id = ?", c.params.id); return json({ ok: true }); });

  r.get("/api/admin/site/messages", async (c) => {
    await requirePerm(c, "website", "view");
    const status = c.url.searchParams.get("status") === "done" ? "done" : "new";
    return json({
      rows: await all(c.env.DB, "SELECT m.*, u.full_name AS handled_by_name FROM site_messages m LEFT JOIN users u ON u.id = m.handled_by WHERE m.status = ? ORDER BY m.created_at DESC LIMIT 200", status),
      new_count: (await first<{ n: number }>(c.env.DB, "SELECT COUNT(*) AS n FROM site_messages WHERE status = 'new'"))?.n ?? 0,
    });
  });
  r.post("/api/admin/site/messages/:id/done", async (c) => {
    const u = await requirePerm(c, "website", "edit");
    await run(c.env.DB, "UPDATE site_messages SET status = 'done', handled_by = ? WHERE id = ?", u.id, c.params.id);
    return json({ ok: true });
  });
  r.delete("/api/admin/site/messages/:id", async (c) => { await requirePerm(c, "website", "edit"); await run(c.env.DB, "DELETE FROM site_messages WHERE id = ?", c.params.id); return json({ ok: true }); });

  /** Website analytics for the last N days, compared with the N days before. */
  r.get("/api/admin/site/analytics", async (c) => {
    await requirePerm(c, "website", "view");
    const days = Math.min(90, Math.max(7, Number(c.url.searchParams.get("days")) || 30));
    const dayStr = (offset: number) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
    const from = dayStr(days - 1), prevFrom = dayStr(days * 2 - 1);
    const rows = await all<{ day: string; kind: string; key: string; count: number }>(c.env.DB, "SELECT day, kind, key, count FROM site_stats WHERE day >= ?", prevFrom);
    const cur = rows.filter((r) => r.day >= from), prev = rows.filter((r) => r.day < from);
    const sum = (list: typeof rows, kind: string, key?: string) => list.filter((r) => r.kind === kind && (key === undefined || r.key === key)).reduce((a, r) => a + r.count, 0);
    const top = (kind: string, limit = 8) => {
      const m = new Map<string, number>();
      cur.filter((r) => r.kind === kind).forEach((r) => m.set(r.key, (m.get(r.key) ?? 0) + r.count));
      return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count).slice(0, limit);
    };
    const daily = Array.from({ length: days }, (_, i) => {
      const d = dayStr(days - 1 - i);
      const of = (kind: string) => cur.filter((r) => r.day === d && r.kind === kind).reduce((a, r) => a + r.count, 0);
      return { day: d, views: of("view"), visitors: of("visitor"), clicks: cur.filter((r) => r.day === d && r.kind === "event" && r.key.startsWith("download")).reduce((a, r) => a + r.count, 0) };
    });
    const events = top("event", 20);
    const downloads = events.filter((e) => e.key.startsWith("download")).reduce((a, e) => a + e.count, 0);
    const prevDownloads = prev.filter((r) => r.kind === "event" && r.key.startsWith("download")).reduce((a, r) => a + r.count, 0);
    const visitors = sum(cur, "visitor"), prevVisitors = sum(prev, "visitor");
    const [messages, signups] = await Promise.all([
      first<{ n: number }>(c.env.DB, "SELECT COUNT(*) AS n FROM site_messages WHERE created_at >= ?", from),
      first<{ c: number; p: number }>(c.env.DB,
        `SELECT SUM(CASE WHEN r.role = 'customer' THEN 1 ELSE 0 END) AS c, SUM(CASE WHEN r.role = 'provider' THEN 1 ELSE 0 END) AS p
           FROM users u JOIN user_roles r ON r.user_id = u.id WHERE u.created_at >= ?`, from),
    ]);
    return json({
      days,
      totals: {
        views: sum(cur, "view"), prev_views: sum(prev, "view"), visitors, prev_visitors: prevVisitors,
        new_visitors: sum(cur, "visitor", "جديد"), returning: sum(cur, "visitor", "عائد"),
        downloads, prev_downloads: prevDownloads, conversion: visitors ? Math.round((downloads / visitors) * 1000) / 10 : 0,
        prev_conversion: prevVisitors ? Math.round((prevDownloads / prevVisitors) * 1000) / 10 : 0,
        messages: messages?.n ?? 0, signups_customers: signups?.c ?? 0, signups_providers: signups?.p ?? 0,
      },
      daily, pages: top("view"), sources: top("source"), devices: top("device"), countries: top("country"), events,
    });
  });
}
