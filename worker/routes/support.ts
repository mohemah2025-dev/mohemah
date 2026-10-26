/**
 * Conversations between customers/providers and the administration.
 * A thread is "unanswered" (open, last message from the user), "ongoing" (open, last reply from the
 * administration) or "closed". It closes when the administration or the user ends it, or automatically
 * 48 hours after the last administration reply without an answer. The user then rates the conversation.
 */
import { all, fail, first, json, now, readJson, run, stmt, str, uid, type Ctx, type Router } from "../lib/core";
import { requirePerm, requireUser } from "../lib/auth";
import { notifyStmts } from "../lib/domain";

const AUTO_CLOSE_HOURS = 48;

async function autoClose(c: Ctx) {
  const limit = new Date(Date.now() - AUTO_CLOSE_HOURS * 3600000).toISOString();
  await run(c.env.DB, "UPDATE support_threads SET status = 'closed', closed_by = 'auto', closed_at = ? WHERE status = 'open' AND last_from = 'admin' AND last_message_at < ?", now(), limit);
}

async function openThreadOf(c: Ctx, userId: string) {
  return first<{ id: string }>(c.env.DB, "SELECT id FROM support_threads WHERE user_id = ? AND status = 'open' ORDER BY created_at DESC LIMIT 1", userId);
}

/** A user writes to the administration (adds to the open conversation or starts a new one). */
export async function userWrites(c: Ctx, userId: string, body: string, subject: string | null) {
  await autoClose(c);
  const t = now();
  let thread = await openThreadOf(c, userId);
  const batch = [];
  if (!thread) {
    thread = { id: uid() };
    batch.push(stmt(c.env.DB, "INSERT INTO support_threads (id, user_id, subject, last_from, last_message_at) VALUES (?,?,?,?,?)", thread.id, userId, subject, "user", t));
  } else {
    batch.push(stmt(c.env.DB, "UPDATE support_threads SET last_from = 'user', last_message_at = ? WHERE id = ?", t, thread.id));
  }
  const assigned = await first<{ assigned_to: string | null }>(c.env.DB, "SELECT assigned_to FROM support_threads WHERE id = ?", thread.id);
  const owner = assigned?.assigned_to ?? (await first<{ user_id: string }>(c.env.DB, "SELECT user_id FROM user_roles WHERE role = 'admin' ORDER BY created_at LIMIT 1"))?.user_id ?? null;
  const id = uid();
  batch.push(stmt(c.env.DB, "INSERT INTO messages (id, sender_id, recipient_id, subject, body, thread_id) VALUES (?,?,?,?,?,?)", id, userId, owner, subject, body, thread.id));
  await c.env.DB.batch(batch);
  return id;
}

