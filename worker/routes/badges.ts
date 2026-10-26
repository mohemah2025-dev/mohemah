/**
 * Pending-work counters for the admin panel: a number on each page in the sidebar plus the bell list.
 * A counter drops by itself once the item is handled (application reviewed, message answered…).
 */
import { first, json, type Router } from "../lib/core";
import { accessOf, requireAdmin } from "../lib/auth";

export function registerBadgeRoutes(r: Router) {
  r.get("/api/admin/badges", async (c) => {
    const u = await requireAdmin(c);
    const { perms } = await accessOf(c, u);
    const can = (s: keyof typeof perms) => perms[s] !== "none";
    const stuck = new Date(Date.now() - 15 * 60000).toISOString();
    const n = async (sql: string, ...args: unknown[]) => (await first<{ n: number }>(c.env.DB, sql, ...args))?.n ?? 0;
    const [applications, serviceRequests, unanswered, stuckOrders, unrated] = await Promise.all([
      can("providers") ? n("SELECT COUNT(*) AS n FROM users WHERE verification_status = 'pending'") : 0,
      can("providers") ? n("SELECT COUNT(*) AS n FROM service_requests WHERE status = 'pending'") : 0,
      can("messages") ? n("SELECT COUNT(*) AS n FROM support_threads WHERE status = 'open' AND last_from = 'user'") : 0,
      can("analytics") ? n("SELECT COUNT(*) AS n FROM orders WHERE status = 'pending' AND provider_id IS NULL AND created_at < ?", stuck) : 0,
      can("messages") ? n("SELECT COUNT(*) AS n FROM support_threads WHERE status = 'closed' AND rating IS NOT NULL AND rating <= 2 AND closed_at > ?", new Date(Date.now() - 2 * 86400000).toISOString()) : 0,
    ]);
    const items = [
      { section: "providers", to: "/admin/providers", count: applications, label: "طلبات انضمام مقدمي خدمة بانتظار المراجعة" },
      { section: "providers", to: "/admin/providers", count: serviceRequests, label: "طلبات إضافة خدمات بانتظار القبول" },
      { section: "messages", to: "/admin/messages", count: unanswered, label: "رسائل لم يتم الرد عليها" },
      { section: "analytics", to: "/admin/analytics", count: stuckOrders, label: "طلبات معلّقة بلا مقدم خدمة منذ أكثر من 15 دقيقة" },
      { section: "messages", to: "/admin/messages", count: unrated, label: "محادثات منتهية بتقييم منخفض (آخر يومين)" },
    ].filter((x) => x.count > 0);
    const counts: Record<string, number> = {};
    // The low-rating note is informative only; it does not add to the page counter.
    items.filter((x) => !x.label.startsWith("محادثات منتهية")).forEach((x) => { counts[x.section] = (counts[x.section] ?? 0) + x.count; });
    return json({ counts, items, total: Object.values(counts).reduce((a, b) => a + b, 0) });
  });
}
