/**
 * Coin top-ups and subscriptions.
 *
 * Real gateways (provider_key "moyasar" or "tap"): the Worker creates a hosted checkout with the secret key
 * (MOYASAR_SECRET_KEY / TAP_SECRET_KEY Worker secrets), the provider pays on the gateway page, and the purchase
 * is applied only after the Worker re-reads the payment from the gateway API (return page or webhook) and the
 * paid amount matches. Applying is idempotent (status initiated → processing → paid).
 *
 * Other gateways are simulated and work only while "test payments" is on in the admin settings.
 */
import { addMonths, all, fail, first, json, now, num, readJson, run, stmt, str, uid, type Ctx, type Router } from "../lib/core";
import { requirePerm, requireProvider, requireUser } from "../lib/auth";
import { getSettings, latestSubscriptionEnd, notifyStmts, type Settings } from "../lib/domain";
import { notifyExternal } from "../lib/messaging";
import { priceFor } from "../lib/promotions";

export const LIVE_GATEWAYS = ["moyasar", "tap"] as const;
type LiveKey = (typeof LIVE_GATEWAYS)[number];
type Gateway = { id: string; name: string; provider_key: string; test_mode: number; fee_percent: number };
type PaymentRow = {
  id: string; user_id: string; gateway_id: string | null; provider_key: string; purpose: "topup" | "subscription";
  coins: number | null; months: number | null; amount: number; currency: string; status: string; external_id: string | null;
};

const isLive = (k: string): k is LiveKey => (LIVE_GATEWAYS as readonly string[]).includes(k);
const halalas = (sar: number) => Math.round(sar * 100);
const withVat = (price: number, s: Settings) => Math.round(price * (1 + (s.vat_percent || 0) / 100) * 100) / 100;

function secretKey(c: Ctx, key: LiveKey) {
  const k = key === "moyasar" ? c.env.MOYASAR_SECRET_KEY : c.env.TAP_SECRET_KEY;
  if (!k) fail(503, "gateway_not_configured", "بوابة الدفع غير مربوطة بعد (المفتاح السري غير مضاف)");
  return k!;
}

/* ---------------- Gateway API calls ---------------- */

async function createCheckout(c: Ctx, key: LiveKey, p: { id: string; amount: number; description: string; name: string; email: string | null; phone: string | null }) {
  const returnUrl = `${c.url.origin}/api/payments/return/${p.id}`;
  const webhookUrl = `${c.url.origin}/api/payments/webhook/${key}`;
  if (key === "moyasar") {
    // Hosted invoice page: mada, Visa/Mastercard, Apple Pay and STC Pay as enabled on the Moyasar account.
    const res = await fetch("https://api.moyasar.com/v1/invoices", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Basic ${btoa(`${secretKey(c, key)}:`)}` },
      body: JSON.stringify({
        amount: halalas(p.amount), currency: "SAR", description: p.description,
        callback_url: webhookUrl, success_url: returnUrl, back_url: returnUrl,
        metadata: { payment_id: p.id },
      }),
    });
    const j = await res.json<{ id?: string; url?: string; message?: string }>().catch(() => ({}) as { id?: string; url?: string; message?: string });
    if (!res.ok || !j.id || !j.url) fail(502, "gateway_error", `تعذّر إنشاء عملية الدفع: ${j.message ?? res.status}`);
    return { externalId: j.id!, url: j.url! };
  }
  const phone = (p.phone ?? "").replace(/\D/g, "").replace(/^966/, "").replace(/^0/, "");
  const res = await fetch("https://api.tap.company/v2/charges", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${secretKey(c, key)}` },
    body: JSON.stringify({
      amount: p.amount, currency: "SAR", description: p.description, customer_initiated: true, threeDSecure: true,
      customer: { first_name: p.name || "مقدم خدمة", ...(p.email ? { email: p.email } : {}), ...(phone ? { phone: { country_code: "966", number: phone } } : {}) },
      source: { id: "src_all" }, redirect: { url: returnUrl }, post: { url: webhookUrl },
      reference: { transaction: p.id, order: p.id }, metadata: { payment_id: p.id },
    }),
  });
  const j = await res.json<{ id?: string; transaction?: { url?: string }; errors?: { description?: string }[] }>().catch(() => ({}) as { id?: string; transaction?: { url?: string }; errors?: { description?: string }[] });
  if (!res.ok || !j.id || !j.transaction?.url) fail(502, "gateway_error", `تعذّر إنشاء عملية الدفع: ${j.errors?.[0]?.description ?? res.status}`);
  return { externalId: j.id!, url: j.transaction!.url! };
}

