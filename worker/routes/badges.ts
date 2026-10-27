/**
 * Pending-work counters for the admin panel (a number on the page in the sidebar plus the bell list).
 * Only: unanswered messages, new provider applications, and providers with performance notes not yet reviewed.
 * A counter drops by itself once the item is handled (message answered, application reviewed, profile opened).
 */
import { first, json, type Router } from "../lib/core";
import { accessOf, requireAdmin } from "../lib/auth";

/** Automatic performance warnings newer than the last review of the provider's profile (last 14 days). */
export const NOTED_PROVIDERS_SQL = `SELECT COUNT(DISTINCT u.id) AS n FROM users u
  JOIN notification_targets t ON t.user_id = u.id JOIN notifications n ON n.id = t.notification_id
 WHERE n.category = 'alert' AND n.title LIKE 'تنبيه أداء%' AND n.created_by IS NULL AND n.sent_at >= ?
   AND n.sent_at > COALESCE(u.perf_reviewed_at, '')`;

export function registerBadgeRoutes(r: Router) {
  r.get("/api/admin/badges", async (c) => {
    const u = await requireAdmin(c);
    const owner = u.roles.includes("admin");
    const { perms } = await accessOf(c, u);
    const n = async (sql: string, ...args: unknown[]) => (await first<{ n: number }>(c.env.DB, sql, ...args))?.n ?? 0;
    const since = new Date(Date.now() - 14 * 86400000).toISOString();
    const [unanswered, applications, noted, cancels] = await Promise.all([
      // Every staff member sees the messages; the counter shows conversations waiting for them (unassigned or theirs).
      owner ? n("SELECT COUNT(*) AS n FROM support_threads WHERE status = 'open' AND last_from = 'user'")
        : n("SELECT COUNT(*) AS n FROM support_threads WHERE status = 'open' AND last_from = 'user' AND (assigned_to IS NULL OR assigned_to = ?)", u.id),
      perms.providers !== "none" ? n("SELECT COUNT(*) AS n FROM users WHERE verification_status = 'pending'") : 0,
      perms.providers !== "none" ? n(NOTED_PROVIDERS_SQL, since) : 0,
      n("SELECT COUNT(*) AS n FROM orders WHERE status = 'cancelled' AND cancelled_by = 'customer' AND cancel_code IS NOT NULL AND cancel_reviewed_at IS NULL"),
    ]);
    const items = [
      { section: "messages", to: "/admin/messages", count: unanswered, label: "رسائل لم يتم الرد عليها" },
      { section: "messages", to: "/admin/messages", count: cancels, label: "طلبات ألغاها العملاء (أسباب الرفض بانتظار المراجعة)" },
      { section: "providers", to: "/admin/providers", count: applications, label: "مقدمو خدمة جدد بانتظار المراجعة" },
      { section: "providers", to: "/admin/providers", count: noted, label: "مقدمو خدمة عليهم ملاحظات أداء (افتح ملفهم للمراجعة)" },
    ].filter((x) => x.count > 0);
    const counts: Record<string, number> = {};
    items.forEach((x) => { counts[x.section] = (counts[x.section] ?? 0) + x.count; });
    return json({ counts, items, total: items.reduce((a, x) => a + x.count, 0) });
  });
}
