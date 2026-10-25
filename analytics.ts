/**
 * Business analytics for the admin panel: demand by service, city, neighbourhood, customer segment and time of day,
 * supply gaps, and plain-Arabic insights. Everything is computed from real orders (never fabricated).
 * Also: "why did this order not reach providers?" diagnostics.
 */
import { all, fail, first, json, type Router } from "../lib/core";
import { requirePerm } from "../lib/auth";

type Row = {
  id: string; order_no: number; service_id: string | null; service_name: string; sub_service_name: string | null; mode: string;
  address: string | null; region: string | null; status: string; created_at: string; accepted_at: string | null; completed_at: string | null;
  cancelled_by: string | null; rating: number | null; charged_coins: number; customer_id: string | null;
  gender: string | null; nationality: string | null; cust_created: string | null;
};

const RIYADH_OFFSET = 3; // UTC+3
const riyadh = (iso: string) => new Date(Date.parse(iso) + RIYADH_OFFSET * 3600000);
const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function period(h: number) {
  if (h >= 5 && h < 12) return "صباحاً (5–12)";
  if (h >= 12 && h < 17) return "ظهراً وعصراً (12–5)";
  if (h >= 17 && h < 22) return "مساءً (5–10)";
  return "ليلاً (10–5)";
}

/** Neighbourhood = first part of the address saved from the map ("الحي، الشارع، المدينة"). */
function district(address: string | null, region: string | null) {
  if (!address) return null;
  const first = address.split(/[،,]/)[0]?.trim();
  if (!first || first === region || /^\d/.test(first) || first.length > 40) return null;
  return first;
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null);

type Agg = { count: number; completed: number; cancelled: number; pending: number; acceptMins: number[]; ratings: number[]; coins: number; services: Record<string, number> };
const newAgg = (): Agg => ({ count: 0, completed: 0, cancelled: 0, pending: 0, acceptMins: [], ratings: [], coins: 0, services: {} });
function add(a: Agg, o: Row) {
  a.count++;
  if (o.status === "completed") a.completed++;
  if (o.status === "cancelled") a.cancelled++;
  if (o.status === "pending") a.pending++;
  if (o.accepted_at) a.acceptMins.push((Date.parse(o.accepted_at) - Date.parse(o.created_at)) / 60000);
  if (o.rating) a.ratings.push(o.rating);
  a.coins += o.charged_coins || 0;
  a.services[o.service_name] = (a.services[o.service_name] ?? 0) + 1;
}
const topKey = (m: Record<string, number>) => Object.entries(m).sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
function out(name: string, a: Agg, total: number) {
  return {
    name, count: a.count, share: pct(a.count, total), completed: a.completed, cancelled: a.cancelled, pending: a.pending,
    completion_rate: pct(a.completed, a.count), cancel_rate: pct(a.cancelled, a.count),
    avg_accept_min: avg(a.acceptMins), rating: avg(a.ratings), coins: a.coins, top_service: topKey(a.services),
  };
}
function group(rows: Row[], key: (o: Row) => string | null, total: number) {
  const m = new Map<string, Agg>();
  for (const o of rows) {
    const k = key(o);
    if (!k) continue;
    if (!m.has(k)) m.set(k, newAgg());
    add(m.get(k)!, o);
  }
  return [...m.entries()].map(([k, a]) => out(k, a, total)).sort((x, y) => y.count - x.count);
}