export function registerSupportRoutes(r: Router) {
  /* ---------- Customer / provider app ---------- */
  r.get("/api/me/support", async (c) => {
    const u = await requireUser(c);
    await autoClose(c);
    const thread = await first<{ id: string; status: string; subject: string | null; assigned_name: string | null; closed_by: string | null; rating: number | null; created_at: string }>(c.env.DB,
      `SELECT t.id, t.status, t.subject, a.full_name AS assigned_name, t.closed_by, t.rating, t.created_at
         FROM support_threads t LEFT JOIN users a ON a.id = t.assigned_to WHERE t.user_id = ? ORDER BY t.created_at DESC LIMIT 1`, u.id);
    const messages = thread
      ? await all(c.env.DB,
          `SELECT m.id, m.body, m.created_at, m.sender_id, m.recipient_id, m.read_at, s.full_name AS sender_name
             FROM messages m LEFT JOIN users s ON s.id = m.sender_id WHERE m.thread_id = ? ORDER BY m.created_at DESC LIMIT 200`, thread.id)
      : [];
    if (thread) await run(c.env.DB, "UPDATE messages SET read_at = ? WHERE thread_id = ? AND recipient_id = ? AND read_at IS NULL", now(), thread.id, u.id);
    return json({ thread, messages });
  });

  r.post("/api/me/support", async (c) => {
    const u = await requireUser(c);
    const b = await readJson(c.req);
    const body = str(b, "body", { required: true, max: 2000, label: "الرسالة" })!;
    return json({ id: await userWrites(c, u.id, body, str(b, "subject", { max: 200 })) }, 201);
  });

  r.post("/api/me/support/close", async (c) => {
    const u = await requireUser(c);
    await run(c.env.DB, "UPDATE support_threads SET status = 'closed', closed_by = 'user', closed_at = ? WHERE user_id = ? AND status = 'open'", now(), u.id);
    return json({ ok: true });
  });

  r.post("/api/me/support/rate", async (c) => {
    const u = await requireUser(c);
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const rating = Math.round(Number(b.rating));
    if (!(rating >= 1 && rating <= 5)) fail(400, "invalid_rating", "اختر تقييماً من 1 إلى 5");
    const note = typeof b.note === "string" ? b.note.trim().slice(0, 500) || null : null;
    const res = await run(c.env.DB,
      `UPDATE support_threads SET rating = ?, rating_note = ? WHERE id = (SELECT id FROM support_threads WHERE user_id = ? AND status = 'closed' AND rating IS NULL ORDER BY closed_at DESC LIMIT 1)`, rating, note, u.id);
    if (!res.meta.changes) fail(409, "nothing_to_rate", "لا توجد محادثة منتهية للتقييم");
    return json({ ok: true });
  });

  /* ---------- Administration ---------- */
  r.get("/api/admin/support", async (c) => {
    await requirePerm(c, "messages", "view");
    await autoClose(c);
    const status = c.url.searchParams.get("status") ?? "unanswered";
    const where = status === "closed" ? "t.status = 'closed'" : status === "ongoing" ? "t.status = 'open' AND t.last_from = 'admin'" : "t.status = 'open' AND t.last_from = 'user'";
    const [rows, counts, staff] = await Promise.all([
      all(c.env.DB,
        `SELECT t.id, t.user_id, t.subject, t.status, t.last_from, t.last_message_at, t.closed_at, t.closed_by, t.rating, t.rating_note, t.created_at,
                u.full_name AS user_name, u.phone AS user_phone, u.member_no,
                CASE WHEN EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'provider') THEN 'provider' ELSE 'customer' END AS user_kind,
                a.full_name AS assigned_name, t.assigned_to,
                (SELECT body FROM messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_body,
                (SELECT COUNT(*) FROM messages m WHERE m.thread_id = t.id) AS count
           FROM support_threads t JOIN users u ON u.id = t.user_id LEFT JOIN users a ON a.id = t.assigned_to
          WHERE ${where} ORDER BY t.last_message_at ${status === "unanswered" ? "ASC" : "DESC"} LIMIT 300`),
      first<{ unanswered: number; ongoing: number; closed: number }>(c.env.DB,
        `SELECT SUM(status = 'open' AND last_from = 'user') AS unanswered, SUM(status = 'open' AND last_from = 'admin') AS ongoing, SUM(status = 'closed') AS closed FROM support_threads`),
      all(c.env.DB, "SELECT u.id, u.full_name FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role IN ('admin','staff') GROUP BY u.id ORDER BY u.full_name"),
    ]);
    return json({ threads: rows, counts: { unanswered: counts?.unanswered ?? 0, ongoing: counts?.ongoing ?? 0, closed: counts?.closed ?? 0 }, staff, auto_close_hours: AUTO_CLOSE_HOURS });
  });

  r.get("/api/admin/support/:id", async (c) => {
    await requirePerm(c, "messages", "view");
    const t = await first(c.env.DB,
      `SELECT t.*, u.full_name AS user_name, u.phone AS user_phone, u.member_no, a.full_name AS assigned_name
         FROM support_threads t JOIN users u ON u.id = t.user_id LEFT JOIN users a ON a.id = t.assigned_to WHERE t.id = ?`, c.params.id);
    if (!t) fail(404, "not_found", "المحادثة غير موجودة");
    const messages = await all(c.env.DB,
      `SELECT m.id, m.body, m.subject, m.created_at, m.sender_id, s.full_name AS sender_name, (m.sender_id = ?2) AS from_user
         FROM messages m LEFT JOIN users s ON s.id = m.sender_id WHERE m.thread_id = ?1 ORDER BY m.created_at`, c.params.id, (t as { user_id: string }).user_id);
    await run(c.env.DB, "UPDATE messages SET read_at = ? WHERE thread_id = ? AND sender_id = ? AND read_at IS NULL", now(), c.params.id, (t as { user_id: string }).user_id);
    return json({ thread: t, messages });
  });

  r.post("/api/admin/support/:id/reply", async (c) => {
    const admin = await requirePerm(c, "messages", "edit");
    const body = str(await readJson(c.req), "body", { required: true, max: 2000, label: "الرد" })!;
    const t = await first<{ user_id: string; status: string; assigned_to: string | null }>(c.env.DB, "SELECT user_id, status, assigned_to FROM support_threads WHERE id = ?", c.params.id);
    if (!t) fail(404, "not_found", "المحادثة غير موجودة");
    const ts = now();
    await c.env.DB.batch([
      stmt(c.env.DB, "INSERT INTO messages (id, sender_id, recipient_id, body, thread_id) VALUES (?,?,?,?,?)", uid(), admin.id, t!.user_id, body, c.params.id),
      // Replying re-opens a closed conversation and assigns it to the replier when nobody owns it.
      stmt(c.env.DB, "UPDATE support_threads SET status = 'open', closed_at = NULL, closed_by = NULL, last_from = 'admin', last_message_at = ?, assigned_to = COALESCE(assigned_to, ?) WHERE id = ?", ts, admin.id, c.params.id),
      ...notifyStmts(c, [t!.user_id], { title: "رد من الإدارة", body: body.slice(0, 150), category: "general", icon: "megaphone", created_by: admin.id }),
    ]);
    return json({ ok: true });
  });

  r.post("/api/admin/support/:id/assign", async (c) => {
    await requirePerm(c, "messages", "edit");
    const to = str(await readJson(c.req), "admin_id", { max: 64 });
    if (to && !(await first(c.env.DB, "SELECT 1 FROM user_roles WHERE user_id = ? AND role IN ('admin','staff')", to))) fail(400, "not_staff", "اختر موظفاً من الإدارة");
    await run(c.env.DB, "UPDATE support_threads SET assigned_to = ? WHERE id = ?", to, c.params.id);
    return json({ ok: true });
  });

  r.post("/api/admin/support/:id/close", async (c) => {
    const admin = await requirePerm(c, "messages", "edit");
    const t = await first<{ user_id: string }>(c.env.DB, "SELECT user_id FROM support_threads WHERE id = ? AND status = 'open'", c.params.id);
    if (!t) fail(409, "not_open", "المحادثة منتهية مسبقاً");
    await c.env.DB.batch([
      stmt(c.env.DB, "UPDATE support_threads SET status = 'closed', closed_by = ?, closed_at = ? WHERE id = ?", "admin", now(), c.params.id),
      ...notifyStmts(c, [t!.user_id], { title: "تم إنهاء المحادثة", body: "شكراً لتواصلك، نرجو تقييم المحادثة من صفحة مراسلة الإدارة.", category: "general", icon: "check", created_by: admin.id }),
    ]);
    return json({ ok: true });
  });

  /** The administration starts (or continues) a conversation with a user. */
  r.post("/api/admin/support/start", async (c) => {
    const admin = await requirePerm(c, "messages", "edit");
    const b = await readJson(c.req);
    const userId = str(b, "user_id", { required: true, max: 64, label: "المستخدم" })!;
    const body = str(b, "body", { required: true, max: 2000, label: "الرسالة" })!;
    const subject = str(b, "subject", { max: 200 });
    if (!(await first(c.env.DB, "SELECT 1 FROM users WHERE id = ?", userId))) fail(404, "not_found", "المستخدم غير موجود");
    let thread = await openThreadOf(c, userId);
    const ts = now();
    const batch = [];
    if (!thread) {
      thread = { id: uid() };
      batch.push(stmt(c.env.DB, "INSERT INTO support_threads (id, user_id, subject, assigned_to, last_from, last_message_at) VALUES (?,?,?,?,?,?)", thread.id, userId, subject, admin.id, "admin", ts));
    } else {
      batch.push(stmt(c.env.DB, "UPDATE support_threads SET last_from = 'admin', last_message_at = ?, assigned_to = COALESCE(assigned_to, ?) WHERE id = ?", ts, admin.id, thread.id));
    }
    batch.push(stmt(c.env.DB, "INSERT INTO messages (id, sender_id, recipient_id, subject, body, thread_id) VALUES (?,?,?,?,?,?)", uid(), admin.id, userId, subject, body, thread.id));
    batch.push(...notifyStmts(c, [userId], { title: subject ?? "رسالة جديدة من الإدارة", body: body.slice(0, 150), category: "general", icon: "megaphone", created_by: admin.id }));
    await c.env.DB.batch(batch);
    return json({ id: thread.id }, 201);
  });
}