/** Reads the payment back from the gateway (never trusts the browser or the webhook body). */
async function gatewayStatus(c: Ctx, key: LiveKey, externalId: string): Promise<{ paid: boolean; failed: boolean; amountHalalas: number }> {
  if (key === "moyasar") {
    const res = await fetch(`https://api.moyasar.com/v1/invoices/${encodeURIComponent(externalId)}`, { headers: { authorization: `Basic ${btoa(`${secretKey(c, key)}:`)}` } });
    if (!res.ok) return { paid: false, failed: false, amountHalalas: 0 };
    const j = await res.json<{ status?: string; amount?: number; amount_due?: number }>();
    return { paid: j.status === "paid", failed: j.status === "failed" || j.status === "canceled" || j.status === "expired", amountHalalas: Number(j.amount ?? 0) };
  }
  const res = await fetch(`https://api.tap.company/v2/charges/${encodeURIComponent(externalId)}`, { headers: { authorization: `Bearer ${secretKey(c, key)}` } });
  if (!res.ok) return { paid: false, failed: false, amountHalalas: 0 };
  const j = await res.json<{ status?: string; amount?: number }>();
  const st = j.status ?? "";
  return { paid: st === "CAPTURED", failed: ["FAILED", "DECLINED", "CANCELLED", "ABANDONED", "RESTRICTED", "VOID", "TIMEDOUT"].includes(st), amountHalalas: halalas(Number(j.amount ?? 0)) };
}

/* ---------------- Applying a purchase ---------------- */

async function purchaseStmts(c: Ctx, userId: string, purpose: "topup" | "subscription", qty: number, amount: number, method: string, label: string) {
  if (purpose === "topup") {
    return [
      stmt(c.env.DB, "UPDATE users SET coin_balance = coin_balance + ? WHERE id = ?", qty, userId),
      stmt(c.env.DB, `INSERT INTO coin_transactions (id, provider_id, amount, tx_type, balance_after, description, method)
                      SELECT ?, ?, ?, 'topup', coin_balance, ?, ? FROM users WHERE id = ?`, uid(), userId, qty, label, method, userId),
    ];
  }
  const start = (await latestSubscriptionEnd(c.env, userId)) ?? now();
  const end = addMonths(start, qty);
  return [
    stmt(c.env.DB, "INSERT INTO provider_subscriptions (id, provider_id, months, amount, method, starts_at, ends_at) VALUES (?,?,?,?,?,?,?)", uid(), userId, qty, amount, method, start, end),
    stmt(c.env.DB, "UPDATE users SET billing_mode = 'subscription' WHERE id = ?", userId),
    ...notifyStmts(c, [userId], { title: "تم تفعيل اشتراكك", body: `اشتراكك فعّال حتى ${end.slice(0, 10)}`, category: "general", link: "/provider/billing" }),
  ];
}