export function registerAnalyticsRoutes(r: Router) {
  r.get("/api/admin/analytics", async (c) => {
    await requirePerm(c, ["analytics", "dashboard", "finance"], "view");
    const days = Math.min(365, Math.max(1, Number(c.url.searchParams.get("days") ?? 30) || 30));
    const serviceFilter = c.url.searchParams.get("service") || null;
    const regionFilter = c.url.searchParams.get("region") || null;
    const now = Date.now();
    const from = new Date(now - days * 86400000).toISOString();
    const prevFrom = new Date(now - 2 * days * 86400000).toISOString();

    const where = `o.created_at >= ?1 ${serviceFilter ? "AND o.service_id = ?2" : "AND ?2 IS NULL"} ${regionFilter ? "AND o.region = ?3" : "AND ?3 IS NULL"}`;
    const [rows, prevRows, supply, everCustomers] = await Promise.all([
      all<Row>(c.env.DB,
        `SELECT o.id, o.order_no, o.service_id, o.service_name, o.sub_service_name, o.mode, o.address, o.region, o.status, o.created_at,
                o.accepted_at, o.completed_at, o.cancelled_by, o.rating, o.charged_coins, o.customer_id,
                u.gender, u.nationality, u.created_at AS cust_created
           FROM orders o LEFT JOIN users u ON u.id = o.customer_id
          WHERE ${where} ORDER BY o.created_at LIMIT 50000`, from, serviceFilter, regionFilter),
      all<{ service_name: string; region: string | null; n: number }>(c.env.DB,
        `SELECT o.service_name, o.region, COUNT(*) AS n FROM orders o
          WHERE o.created_at >= ?4 AND o.created_at < ?1 ${serviceFilter ? "AND o.service_id = ?2" : "AND ?2 IS NULL"} ${regionFilter ? "AND o.region = ?3" : "AND ?3 IS NULL"}
          GROUP BY o.service_name, o.region`, from, serviceFilter, regionFilter, prevFrom),
      all<{ service_name: string; region: string | null; providers: number; online: number }>(c.env.DB,
        `SELECT s.name AS service_name, u.region, COUNT(DISTINCT u.id) AS providers, SUM(CASE WHEN u.is_online = 1 THEN 1 ELSE 0 END) AS online
           FROM provider_services ps JOIN services s ON s.id = ps.service_id JOIN users u ON u.id = ps.provider_id
          WHERE u.is_active = 1 AND EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'provider')
          GROUP BY s.name, u.region`),
      all<{ customer_id: string; n: number }>(c.env.DB,
        `SELECT customer_id, COUNT(*) AS n FROM orders WHERE customer_id IS NOT NULL AND created_at < ?1 GROUP BY customer_id`, from),
    ]);

    const total = rows.length;
    const all_ = newAgg();
    rows.forEach((o) => add(all_, o));
    const prevTotal = prevRows.reduce((s, x) => s + x.n, 0);

    // Services with growth vs. the previous period of the same length.
    const prevBySvc: Record<string, number> = {};
    prevRows.forEach((x) => (prevBySvc[x.service_name] = (prevBySvc[x.service_name] ?? 0) + x.n));
    const services = group(rows, (o) => o.service_name, total).map((s) => ({
      ...s, prev: prevBySvc[s.name] ?? 0, growth: prevBySvc[s.name] ? Math.round(((s.count - prevBySvc[s.name]) / prevBySvc[s.name]) * 100) : null,
    }));
    const subServices = group(rows, (o) => (o.sub_service_name ? `${o.sub_service_name} — ${o.service_name}` : null), total).slice(0, 15);
    const cities = group(rows, (o) => o.region ?? "غير محددة", total);
    const districts = group(rows, (o) => { const d = district(o.address, o.region); return d ? `${d} — ${o.region ?? ""}` : null; }, total).slice(0, 20);
    const genders = group(rows, (o) => (o.gender === "female" ? "أنثى" : o.gender === "male" ? "ذكر" : "غير محدد"), total);
    const nationalities = group(rows, (o) => o.nationality || null, total).slice(0, 8);
    const modes = group(rows, (o) => (o.mode === "remote" ? "عن بُعد" : "حضوري"), total);
    const periods = group(rows, (o) => period(riyadh(o.created_at).getUTCHours()), total);
    const weekdays = WEEKDAYS.map((d, i) => ({ name: d, count: rows.filter((o) => riyadh(o.created_at).getUTCDay() === i).length }));
    const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: rows.filter((o) => riyadh(o.created_at).getUTCHours() === h).length }));

    // Customer segments: new (first order in this period) vs. returning.
    const before = new Set(everCustomers.map((x) => x.customer_id));
    const perCustomer: Record<string, number> = {};
    rows.forEach((o) => { if (o.customer_id) perCustomer[o.customer_id] = (perCustomer[o.customer_id] ?? 0) + 1; });
    const customers = Object.keys(perCustomer).length;
    const returning = Object.entries(perCustomer).filter(([id, n]) => before.has(id) || n > 1).length;
    const segments = [
      { name: "عملاء جدد", count: customers - returning },
      { name: "عملاء متكررون", count: returning },
    ];

    // Daily trend.
    const daily: Record<string, { orders: number; completed: number }> = {};
    for (let i = days - 1; i >= 0; i--) daily[riyadh(new Date(now - i * 86400000).toISOString()).toISOString().slice(0, 10)] = { orders: 0, completed: 0 };
    rows.forEach((o) => { const d = riyadh(o.created_at).toISOString().slice(0, 10); if (daily[d]) { daily[d].orders++; if (o.status === "completed") daily[d].completed++; } });
    const trend = Object.entries(daily).map(([date, v]) => ({ date, ...v }));

    // Supply vs. demand per service and city.
    const demandSC: Record<string, { service: string; region: string; orders: number; pending: number }> = {};
    rows.forEach((o) => {
      const k = `${o.service_name}|${o.region ?? ""}`;
      const d = (demandSC[k] ||= { service: o.service_name, region: o.region ?? "غير محددة", orders: 0, pending: 0 });
      d.orders++;
      if (o.status === "pending" || (o.status === "cancelled" && !o.accepted_at)) d.pending++;
    });
    const supplyMap: Record<string, { providers: number; online: number }> = {};
    supply.forEach((s) => {
      for (const k of [`${s.service_name}|${s.region ?? ""}`]) {
        const v = (supplyMap[k] ||= { providers: 0, online: 0 });
        v.providers += s.providers; v.online += s.online || 0;
      }
    });
    const gaps = Object.entries(demandSC).map(([k, d]) => {
      const sp = supplyMap[k] ?? { providers: 0, online: 0 };
      return { ...d, providers: sp.providers, online: sp.online, unserved_rate: pct(d.pending, d.orders), per_provider: sp.providers ? Math.round((d.orders / sp.providers) * 10) / 10 : null };
    }).sort((a, b) => b.pending - a.pending || b.orders - a.orders).slice(0, 15);

    // Plain-language insights for the business owner.
    const insights: { kind: "good" | "warn" | "info" | "tip"; text: string }[] = [];
    if (!total) {
      insights.push({ kind: "info", text: "لا توجد طلبات في هذه الفترة بعد. ستظهر التحليلات تلقائياً مع أول الطلبات." });
    } else {
      const growth = prevTotal ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;
      insights.push({ kind: growth !== null && growth < 0 ? "warn" : "good", text: `إجمالي الطلبات ${total} خلال آخر ${days} يوماً${growth !== null ? `، ${growth >= 0 ? "بزيادة" : "بانخفاض"} ${Math.abs(growth)}% عن الفترة السابقة` : ""}.` });
      const top = services[0];
      if (top) insights.push({ kind: "good", text: `الخدمة الأكثر طلباً «${top.name}» بنسبة ${top.share}% من الطلبات${top.rating ? ` وتقييم ${top.rating}/5` : ""}. ركّز عليها في الإعلانات واستقطاب مقدمي الخدمة.` });
      const rising = services.filter((s) => s.growth !== null && s.prev >= 2 && s.growth >= 30).sort((a, b) => (b.growth ?? 0) - (a.growth ?? 0))[0];
      if (rising) insights.push({ kind: "good", text: `«${rising.name}» تنمو بسرعة (+${rising.growth}%)، فرصة لحملة ترويجية أو باقات خاصة.` });
      const badCancel = services.filter((s) => s.count >= 3 && s.cancel_rate >= 30).sort((a, b) => b.cancel_rate - a.cancel_rate)[0];
      if (badCancel) insights.push({ kind: "warn", text: `نسبة الإلغاء مرتفعة في «${badCancel.name}» (${badCancel.cancel_rate}%). راجع الأسعار ووضوح وصف الخدمة وسرعة القبول.` });
      const slow = services.filter((s) => (s.avg_accept_min ?? 0) > 60 && s.count >= 3).sort((a, b) => (b.avg_accept_min ?? 0) - (a.avg_accept_min ?? 0))[0];
      if (slow) insights.push({ kind: "warn", text: `متوسط وقت قبول طلبات «${slow.name}» ${Math.round(slow.avg_accept_min!)} دقيقة، تحتاج مقدمي خدمة أكثر أو تنبيهات أسرع.` });
      if (cities[0]) insights.push({ kind: "info", text: `أعلى مدينة طلباً ${cities[0].name} (${cities[0].share}%)، وأكثر ما يطلب فيها «${cities[0].top_service}».` });
      if (districts[0]) insights.push({ kind: "info", text: `أكثر حي نشاطاً: ${districts[0].name} بـ ${districts[0].count} طلب.` });
      if (periods[0]) insights.push({ kind: "info", text: `ذروة الطلبات ${periods[0].name} بنسبة ${periods[0].share}%، اطلب من مقدمي الخدمة الاتصال في هذه الفترة.` });
      const peakDay = [...weekdays].sort((a, b) => b.count - a.count)[0];
      if (peakDay?.count) insights.push({ kind: "info", text: `أكثر يوم طلباً: ${peakDay.name}.` });
      const g = genders.filter((x) => x.name !== "غير محدد");
      if (g[0] && g[0].share >= 55) insights.push({ kind: "info", text: `${g[0].name === "أنثى" ? "النساء" : "الرجال"} يمثلون ${g[0].share}% من الطلبات، وأكثر ما يطلبونه «${g[0].top_service}».` });
      if (customers) insights.push({ kind: returning / customers >= 0.3 ? "good" : "tip", text: `العملاء المتكررون ${pct(returning, customers)}% من العملاء.${returning / customers < 0.3 ? " فعّل رسائل إعادة الطلب أو كوبونات للعميل العائد لرفع الولاء." : ""}` });
      const gap = gaps.find((x) => x.pending >= 2 && (x.providers === 0 || x.unserved_rate >= 40));
      if (gap) insights.push({ kind: "warn", text: `فجوة عرض: «${gap.service}» في ${gap.region} — ${gap.pending} طلب لم يُقبل و${gap.providers} مقدم خدمة فقط. استقطب مقدمي خدمة لهذه المدينة.` });
      const remote = modes.find((m) => m.name === "عن بُعد");
      if (remote && remote.share >= 20) insights.push({ kind: "tip", text: `الطلبات عن بُعد ${remote.share}%، يمكن التوسع بخدمات رقمية لا ترتبط بالمدينة.` });
      insights.push({ kind: "tip", text: `معدل الإنجاز العام ${pct(all_.completed, total)}%${avg(all_.ratings) ? ` ومتوسط التقييم ${avg(all_.ratings)}/5` : ""}. الهدف الجيد للسوق: إنجاز فوق 70% وإلغاء تحت 15%.` });
    }

    return json({
      days, filters: { service: serviceFilter, region: regionFilter },
      totals: {
        orders: total, prev_orders: prevTotal, completed: all_.completed, cancelled: all_.cancelled, pending: all_.pending,
        completion_rate: pct(all_.completed, total), cancel_rate: pct(all_.cancelled, total),
        accept_rate: pct(rows.filter((o) => o.accepted_at).length, total), avg_accept_min: avg(all_.acceptMins),
        rating: avg(all_.ratings), coins: all_.coins, customers, returning,
      },
      services, sub_services: subServices, cities, districts, genders, nationalities, modes, periods, weekdays, hours, segments, trend, gaps, insights,
    });
  });

  /** Why an order did (not) reach providers: every provider of that service with the reason it is excluded. */
  r.get("/api/admin/orders/:id/match", async (c) => {
    await requirePerm(c, ["analytics", "finance", "providers"], "view");
    const o = await first<{ id: string; order_no: number; service_id: string | null; service_name: string; region: string | null; status: string; customer_id: string | null; created_at: string }>(c.env.DB,
      "SELECT id, order_no, service_id, service_name, region, status, customer_id, created_at FROM orders WHERE id = ? OR CAST(order_no AS TEXT) = ?", c.params.id, c.params.id.replace(/^#/, ""));
    if (!o) fail(404, "not_found", "الطلب غير موجود");
    const candidates = await all<{ id: string; full_name: string | null; region: string | null; is_online: number; is_active: number; verification_status: string; is_provider: number; has_service: number; requested: string | null }>(c.env.DB,
      `SELECT u.id, u.full_name, u.region, u.is_online, u.is_active, u.verification_status, u.requested_services AS requested,
              EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'provider') AS is_provider,
              EXISTS (SELECT 1 FROM provider_services ps WHERE ps.provider_id = u.id AND ps.service_id = ?1) AS has_service
         FROM users u
        WHERE EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'provider')
           OR u.verification_status IN ('pending','rejected')
           OR EXISTS (SELECT 1 FROM provider_services ps WHERE ps.provider_id = u.id AND ps.service_id = ?1)
        LIMIT 500`, o!.service_id);
    const old = Date.parse(o!.created_at) < Date.now() - 7 * 86400000;
    const providers = candidates.map((p) => {
      const reasons: string[] = [];
      if (!p.is_provider) reasons.push(p.verification_status === "pending" ? "طلب التسجيل لم يُعتمد بعد" : p.verification_status === "rejected" ? "طلب التسجيل مرفوض" : "ليس مقدم خدمة");
      if (!p.is_active) reasons.push("الحساب موقوف");
      if (p.id === o!.customer_id) reasons.push("هو نفس حساب طالب الخدمة");
      if (!p.has_service) reasons.push(`لم يفعّل خدمة «${o!.service_name}»${(p.requested ?? "").includes(o!.service_id ?? "~") ? " (اختارها عند التسجيل لكنها غير مفعّلة)" : ""}`);
      if (p.region && o!.region && p.region !== o!.region) reasons.push(`مدينته ${p.region} والطلب في ${o!.region}`);
      if (old) reasons.push("الطلب أقدم من 7 أيام");
      return { id: p.id, name: p.full_name ?? "—", region: p.region, online: !!p.is_online, sees_order: reasons.length === 0, notified: reasons.length === 0 && !!p.is_online, reasons };
    }).sort((a, b) => Number(b.sees_order) - Number(a.sees_order));
    return json({ order: { id: o!.id, order_no: o!.order_no, service: o!.service_name, region: o!.region, status: o!.status }, providers });
  });

  /**
   * Per-provider performance for a period: orders that reached them, accepted, declined, left without response,
   * cancelled after accepting (with reasons), completed, and warnings sent.
   */
  r.get("/api/admin/providers/performance", async (c) => {
    await requirePerm(c, ["providers", "analytics"], "view");
    const days = Math.min(365, Math.max(1, Number(c.url.searchParams.get("days") ?? 30) || 30));
    const from = new Date(Date.now() - days * 86400000).toISOString();
    const stale = new Date(Date.now() - 30 * 60000).toISOString();
    const rows = await all<{
      id: string; full_name: string | null; phone: string | null; region: string | null; is_online: number; is_active: number; rating: number;
      offered: number; accepted_now: number; released: number; rejected: number; ignored: number; completed: number; customer_cancelled: number; warnings: number;
    }>(c.env.DB,
      `SELECT u.id, u.full_name, u.phone, u.region, u.is_online, u.is_active, u.rating,
              (SELECT COUNT(*) FROM (
                 SELECT order_id FROM order_offers WHERE provider_id = u.id AND offered_at >= ?1
                 UNION SELECT order_id FROM order_rejections WHERE provider_id = u.id AND created_at >= ?1
                 UNION SELECT id FROM orders WHERE provider_id = u.id AND accepted_at >= ?1)) AS offered,
              (SELECT COUNT(*) FROM orders WHERE provider_id = u.id AND accepted_at >= ?1) AS accepted_now,
              (SELECT COUNT(*) FROM order_rejections WHERE provider_id = u.id AND kind = 'release' AND created_at >= ?1) AS released,
              (SELECT COUNT(*) FROM order_rejections WHERE provider_id = u.id AND kind = 'reject' AND created_at >= ?1) AS rejected,
              (SELECT COUNT(*) FROM order_offers f JOIN orders o ON o.id = f.order_id
                 WHERE f.provider_id = u.id AND f.offered_at >= ?1
                   AND (o.provider_id IS NULL OR o.provider_id <> u.id)
                   AND NOT EXISTS (SELECT 1 FROM order_rejections x WHERE x.order_id = f.order_id AND x.provider_id = u.id)
                   AND (o.status <> 'pending' OR f.offered_at < ?2)) AS ignored,
              (SELECT COUNT(*) FROM orders WHERE provider_id = u.id AND status = 'completed' AND completed_at >= ?1) AS completed,
              (SELECT COUNT(*) FROM orders WHERE provider_id = u.id AND status = 'cancelled' AND cancelled_by = 'customer' AND cancelled_at >= ?1) AS customer_cancelled,
              (SELECT COUNT(*) FROM notification_targets t JOIN notifications n ON n.id = t.notification_id
                 WHERE t.user_id = u.id AND n.category = 'alert' AND n.title LIKE 'تنبيه أداء%' AND n.sent_at >= ?1) AS warnings
         FROM users u
        WHERE EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'provider')
        ORDER BY u.full_name LIMIT 1000`, from, stale);
    return json({
      days,
      providers: rows.map((p) => {
        const accepted = p.accepted_now + p.released;
        return {
          id: p.id, name: p.full_name ?? "—", phone: p.phone, region: p.region, online: !!p.is_online, active: !!p.is_active, rating: p.rating,
          offered: p.offered, accepted, rejected: p.rejected, ignored: p.ignored, released: p.released, completed: p.completed,
          customer_cancelled: p.customer_cancelled, warnings: p.warnings,
          accept_rate: p.offered ? Math.round((accepted / p.offered) * 100) : null,
          response_rate: p.offered ? Math.round(((accepted + p.rejected) / p.offered) * 100) : null,
          flag: p.rejected >= 5 || p.released >= 3 ? "warn" : null,
        };
      }),
    });
  });

  /** Cancellation (after acceptance) and decline history of one provider, with reasons. */
  r.get("/api/admin/providers/:id/performance", async (c) => {
    await requirePerm(c, ["providers", "analytics"], "view");
    return json(await all(c.env.DB,
      `SELECT x.kind, x.reason, x.created_at, o.order_no, o.service_name, o.sub_service_name, o.region, o.status
         FROM order_rejections x JOIN orders o ON o.id = x.order_id
        WHERE x.provider_id = ? ORDER BY x.created_at DESC LIMIT 200`, c.params.id));
  });

  /** One-click fix used by the diagnostics: enable a provider's requested services that were never activated. */
  r.post("/api/admin/providers/:id/sync-services", async (c) => {
    await requirePerm(c, "providers", "edit");
    const u = await first<{ requested_services: string | null }>(c.env.DB, "SELECT requested_services FROM users WHERE id = ?", c.params.id);
    if (!u) fail(404, "not_found", "غير موجود");
    let ids: string[] = [];
    try { ids = JSON.parse(u!.requested_services ?? "[]"); } catch { ids = []; }
    if (ids.length) {
      await c.env.DB.batch(ids.map((sid) => c.env.DB.prepare("INSERT OR IGNORE INTO provider_services (provider_id, service_id) SELECT ?, id FROM services WHERE id = ?").bind(c.params.id, sid)));
    }
    return json({ ok: true, count: ids.length });
  });
}
