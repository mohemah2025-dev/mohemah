import { all, first, now, stmt, uid, type Ctx, type Env } from "./core";

export type Settings = {
  app_name: string; logo_url: string | null; app_logo_url: string | null; currency_label: string; primary_color: string | null;
  support_email: string | null; support_phone: string | null; welcome_customer: string | null; welcome_provider: string | null;
  billing_coins_enabled: number; billing_subscription_enabled: number;
  sub_price_1m: number; sub_price_3m: number; sub_price_6m: number; sub_price_12m: number;
  vat_percent: number; test_payments_enabled: number; coin_price: number;
  sms_enabled: number; sms_provider: string | null; sms_sender: string | null; sms_username: string | null;
  email_enabled: number; email_provider: string | null; email_from: string | null; email_from_name: string | null;
  whatsapp_enabled: number; whatsapp_phone_id: string | null; whatsapp_template: string | null; whatsapp_lang: string | null;
  customer_ios_url: string | null; customer_android_url: string | null; customer_other_url: string | null;
  provider_ios_url: string | null; provider_android_url: string | null; provider_other_url: string | null;
};

export async function getSettings(env: Env) {
  return (await first<Settings>(env.DB, "SELECT * FROM app_settings WHERE id = 1"))!;
}

export function publicSettings(s: Settings) {
  return {
    app_name: s.app_name, logo_url: s.logo_url, app_logo_url: s.app_logo_url, currency_label: s.currency_label, primary_color: s.primary_color,
    support_email: s.support_email, support_phone: s.support_phone,
    welcome_customer: s.welcome_customer, welcome_provider: s.welcome_provider,
    billing_coins_enabled: !!s.billing_coins_enabled, billing_subscription_enabled: !!s.billing_subscription_enabled,
    sub_price_1m: s.sub_price_1m, sub_price_3m: s.sub_price_3m, sub_price_6m: s.sub_price_6m, sub_price_12m: s.sub_price_12m,
    vat_percent: s.vat_percent, test_payments_enabled: !!s.test_payments_enabled, coin_price: s.coin_price ?? 1,
    customer_ios_url: s.customer_ios_url, customer_android_url: s.customer_android_url, customer_other_url: s.customer_other_url,
    provider_ios_url: s.provider_ios_url, provider_android_url: s.provider_android_url, provider_other_url: s.provider_other_url,
  };
}

/** End of the provider's currently active subscription (start <= now < end), or null. */
export async function activeSubscriptionEnd(env: Env, providerId: string) {
  const t = now();
  const r = await first<{ ends_at: string | null }>(env.DB, "SELECT MAX(ends_at) AS ends_at FROM provider_subscriptions WHERE provider_id = ? AND starts_at <= ? AND ends_at > ?", providerId, t, t);
  return r?.ends_at ?? null;
}

/** Latest end date of any subscription (used to chain renewals). */
export async function latestSubscriptionEnd(env: Env, providerId: string) {
  const r = await first<{ ends_at: string | null }>(env.DB, "SELECT MAX(ends_at) AS ends_at FROM provider_subscriptions WHERE provider_id = ? AND ends_at > ?", providerId, now());
  return r?.ends_at ?? null;
}

/**
 * Statements that create a personal notification for one or more users.
 * Also queues a push to their phones (sent after the response, unless scheduled for later).
 */
export function notifyStmts(c: Ctx, userIds: string[], n: { title: string; body: string; link?: string | null; icon?: string | null; category?: string; created_by?: string | null; scheduled_at?: string | null }) {
  const id = uid();
  const sent = n.scheduled_at ?? now();
  if (!n.scheduled_at || n.scheduled_at <= now()) {
    const link = n.link ?? "";
    const app = link.startsWith("/provider") ? "provider" : link.startsWith("/orders") ? "customer" : undefined;
    c.push.push({ userIds, app, message: { title: n.title, body: n.body, data: { link, notification_id: id } } });
  }
  return [
    stmt(c.env.DB, "INSERT INTO notifications (id, title, body, audience, category, icon, link, scheduled_at, sent_at, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)",
      id, n.title.slice(0, 200), n.body.slice(0, 1000), "specific", n.category ?? "order", n.icon ?? null, n.link ?? null, n.scheduled_at ?? null, sent, n.created_by ?? null),
    ...userIds.map((u) => stmt(c.env.DB, "INSERT OR IGNORE INTO notification_targets (notification_id, user_id) VALUES (?,?)", id, u)),
  ];
}

export function recomputeProviderRating(env: Env, providerId: string) {
  return stmt(env.DB,
    `UPDATE users SET rating = COALESCE((SELECT ROUND(AVG(rating), 2) FROM orders WHERE provider_id = ?1 AND rating IS NOT NULL), 0),
       rating_count = (SELECT COUNT(*) FROM orders WHERE provider_id = ?1 AND rating IS NOT NULL) WHERE id = ?1`, providerId);
}
export function recomputeCustomerRating(env: Env, customerId: string) {
  return stmt(env.DB,
    `UPDATE users SET customer_rating = COALESCE((SELECT ROUND(AVG(customer_rating), 2) FROM orders WHERE customer_id = ?1 AND customer_rating IS NOT NULL), 0),
       customer_rating_count = (SELECT COUNT(*) FROM orders WHERE customer_id = ?1 AND customer_rating IS NOT NULL) WHERE id = ?1`, customerId);
}

export const orderNo = (n: number) => 100000 + n;

export type UserRow = {
  id: string; email: string | null; username: string | null; phone: string | null; full_name: string | null; region: string | null;
  gender: string | null; avatar_url: string | null; bio: string | null; coin_balance: number; rating: number; rating_count: number;
  customer_rating: number; is_active: number; is_online: number; billing_mode: string; national_id: string | null; nationality: string | null;
  verification_status: string; review_note: string | null; requested_services: string; referral_code: string | null; created_at: string; member_no?: number | null;
};

export function serializeProfile(u: UserRow) {
  return {
    id: u.id, email: u.email, username: u.username, phone: u.phone, full_name: u.full_name, region: u.region, gender: u.gender,
    avatar_url: u.avatar_url, bio: u.bio, coin_balance: u.coin_balance, rating: u.rating, rating_count: u.rating_count,
    customer_rating: u.customer_rating, is_active: !!u.is_active, is_online: !!u.is_online, billing_mode: u.billing_mode,
    national_id: u.national_id, nationality: u.nationality, verification_status: u.verification_status, review_note: u.review_note,
    requested_services: safeJson<string[]>(u.requested_services, []), referral_code: u.referral_code, created_at: u.created_at, member_no: u.member_no ?? null,
  };
}

export function safeJson<T>(s: string | null | undefined, fallback: T): T {
  try { return s ? (JSON.parse(s) as T) : fallback; } catch { return fallback; }
}

export async function serviceNames(env: Env) {
  const rows = await all<{ id: string; name: string }>(env.DB, "SELECT id, name FROM services");
  return Object.fromEntries(rows.map((r) => [r.id, r.name]));
}

export function referralCodeFor(name: string | null) {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rnd = crypto.getRandomValues(new Uint8Array(6));
  return "MH" + Array.from(rnd, (b) => letters[b % letters.length]).join("");
}
