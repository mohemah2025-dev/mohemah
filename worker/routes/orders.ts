import {
  all, fail, first, json, now, num, oneOf, readJson, REGIONS, run, stmt, str, strArray, uid, inList,
  type Ctx, type Router,
} from "../lib/core";
import { requireProvider, requireUser } from "../lib/auth";
import { notifyExternal } from "../lib/messaging";
import {
  activeSubscriptionEnd, getSettings, latestSubscriptionEnd, notifyStmts, orderNo, recomputeCustomerRating,
  recomputeProviderRating,
} from "../lib/domain";

type OrderRow = {
  id: string; order_no: number; customer_id: string | null; provider_id: string | null; service_id: string | null; sub_service_id: string | null;
  service_name: string; sub_service_name: string | null; mode: "in_person" | "remote"; description: string | null; address: string | null;
  region: string | null; lat: number | null; lng: number | null; scheduled_at: string | null; status: string; coin_cost: number;
  charged_coins: number; billing_mode: string | null; rating: number | null; review: string | null; customer_rating: number | null;
  cancelled_by: string | null; cancel_reason: string | null; created_at: string; accepted_at: string | null; arrived_at: string | null;
  started_at: string | null; completed_at: string | null; cancelled_at: string | null;
};

const ACTIVE = ["accepted", "arrived", "in_progress"];
const orderLabel = (o: { sub_service_name: string | null; service_name: string }) => o.sub_service_name ?? o.service_name;

async function getOrder(c: Ctx, id: string) {
  const o = await first<OrderRow>(c.env.DB, "SELECT * FROM orders WHERE id = ?", id);
  if (!o) fail(404, "not_found", "الطلب غير موجود");
  return o!;
}

const firstName = (n: string | null) => (n ?? "").trim().split(/\s+/)[0] || "عميل";

