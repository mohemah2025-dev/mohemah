/**
 * Occasion discounts set by the administration (e.g. Eid, National Day) for providers' costs:
 * percent off, free (100%) or a fixed amount off; for everything or one service; for order acceptance (coins),
 * subscriptions and/or coin top-ups. The best active discount applies; prices are always computed here.
 */
import { all, now, type Env } from "./core";

export type PromoTarget = "orders" | "subscriptions" | "topups";
export type Promotion = {
  id: string; title: string; kind: "percent" | "free" | "amount"; value: number; scope: "all" | "service";
  service_id: string | null; applies_to: PromoTarget | "all"; starts_at: string; ends_at: string;
};

export async function activePromotions(env: Env): Promise<Promotion[]> {
  const t = now();
  return all<Promotion>(env.DB, "SELECT id, title, kind, value, scope, service_id, applies_to, starts_at, ends_at FROM promotions WHERE active = 1 AND starts_at <= ? AND ends_at > ? ORDER BY created_at DESC", t, t);
}

function discountOf(p: Promotion, base: number) {
  if (p.kind === "free") return base;
  if (p.kind === "percent") return (base * Math.min(100, Math.max(0, p.value))) / 100;
  return Math.min(base, Math.max(0, p.value));
}

/** Price after the best matching active promotion. `whole` rounds to whole units (coins). */
export function applyBest(list: Promotion[], target: PromoTarget, base: number, serviceId: string | null = null, whole = false) {
  let best: Promotion | null = null;
  let off = 0;
  for (const p of list) {
    if (p.applies_to !== "all" && p.applies_to !== target) continue;
    if (p.scope === "service" && (!serviceId || p.service_id !== serviceId)) continue;
    const d = discountOf(p, base);
    if (d > off) { off = d; best = p; }
  }
  let price = Math.max(0, base - off);
  price = whole ? Math.round(price) : Math.round(price * 100) / 100;
  return { price, original: base, promo: best };
}

export async function priceFor(env: Env, target: PromoTarget, base: number, serviceId: string | null = null, whole = false) {
  return applyBest(await activePromotions(env), target, base, serviceId, whole);
}

/** Short Arabic description, e.g. "خصم 50% على قبول طلبات السباكة". */
export function describePromo(p: Promotion, serviceName?: string | null) {
  const what = p.kind === "free" ? "مجاناً" : p.kind === "percent" ? `خصم ${p.value}%` : `خصم ${p.value}`;
  const on = p.applies_to === "orders" ? "على قبول الطلبات" : p.applies_to === "subscriptions" ? "على الاشتراكات" : p.applies_to === "topups" ? "على شحن الكوينز" : "على قبول الطلبات والاشتراكات والشحن";
  return p.kind === "free" ? `${on.replace("على ", "")} ${what}${serviceName ? ` في ${serviceName}` : ""}` : `${what} ${on}${serviceName ? ` في ${serviceName}` : ""}`;
}