/** Verifies a real payment with its gateway and applies it once. Returns the final status. */
export async function settlePayment(c: Ctx, paymentId: string): Promise<string> {
  const p = await first<PaymentRow>(c.env.DB, "SELECT * FROM payments WHERE id = ?", paymentId);
  if (!p) return "not_found";
  if (p.status === "paid" || p.status === "failed" || !p.external_id || !isLive(p.provider_key)) return p.status;
  const g = await gatewayStatus(c, p.provider_key, p.external_id);
  if (g.failed) {
    await run(c.env.DB, "UPDATE payments SET status = 'failed', error = 'رفضت البوابة الدفع' WHERE id = ? AND status = 'initiated'", p.id);
    return "failed";
  }
  if (!g.paid) return p.status;
  if (g.amountHalalas !== halalas(p.amount)) {
    await run(c.env.DB, "UPDATE payments SET status = 'failed', error = ? WHERE id = ? AND status = 'initiated'", `المبلغ المدفوع ${g.amountHalalas / 100} لا يطابق ${p.amount}`, p.id);
    return "failed";
  }
  // Claim the payment so a webhook and the return page never apply it twice.
  const claim = await run(c.env.DB, "UPDATE payments SET status = 'processing' WHERE id = ? AND status = 'initiated'", p.id);
  if (!claim.meta.changes) return (await first<{ status: string }>(c.env.DB, "SELECT status FROM payments WHERE id = ?", p.id))?.status ?? "processing";
  try {
    const gw = p.gateway_id ? await first<{ name: string }>(c.env.DB, "SELECT name FROM payment_gateways WHERE id = ?", p.gateway_id) : null;
    const method = gw?.name ?? p.provider_key;
    const qty = p.purpose === "topup" ? p.coins! : p.months!;
    await c.env.DB.batch([
      ...(await purchaseStmts(c, p.user_id, p.purpose, qty, p.amount, method, "شحن رصيد")),
      stmt(c.env.DB, "UPDATE payments SET status = 'paid', paid_at = ? WHERE id = ?", now(), p.id),
    ]);
  } catch (e) {
    await run(c.env.DB, "UPDATE payments SET status = 'initiated' WHERE id = ? AND status = 'processing'", p.id);
    throw e;
  }
  const title = p.purpose === "topup" ? "تم شحن رصيدك" : "تم الدفع وتفعيل اشتراكك";
  notifyExternal(c, [p.user_id], {
    title,
    body: p.purpose === "topup" ? `تمت إضافة ${p.coins} كوين لرصيدك. المبلغ المدفوع ${p.amount} ريال.` : `تم تفعيل اشتراك ${p.months} شهر. المبلغ المدفوع ${p.amount} ريال.`,
    sms: false,
  });
  return "paid";
}