export function registerOrderRoutes(r: Router) {
  /* =================== Customer =================== */
  r.post("/api/orders", async (c) => {
    const u = await requireUser(c, { app: "customer" });
    const b = await readJson(c.req);
    const subId = str(b, "sub_service_id", { required: true, max: 64, label: "الخدمة" })!;
    const sub = await first<{ id: string; name: string; delivery_mode: string; coin_price: number | null; service_id: string; service_name: string; service_price: number }>(c.env.DB,
      `SELECT s.id, s.name, s.delivery_mode, s.coin_price, p.id AS service_id, p.name AS service_name, p.coin_price AS service_price
         FROM sub_services s JOIN services p ON p.id = s.service_id WHERE s.id = ? AND s.active = 1 AND p.active = 1`, subId);
    if (!sub) fail(404, "service_unavailable", "الخدمة غير متاحة حالياً");
    const mode = oneOf(b, "mode", ["in_person", "remote"] as const, { required: true, label: "نوع الخدمة" })!;
    if (sub!.delivery_mode !== "both" && sub!.delivery_mode !== mode) fail(400, "mode_unavailable", mode === "remote" ? "هذه الخدمة حضورية فقط" : "هذه الخدمة عن بُعد فقط");
    const description = str(b, "description", { max: 1000, label: "شرح الطلب" });
    if (!description || description.length < 5) fail(400, "missing_description", "اكتب شرحاً مختصراً للطلب");
    const region = oneOf(b, "region", REGIONS, { required: true, label: "المدينة" });
    const address = str(b, "address", { max: 300, label: "العنوان" });
    if (mode === "in_person" && !address) fail(400, "missing_address", "حدد عنوان تنفيذ الخدمة");
    const lat = num(b, "lat", { min: -90, max: 90 });
    const lng = num(b, "lng", { min: -180, max: 180 });
    const scheduled = str(b, "scheduled_at", { max: 40 });
    let scheduled_at: string | null = null;
    if (scheduled) {
      const t = Date.parse(scheduled);
      if (!Number.isFinite(t) || t < Date.now() - 5 * 60000 || t > Date.now() + 60 * 86400000) fail(400, "invalid_time", "موعد التنفيذ غير صالح");
      scheduled_at = new Date(t).toISOString();
    }
    const open = await first<{ n: number }>(c.env.DB, "SELECT COUNT(*) AS n FROM orders WHERE customer_id = ? AND status = 'pending'", u.id);
    if ((open?.n ?? 0) >= 5) fail(429, "too_many_pending", "لديك 5 طلبات بانتظار القبول، انتظر قبولها أو ألغِ بعضها");
    const id = uid();
    // Cost is always computed here from the service price; the client never decides it.
    const cost = sub!.coin_price ?? sub!.service_price;
    await run(c.env.DB,
      `INSERT INTO orders (id, customer_id, service_id, sub_service_id, service_name, sub_service_name, mode, description, address, region, lat, lng, scheduled_at, coin_cost)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, u.id, sub!.service_id, sub!.id, sub!.service_name, sub!.name, mode, description, address, region, lat, lng, scheduled_at, cost);
    const o = await getOrder(c, id);
    // Push "new order" to providers who are online, offer this service and work in this city.
    const providers = await all<{ id: string }>(c.env.DB,
      `SELECT u.id FROM users u JOIN provider_services ps ON ps.provider_id = u.id
        WHERE ps.service_id = ? AND u.is_online = 1 AND u.is_active = 1 AND u.id <> ? AND (u.region IS NULL OR u.region = ?)
          AND EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'provider') LIMIT 500`,
      sub!.service_id, u.id, region);
    if (providers.length) {
      c.push.push({
        userIds: providers.map((p) => p.id), app: "provider",
        message: { title: "طلب جديد", body: `${sub!.name}${region ? ` • ${region}` : ""} — افتح التطبيق لقبول الطلب`, data: { link: "/provider/orders", order_id: id } },
      });
    }
    return json({ id, order_no: orderNo(o.order_no) }, 201);
  });

  r.get("/api/orders/mine", async (c) => {
    const u = await requireUser(c, { app: "customer" });
    const rows = await all<OrderRow & { p_name: string | null; p_phone: string | null; p_rating: number | null; p_nationality: string | null; p_rating_count: number | null; p_avatar: string | null; unread: number }>(c.env.DB,
      `SELECT o.*, p.full_name AS p_name, p.phone AS p_phone, p.rating AS p_rating, p.rating_count AS p_rating_count, p.nationality AS p_nationality, p.avatar_url AS p_avatar,
              (SELECT COUNT(*) FROM messages m WHERE m.order_id = o.id AND m.recipient_id = ?1 AND m.read_at IS NULL) AS unread
         FROM orders o LEFT JOIN users p ON p.id = o.provider_id
        WHERE o.customer_id = ?1 ORDER BY o.created_at DESC LIMIT 100`, u.id);
    return json(rows.map((o) => {
      const showContact = ACTIVE.includes(o.status);
      return {
        id: o.id, order_no: orderNo(o.order_no), service_id: o.service_id, sub_service_id: o.sub_service_id, service_name: o.service_name,
        sub_service_name: o.sub_service_name, mode: o.mode, description: o.description, address: o.address, region: o.region,
        scheduled_at: o.scheduled_at, status: o.status, rating: o.rating, review: o.review, cancelled_by: o.cancelled_by, cancel_reason: o.cancel_reason,
        created_at: o.created_at, accepted_at: o.accepted_at, arrived_at: o.arrived_at, started_at: o.started_at, completed_at: o.completed_at, cancelled_at: o.cancelled_at,
        unread: o.unread,
        provider: o.provider_id ? { id: o.provider_id, name: o.p_name, rating: o.p_rating, rating_count: o.p_rating_count, nationality: o.p_nationality, avatar_url: o.p_avatar, phone: showContact ? o.p_phone : null } : null,
      };
    }));
  });

  r.post("/api/orders/:id/cancel", async (c) => {
    const u = await requireUser(c, { app: "customer" });
    const o = await getOrder(c, c.params.id);
    if (o.customer_id !== u.id) fail(403, "forbidden", "لا يمكنك إلغاء هذا الطلب");
    if (!["pending", "accepted"].includes(o.status)) fail(409, "cannot_cancel", "لا يمكن إلغاء الطلب بعد وصول مقدم الخدمة أو بدء التنفيذ");
    const reason = str(await readJson(c.req), "reason", { max: 300 });
    const t = now();
    const batch = [stmt(c.env.DB,
      "UPDATE orders SET status = 'cancelled', cancelled_by = 'customer', cancel_reason = ?, cancelled_at = ?, updated_at = ? WHERE id = ? AND customer_id = ? AND status IN ('pending','accepted')",
      reason, t, t, o.id, u.id)];
    if (o.provider_id && o.status === "accepted") {
      const guard = "EXISTS (SELECT 1 FROM orders WHERE id = ?2 AND cancelled_at = ?3)";
      if (o.charged_coins > 0) {
        batch.push(stmt(c.env.DB, `UPDATE users SET coin_balance = coin_balance + ?4 WHERE id = ?1 AND ${guard}`, o.provider_id, o.id, t, o.charged_coins));
        batch.push(stmt(c.env.DB,
          `INSERT INTO coin_transactions (id, provider_id, order_id, amount, tx_type, balance_after, description)
           SELECT ?5, ?1, ?2, ?4, 'refund', (SELECT coin_balance FROM users WHERE id = ?1), 'استرجاع: ألغى العميل الطلب' WHERE ${guard}`,
          o.provider_id, o.id, t, o.charged_coins, uid()));
      }
      batch.push(...notifyStmts(c, [o.provider_id], { title: "تم إلغاء طلب", body: `ألغى العميل طلب ${orderLabel(o)}${o.charged_coins ? ` وأُعيدت ${o.charged_coins} كوين لرصيدك` : ""}.`, link: "/provider/orders", icon: "XCircle" }));
    }
    await c.env.DB.batch(batch);
    const after = await getOrder(c, o.id);
    if (after.status !== "cancelled") fail(409, "cannot_cancel", "تغيّرت حالة الطلب، حدّث الصفحة");
    return json({ ok: true });
  });

  r.post("/api/orders/:id/rate", async (c) => {
    const u = await requireUser(c, { app: "customer" });
    const o = await getOrder(c, c.params.id);
    if (o.customer_id !== u.id) fail(403, "forbidden", "لا يمكنك تقييم هذا الطلب");
    if (o.status !== "completed") fail(409, "not_completed", "يمكن التقييم بعد اكتمال الطلب");
    if (o.rating) fail(409, "already_rated", "تم تقييم هذا الطلب مسبقاً");
    const b = await readJson(c.req);
    const rating = num(b, "rating", { required: true, min: 1, max: 5, int: true, label: "التقييم" })!;
    const review = str(b, "review", { max: 500 });
    if (rating <= 2 && !review) fail(400, "missing_reason", "اكتب سبب التقييم المنخفض");
    await c.env.DB.batch([
      stmt(c.env.DB, "UPDATE orders SET rating = ?, review = ?, updated_at = ? WHERE id = ? AND rating IS NULL", rating, review, now(), o.id),
      ...(o.provider_id ? [recomputeProviderRating(c.env, o.provider_id), ...notifyStmts(c, [o.provider_id], {
        title: "تقييم جديد", body: `حصلت على تقييم ${rating} من 5${review ? " مع ملاحظة من العميل" : ""}`, link: "/provider/account/ratings", icon: "Star",
      })] : []),
    ]);
    return json({ ok: true });
  });

  /* =================== Order chat (customer ↔ provider) =================== */
  async function chatAccess(c: Ctx) {
    const u = await requireUser(c, { app: ["customer", "provider"] });
    const o = await getOrder(c, c.params.id);
    const isCustomer = o.customer_id === u.id && u.app === "customer";
    const isProvider = o.provider_id === u.id && u.app === "provider";
    if (!isCustomer && !isProvider) fail(403, "forbidden", "المحادثة متاحة لطرفي الطلب فقط");
    return { u, o, other: isCustomer ? o.provider_id : o.customer_id };
  }
  r.get("/api/orders/:id/messages", async (c) => {
    const { u, o } = await chatAccess(c);
    await run(c.env.DB, "UPDATE messages SET read_at = ? WHERE order_id = ? AND recipient_id = ? AND read_at IS NULL", now(), o.id, u.id);
    return json(await all(c.env.DB, "SELECT id, sender_id, body, created_at FROM messages WHERE order_id = ? ORDER BY created_at LIMIT 300", o.id));
  });
  r.post("/api/orders/:id/messages", async (c) => {
    const { u, o, other } = await chatAccess(c);
    if (!other) fail(409, "no_counterpart", "لم يُقبل الطلب بعد");
    if (!ACTIVE.includes(o.status) && o.status !== "completed") fail(409, "chat_closed", "المحادثة مغلقة لهذا الطلب");
    const body = str(await readJson(c.req), "body", { required: true, max: 1000, label: "الرسالة" })!;
    const id = uid();
    await run(c.env.DB, "INSERT INTO messages (id, sender_id, recipient_id, order_id, body) VALUES (?,?,?,?,?)", id, u.id, other, o.id, body);
    c.push.push({
      userIds: [other!], app: u.app === "customer" ? "provider" : "customer",
      message: { title: u.app === "customer" ? "رسالة من العميل" : "رسالة من مقدم الخدمة", body: body.slice(0, 180), data: { link: u.app === "customer" ? "/provider/orders" : "/orders", order_id: o.id, chat: "1" } },
    });
    return json({ id, sender_id: u.id, body, created_at: now() }, 201);
  });

  /* =================== Provider =================== */
  async function providerProfile(c: Ctx, id: string) {
    return (await first<{ region: string | null; is_online: number; coin_balance: number; billing_mode: string; verification_status: string }>(c.env.DB,
      "SELECT region, is_online, coin_balance, billing_mode, verification_status FROM users WHERE id = ?", id))!;
  }

  r.get("/api/provider/feed", async (c) => {
    const u = await requireProvider(c);
    const p = await providerProfile(c, u.id);
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const [available, active, svc] = await Promise.all([
      all<OrderRow & { customer_name: string | null; c_rating: number; c_rating_count: number }>(c.env.DB,
        `SELECT o.*, cu.full_name AS customer_name, cu.customer_rating AS c_rating, cu.customer_rating_count AS c_rating_count
           FROM orders o LEFT JOIN users cu ON cu.id = o.customer_id
          WHERE o.status = 'pending' AND o.created_at >= ?2 AND (o.customer_id IS NULL OR o.customer_id <> ?1)
            AND o.service_id IN (SELECT service_id FROM provider_services WHERE provider_id = ?1)
            AND NOT EXISTS (SELECT 1 FROM order_rejections x WHERE x.order_id = o.id AND x.provider_id = ?1)
            AND (?3 IS NULL OR o.region IS NULL OR o.region = ?3)
          ORDER BY o.created_at DESC LIMIT 30`, u.id, since, p.region),
      all<OrderRow & { customer_name: string | null; customer_phone: string | null; c_rating: number; unread: number }>(c.env.DB,
        `SELECT o.*, cu.full_name AS customer_name, cu.phone AS customer_phone, cu.customer_rating AS c_rating,
                (SELECT COUNT(*) FROM messages m WHERE m.order_id = o.id AND m.recipient_id = ?1 AND m.read_at IS NULL) AS unread
           FROM orders o LEFT JOIN users cu ON cu.id = o.customer_id
          WHERE o.provider_id = ?1 AND o.status IN ('accepted','arrived','in_progress') ORDER BY o.accepted_at DESC`, u.id),
      first<{ n: number }>(c.env.DB, "SELECT COUNT(*) AS n FROM provider_services WHERE provider_id = ?", u.id),
    ]);
    return json({
      online: !!p.is_online, region: p.region, services_count: svc?.n ?? 0, balance: p.coin_balance, billing_mode: p.billing_mode,
      subscription_end: await activeSubscriptionEnd(c.env, u.id),
      available: available.map((o) => ({
        id: o.id, order_no: orderNo(o.order_no), service_name: o.service_name, sub_service_name: o.sub_service_name, mode: o.mode,
        description: o.description, region: o.region, scheduled_at: o.scheduled_at, coin_cost: o.coin_cost, created_at: o.created_at,
        customer: { name: firstName(o.customer_name), rating: o.c_rating, rating_count: o.c_rating_count },
      })),
      active: active.map((o) => ({
        id: o.id, order_no: orderNo(o.order_no), service_name: o.service_name, sub_service_name: o.sub_service_name, mode: o.mode,
        description: o.description, region: o.region, address: o.address, lat: o.lat, lng: o.lng, scheduled_at: o.scheduled_at,
        status: o.status, coin_cost: o.coin_cost, charged_coins: o.charged_coins, billing_mode: o.billing_mode, created_at: o.created_at,
        accepted_at: o.accepted_at, arrived_at: o.arrived_at, started_at: o.started_at, unread: o.unread,
        customer: { id: o.customer_id, name: o.customer_name, phone: o.customer_phone, rating: o.c_rating },
      })),
    });
  });

  r.post("/api/provider/online", async (c) => {
    const u = await requireProvider(c);
    const online = (await readJson(c.req)).online === true;
    await run(c.env.DB, "UPDATE users SET is_online = ?, last_seen_at = ? WHERE id = ?", online ? 1 : 0, now(), u.id);
    return json({ online });
  });

  r.post("/api/orders/:id/accept", async (c) => {
    const u = await requireProvider(c);
    const o = await getOrder(c, c.params.id);
    if (o.status !== "pending") fail(409, "not_pending", "قبل هذا الطلب مقدم خدمة آخر أو أُلغي");
    if (o.customer_id === u.id) fail(409, "own_order", "لا يمكنك قبول طلبك الشخصي");
    const offers = await first(c.env.DB, "SELECT 1 FROM provider_services WHERE provider_id = ? AND service_id = ?", u.id, o.service_id);
    if (!offers) fail(403, "service_not_offered", "هذا الطلب خارج الخدمات التي تقدمها");
    // Business rule: an in-person job blocks new orders until finished; an in-person order needs a free schedule.
    const busy = await all<{ mode: string }>(c.env.DB, "SELECT mode FROM orders WHERE provider_id = ? AND status IN ('accepted','arrived','in_progress')", u.id);
    if (busy.some((x) => x.mode === "in_person")) fail(409, "busy_in_person", "لديك طلب حضوري جارٍ، أكمله قبل قبول طلب جديد");
    if (o.mode === "in_person" && busy.length) fail(409, "busy", "لا يمكن قبول طلب حضوري أثناء وجود طلبات أخرى جارية");

    const s = await getSettings(c.env);
    const p = await providerProfile(c, u.id);
    const subEnd = await activeSubscriptionEnd(c.env, u.id);
    const t = now();
    const label = orderLabel(o);
    const smsAccepted = () => { if (o.customer_id) notifyExternal(c, [o.customer_id], { title: "تم قبول طلبك", body: `قبل مقدم الخدمة طلبك (${label})، تابع الحالة من تطبيق مهمة.`, email: false }); };
    const notifyCustomer = o.customer_id ? notifyStmts(c, [o.customer_id], { title: "تم قبول طلبك", body: `قبل مقدم الخدمة طلب ${label}، تابع الحالة من صفحة الطلبات.`, link: "/orders", icon: "CheckCircle2" }) : [];

    // An active subscription (paid or gifted) always covers the order; otherwise coins are charged when enabled.
    if (subEnd) {
      await c.env.DB.batch([
        stmt(c.env.DB, "UPDATE orders SET status = 'accepted', provider_id = ?, accepted_at = ?, billing_mode = 'subscription', charged_coins = 0, updated_at = ? WHERE id = ? AND status = 'pending'", u.id, t, t, o.id),
      ]);
      const after = await getOrder(c, o.id);
      if (after.provider_id !== u.id || after.accepted_at !== t) fail(409, "not_pending", "قبل هذا الطلب مقدم خدمة آخر");
      if (notifyCustomer.length) { await c.env.DB.batch(notifyCustomer); smsAccepted(); }
      return json({ success: true, mode: "subscription", balance: p.coin_balance });
    }

    if (!s.billing_coins_enabled) return json({ success: false, error: "subscription_required" }, 402);
    const cost = o.coin_cost;
    if (p.coin_balance < cost) return json({ success: false, error: "insufficient_balance", balance: p.coin_balance, required: cost }, 402);
    const mine = "EXISTS (SELECT 1 FROM orders WHERE id = ?2 AND provider_id = ?1 AND accepted_at = ?3)";
    await c.env.DB.batch([
      stmt(c.env.DB,
        `UPDATE orders SET status = 'accepted', provider_id = ?1, accepted_at = ?3, billing_mode = 'coins', charged_coins = ?4, updated_at = ?3
          WHERE id = ?2 AND status = 'pending' AND (SELECT coin_balance FROM users WHERE id = ?1) >= ?4`, u.id, o.id, t, cost),
      stmt(c.env.DB, `UPDATE users SET coin_balance = coin_balance - ?4 WHERE id = ?1 AND ${mine}`, u.id, o.id, t, cost),
      stmt(c.env.DB,
        `INSERT INTO coin_transactions (id, provider_id, order_id, amount, tx_type, balance_after, description)
         SELECT ?5, ?1, ?2, ?4, 'deduction', (SELECT coin_balance FROM users WHERE id = ?1), ?6 WHERE ${mine}`, u.id, o.id, t, cost, uid(), `قبول طلب: ${label}`),
    ]);
    const after = await getOrder(c, o.id);
    if (after.provider_id !== u.id || after.accepted_at !== t) {
      const bal = (await providerProfile(c, u.id)).coin_balance;
      if (bal < cost) return json({ success: false, error: "insufficient_balance", balance: bal, required: cost }, 402);
      fail(409, "not_pending", "قبل هذا الطلب مقدم خدمة آخر");
    }
    if (notifyCustomer.length) { await c.env.DB.batch(notifyCustomer); smsAccepted(); }
    return json({ success: true, mode: "coins", balance: (await providerProfile(c, u.id)).coin_balance });
  });

  r.post("/api/orders/:id/reject", async (c) => {
    const u = await requireProvider(c);
    await run(c.env.DB, "INSERT OR IGNORE INTO order_rejections (order_id, provider_id) SELECT id, ? FROM orders WHERE id = ?", u.id, c.params.id);
    return json({ ok: true });
  });

  /** Moves the job one step: accepted → arrived → in_progress → completed (remote jobs skip "arrived"). */
  r.post("/api/orders/:id/advance", async (c) => {
    const u = await requireProvider(c);
    const o = await getOrder(c, c.params.id);
    if (o.provider_id !== u.id) fail(403, "forbidden", "هذا الطلب ليس لك");
    const t = now();
    const label = orderLabel(o);
    let next: string;
    let col: string;
    let note: { title: string; body: string; icon: string };
    if (o.status === "accepted" && o.mode === "in_person") { next = "arrived"; col = "arrived_at"; note = { title: "مقدم الخدمة عند الباب", body: `وصل مقدم الخدمة لتنفيذ طلب ${label}.`, icon: "DoorOpen" }; }
    else if (o.status === "accepted" || o.status === "arrived") { next = "in_progress"; col = "started_at"; note = { title: "بدأ تنفيذ طلبك", body: `بدأ مقدم الخدمة تنفيذ ${label}.`, icon: "Wrench" }; }
    else if (o.status === "in_progress") { next = "completed"; col = "completed_at"; note = { title: "تم تنفيذ المهمة", body: `اكتمل طلب ${label}، قيّم الخدمة من صفحة الطلبات.`, icon: "CircleCheck" }; }
    else return fail(409, "invalid_status", "لا يمكن تحديث حالة هذا الطلب");
    const res = await run(c.env.DB, `UPDATE orders SET status = ?, ${col} = ?, updated_at = ? WHERE id = ? AND provider_id = ? AND status = ?`, next, t, t, o.id, u.id, o.status);
    if (!res.meta.changes) fail(409, "status_changed", "تغيّرت حالة الطلب، حدّث الصفحة");
    if (o.customer_id) await c.env.DB.batch(notifyStmts(c, [o.customer_id], { ...note, link: "/orders" }));
    return json({ status: next });
  });

  /** Provider withdraws from an accepted job; the order returns to the pool (no coin refund). */
  r.post("/api/orders/:id/release", async (c) => {
    const u = await requireProvider(c);
    const o = await getOrder(c, c.params.id);
    if (o.provider_id !== u.id || !["accepted", "arrived"].includes(o.status)) fail(409, "cannot_release", "لا يمكن الاعتذار عن هذا الطلب الآن");
    const reason = str(await readJson(c.req), "reason", { max: 300 });
    const t = now();
    await c.env.DB.batch([
      stmt(c.env.DB, "UPDATE orders SET status = 'pending', provider_id = NULL, accepted_at = NULL, arrived_at = NULL, billing_mode = NULL, charged_coins = 0, cancel_reason = ?, updated_at = ? WHERE id = ? AND provider_id = ? AND status IN ('accepted','arrived')", reason, t, o.id, u.id),
      stmt(c.env.DB, "INSERT OR IGNORE INTO order_rejections (order_id, provider_id) VALUES (?,?)", o.id, u.id),
      ...(o.customer_id ? notifyStmts(c, [o.customer_id], { title: "جارٍ البحث عن مقدم خدمة آخر", body: `اعتذر مقدم الخدمة عن طلب ${orderLabel(o)}، وطلبك متاح الآن لمقدمي الخدمة الآخرين.`, link: "/orders", icon: "RefreshCw" }) : []),
    ]);
    return json({ ok: true });
  });

  r.post("/api/orders/:id/rate-customer", async (c) => {
    const u = await requireProvider(c);
    const o = await getOrder(c, c.params.id);
    if (o.provider_id !== u.id || o.status !== "completed") fail(409, "cannot_rate", "يمكن تقييم العميل بعد اكتمال الطلب");
    if (o.customer_rating) fail(409, "already_rated", "تم تقييم العميل مسبقاً");
    const rating = num(await readJson(c.req), "rating", { required: true, min: 1, max: 5, int: true, label: "التقييم" })!;
    await c.env.DB.batch([
      stmt(c.env.DB, "UPDATE orders SET customer_rating = ? WHERE id = ? AND customer_rating IS NULL", rating, o.id),
      ...(o.customer_id ? [recomputeCustomerRating(c.env, o.customer_id)] : []),
    ]);
    return json({ ok: true });
  });

  r.get("/api/provider/history", async (c) => {
    const u = await requireProvider(c);
    const rows = await all<OrderRow & { customer_name: string | null }>(c.env.DB,
      `SELECT o.*, cu.full_name AS customer_name FROM orders o LEFT JOIN users cu ON cu.id = o.customer_id
        WHERE o.provider_id = ? AND o.status IN ('completed','cancelled') ORDER BY COALESCE(o.completed_at, o.cancelled_at) DESC LIMIT 100`, u.id);
    return json(rows.map((o) => ({
      id: o.id, order_no: orderNo(o.order_no), service_name: o.service_name, sub_service_name: o.sub_service_name, mode: o.mode, status: o.status,
      description: o.description, region: o.region, address: o.address, rating: o.rating, review: o.review, customer_rating: o.customer_rating,
      charged_coins: o.charged_coins, billing_mode: o.billing_mode, completed_at: o.completed_at, cancelled_at: o.cancelled_at, created_at: o.created_at,
      customer: { name: o.customer_name },
    })));
  });

  r.get("/api/provider/stats", async (c) => {
    const u = await requireProvider(c);
    const DAY = 86400000;
    const since30 = new Date(Date.now() - 30 * DAY).toISOString();
    const since7 = new Date(Date.now() - 7 * DAY).toISOString();
    const [me, counts, breakdown, weekly, demand, recent, hours] = await Promise.all([
      first<{ rating: number; rating_count: number; created_at: string; reviewed_at: string | null; full_name: string | null }>(c.env.DB, "SELECT rating, rating_count, created_at, reviewed_at, full_name FROM users WHERE id = ?", u.id),
      first<{ completed: number; cancelled: number; active: number }>(c.env.DB,
        `SELECT SUM(status = 'completed') AS completed, SUM(status = 'cancelled') AS cancelled, SUM(status IN ('accepted','arrived','in_progress')) AS active FROM orders WHERE provider_id = ?`, u.id),
      all<{ name: string; count: number }>(c.env.DB, "SELECT service_name AS name, COUNT(*) AS count FROM orders WHERE provider_id = ? AND status = 'completed' GROUP BY service_name ORDER BY count DESC", u.id),
      all<{ day: string; count: number }>(c.env.DB, "SELECT substr(datetime(completed_at, '+3 hours'), 1, 10) AS day, COUNT(*) AS count FROM orders WHERE provider_id = ? AND status = 'completed' AND completed_at >= ? GROUP BY day", u.id, since7),
      all<{ hour: number; count: number }>(c.env.DB,
        `SELECT CAST(strftime('%H', datetime(created_at, '+3 hours')) AS INTEGER) AS hour, COUNT(*) AS count FROM orders
          WHERE created_at >= ? AND service_id IN (SELECT service_id FROM provider_services WHERE provider_id = ?) GROUP BY hour`, since30, u.id),
      all<{ id: string; service_name: string; sub_service_name: string | null; status: string; rating: number | null; at: string }>(c.env.DB,
        `SELECT id, service_name, sub_service_name, status, rating, COALESCE(completed_at, cancelled_at, started_at, arrived_at, accepted_at) AS at
           FROM orders WHERE provider_id = ? ORDER BY at DESC LIMIT 8`, u.id),
      first<{ h: number }>(c.env.DB, "SELECT COALESCE(SUM((julianday(completed_at) - julianday(COALESCE(started_at, accepted_at))) * 24), 0) AS h FROM orders WHERE provider_id = ? AND status = 'completed'", u.id),
    ]);
    return json({
      completed: counts?.completed ?? 0, cancelled: counts?.cancelled ?? 0, active: counts?.active ?? 0,
      rating: me?.rating ?? 0, rating_count: me?.rating_count ?? 0, work_hours: Math.round((hours?.h ?? 0) * 10) / 10,
      joined_at: me?.reviewed_at ?? me?.created_at, full_name: me?.full_name,
      services_breakdown: breakdown, weekly, demand_by_hour: demand, recent,
    });
  });

  r.get("/api/provider/services", async (c) => {
    const u = await requireUser(c, { app: "provider" });
    return json((await all<{ service_id: string }>(c.env.DB, "SELECT service_id FROM provider_services WHERE provider_id = ?", u.id)).map((x) => x.service_id));
  });
  r.put("/api/provider/services", async (c) => {
    const u = await requireProvider(c);
    const ids = strArray(await readJson(c.req), "ids", 60);
    const valid = ids.length ? (await all<{ id: string }>(c.env.DB, `SELECT id FROM services WHERE active = 1 AND id IN ${inList(ids.length)}`, ...ids)).map((x) => x.id) : [];
    await c.env.DB.batch([
      stmt(c.env.DB, "DELETE FROM provider_services WHERE provider_id = ?", u.id),
      ...valid.map((id) => stmt(c.env.DB, "INSERT OR IGNORE INTO provider_services (provider_id, service_id) VALUES (?,?)", u.id, id)),
    ]);
    return json(valid);
  });

  /* =================== Provider billing =================== */
  r.get("/api/provider/billing", async (c) => {
    const u = await requireUser(c, { app: "provider" });
    const [s, p, gateways] = await Promise.all([
      getSettings(c.env),
      providerProfile(c, u.id),
      all(c.env.DB, "SELECT id, name, provider_key, fee_percent, test_mode FROM payment_gateways WHERE active = 1 AND (test_mode = 1 OR provider_key IN ('moyasar','tap')) ORDER BY sort_order"),
    ]);
    return json({
      billing_coins_enabled: !!s.billing_coins_enabled, billing_subscription_enabled: !!s.billing_subscription_enabled,
      sub_price_1m: s.sub_price_1m, sub_price_3m: s.sub_price_3m, sub_price_6m: s.sub_price_6m, sub_price_12m: s.sub_price_12m,
      vat_percent: s.vat_percent, test_payments_enabled: !!s.test_payments_enabled, coin_price: s.coin_price ?? 1,
      balance: p.coin_balance, billing_mode: p.billing_mode,
      subscription_end: await activeSubscriptionEnd(c.env, u.id), latest_end: await latestSubscriptionEnd(c.env, u.id), gateways,
    });
  });

  r.post("/api/provider/billing-mode", async (c) => {
    const u = await requireProvider(c);
    const mode = oneOf(await readJson(c.req), "mode", ["coins", "subscription"] as const, { required: true })!;
    const s = await getSettings(c.env);
    if (mode === "coins" && !s.billing_coins_enabled) fail(409, "coins_disabled", "الدفع بالكوينز غير مفعّل");
    if (mode === "subscription" && !s.billing_subscription_enabled) fail(409, "subscription_disabled", "الاشتراك غير مفعّل");
    await run(c.env.DB, "UPDATE users SET billing_mode = ? WHERE id = ?", mode, u.id);
    return json({ ok: true });
  });

  // Top-up and subscription purchases live in routes/payments.ts.

  r.get("/api/provider/transactions", async (c) => {
    const u = await requireUser(c, { app: "provider" });
    return json(await all(c.env.DB, "SELECT id, order_id, amount, tx_type, balance_after, description, method, created_at FROM coin_transactions WHERE provider_id = ? ORDER BY created_at DESC LIMIT 100", u.id));
  });

  r.get("/api/provider/ratings", async (c) => {
    const u = await requireProvider(c);
    return json(await all(c.env.DB, "SELECT id, rating, review, COALESCE(completed_at, created_at) AS created_at FROM orders WHERE provider_id = ? AND rating IS NOT NULL ORDER BY completed_at DESC LIMIT 200", u.id));
  });
}