function resultPage(ok: boolean, pending: boolean) {
  const title = ok ? "تم الدفع بنجاح" : pending ? "جارٍ تأكيد الدفع" : "لم يكتمل الدفع";
  const text = ok ? "تمت إضافة العملية لحسابك. ارجع إلى تطبيق «مهمة شريك» واضغط «تحقق من الدفع»."
    : pending ? "لم يصل تأكيد البوابة بعد، ارجع للتطبيق وتحقق بعد لحظات." : "لم تتم عملية الدفع، يمكنك المحاولة مرة أخرى من التطبيق.";
  const color = ok ? "#16a34a" : pending ? "#d97706" : "#dc2626";
  return new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f6fa;font-family:Tahoma,Arial,sans-serif">
<div style="background:#fff;border:1px solid #e3e8f0;border-radius:20px;padding:32px 24px;max-width:380px;margin:16px;text-align:center">
<div style="width:72px;height:72px;border-radius:50%;background:${color};color:#fff;font-size:40px;line-height:72px;margin:0 auto 16px">${ok ? "✓" : pending ? "…" : "✕"}</div>
<h1 style="font-size:20px;margin:0 0 8px">${title}</h1><p style="color:#5b6573;line-height:1.8;margin:0">${text}</p></div></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

export function registerPaymentRoutes(r: Router) {
  /** Starts a coin top-up: real gateway → { payment_url, payment_id }; simulated gateway → applied at once. */
  r.post("/api/provider/topup", async (c) => {
    const u = await requireProvider(c);
    const b = await readJson(c.req);
    const coins = num(b, "coins", { required: true, min: 1, max: 10000, int: true, label: "عدد الكوينز" })!;
    const s = await getSettings(c.env);
    if (!s.billing_coins_enabled) fail(409, "coins_disabled", "الدفع بالكوينز غير مفعّل");
    const gw = await gatewayFor(c, str(b, "gateway_id", { required: true, max: 64 }), s);
    const amount = withVat((await priceFor(c.env, "topups", coins * (s.coin_price ?? 1))).price, s);
    return startPurchase(c, u.id, gw, s, { purpose: "topup", coins, months: null, amount, description: `شحن ${coins} كوين` });
  });

  r.post("/api/provider/subscribe", async (c) => {
    const u = await requireProvider(c);
    const b = await readJson(c.req);
    const months = num(b, "months", { required: true, int: true, label: "الباقة" })!;
    const s = await getSettings(c.env);
    if (!s.billing_subscription_enabled) fail(409, "subscription_disabled", "الاشتراك غير مفعّل");
    const price = ({ 1: s.sub_price_1m, 3: s.sub_price_3m, 6: s.sub_price_6m, 12: s.sub_price_12m } as Record<number, number>)[months];
    if (price === undefined || price <= 0) fail(400, "invalid_plan", "باقة غير صحيحة");
    const gw = await gatewayFor(c, str(b, "gateway_id", { required: true, max: 64 }), s);
    const discounted = (await priceFor(c.env, "subscriptions", price!)).price;
    return startPurchase(c, u.id, gw, s, { purpose: "subscription", coins: null, months, amount: withVat(discounted, s), description: `اشتراك ${months} شهر` });
  });

  /** The app checks the result after returning from the gateway page. */
  r.get("/api/provider/payments/:id", async (c) => {
    const u = await requireUser(c, { app: "provider" });
    const p = await first<PaymentRow>(c.env.DB, "SELECT * FROM payments WHERE id = ? AND user_id = ?", c.params.id, u.id);
    if (!p) fail(404, "not_found", "العملية غير موجودة");
    const status = p!.status === "initiated" ? await settlePayment(c, p!.id) : p!.status;
    return json({ id: p!.id, status, purpose: p!.purpose, coins: p!.coins, months: p!.months, amount: p!.amount });
  });

  /** Gateway redirects the browser here after payment. */
  r.get("/api/payments/return/:id", async (c) => {
    let status = "initiated";
    try { status = await settlePayment(c, c.params.id); } catch (e) { console.error("payment return", e); }
    return resultPage(status === "paid", status === "initiated" || status === "processing");
  });

  /** Server-to-server notification from the gateway; the payment is re-read from the gateway API before applying. */
  r.post("/api/payments/webhook/:provider", async (c) => {
    const provider = c.params.provider;
    if (!isLive(provider)) fail(404, "not_found", "غير موجود");
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    if (provider === "moyasar" && c.env.MOYASAR_WEBHOOK_SECRET && body.secret_token !== c.env.MOYASAR_WEBHOOK_SECRET) fail(401, "bad_token", "رمز غير صحيح");
    const data = (body.data && typeof body.data === "object" ? body.data : body) as Record<string, unknown>;
    const meta = (data.metadata && typeof data.metadata === "object" ? data.metadata : {}) as Record<string, unknown>;
    const ids = [meta.payment_id, (data.reference as Record<string, unknown> | undefined)?.transaction].filter((x): x is string => typeof x === "string");
    const ext = [data.invoice_id, data.id].filter((x): x is string => typeof x === "string");
    const p = ids.length
      ? await first<{ id: string }>(c.env.DB, "SELECT id FROM payments WHERE id = ?", ids[0])
      : ext.length ? await first<{ id: string }>(c.env.DB, `SELECT id FROM payments WHERE external_id IN (${ext.map(() => "?").join(",")})`, ...ext) : null;
    if (p) await settlePayment(c, p.id);
    return json({ received: true });
  });

  /** Admin: online payments list. */
  r.get("/api/admin/payments", async (c) => {
    await requirePerm(c, ["finance", "gateways", "billing"], "view");
    return json(await all(c.env.DB,
      `SELECT p.id, p.purpose, p.coins, p.months, p.amount, p.status, p.provider_key, p.external_id, p.error, p.created_at, p.paid_at, u.full_name AS user_name
         FROM payments p LEFT JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC LIMIT 300`));
  });

  /** Admin: which keys exist as secrets (values are never returned) and the callback URLs to paste in the gateway dashboards. */
  r.get("/api/admin/integrations/status", async (c) => {
    await requirePerm(c, ["gateways", "integrations"], "view");
    const o = c.url.origin;
    return json({
      moyasar: { secret: !!c.env.MOYASAR_SECRET_KEY, webhook_secret: !!c.env.MOYASAR_WEBHOOK_SECRET, mode: keyMode(c.env.MOYASAR_SECRET_KEY), webhook_url: `${o}/api/payments/webhook/moyasar` },
      tap: { secret: !!c.env.TAP_SECRET_KEY, mode: keyMode(c.env.TAP_SECRET_KEY), webhook_url: `${o}/api/payments/webhook/tap` },
      sms: { secret: !!c.env.SMS_API_KEY },
      email: { secret: !!c.env.EMAIL_API_KEY },
      whatsapp: { secret: !!c.env.WHATSAPP_TOKEN },
    });
  });
}

const keyMode = (k?: string) => (!k ? null : k.includes("_live_") ? "live" : "test");

async function gatewayFor(c: Ctx, gatewayId: string | null, s: Settings) {
  const gw = await first<Gateway>(c.env.DB, "SELECT id, name, provider_key, test_mode, fee_percent FROM payment_gateways WHERE id = ? AND active = 1", gatewayId);
  if (!gw) fail(400, "gateway_unavailable", "وسيلة الدفع غير متاحة");
  if (!isLive(gw!.provider_key) && (!gw!.test_mode || !s.test_payments_enabled)) fail(402, "live_gateway_not_connected", "بوابة الدفع غير مربوطة بعد");
  return gw!;
}

async function startPurchase(c: Ctx, userId: string, gw: Gateway, s: Settings,
  x: { purpose: "topup" | "subscription"; coins: number | null; months: number | null; amount: number; description: string }) {
  const qty = x.purpose === "topup" ? x.coins! : x.months!;
  if (!isLive(gw.provider_key) || x.amount === 0) {
    // Simulated payment (test mode only), or fully discounted by an occasion offer.
    await c.env.DB.batch(await purchaseStmts(c, userId, x.purpose, qty, x.amount, gw.name, "شحن رصيد (تجريبي)"));
    const p = await first<{ coin_balance: number }>(c.env.DB, "SELECT coin_balance FROM users WHERE id = ?", userId);
    return json({ success: true, balance: p?.coin_balance ?? 0 });
  }
  if (x.amount < 1) fail(400, "amount_too_small", "المبلغ أقل من الحد الأدنى للدفع");
  const user = await first<{ full_name: string | null; email: string | null; phone: string | null }>(c.env.DB, "SELECT full_name, email, phone FROM users WHERE id = ?", userId);
  const id = uid();
  await run(c.env.DB, "INSERT INTO payments (id, user_id, gateway_id, provider_key, purpose, coins, months, amount) VALUES (?,?,?,?,?,?,?,?)",
    id, userId, gw.id, gw.provider_key, x.purpose, x.coins, x.months, x.amount);
  try {
    const co = await createCheckout(c, gw.provider_key, { id, amount: x.amount, description: `${s.app_name} — ${x.description}`, name: user?.full_name ?? "", email: user?.email ?? null, phone: user?.phone ?? null });
    await run(c.env.DB, "UPDATE payments SET external_id = ? WHERE id = ?", co.externalId, id);
    return json({ payment_id: id, payment_url: co.url, amount: x.amount });
  } catch (e) {
    await run(c.env.DB, "UPDATE payments SET status = 'failed', error = ? WHERE id = ?", String((e as Error)?.message ?? e).slice(0, 300), id);
    throw e;
  }
}

