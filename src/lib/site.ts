/** Public website (/site): data loading and privacy-friendly tracking (counters only). */
import { useEffect, useState } from "react";

export interface SiteStep { title: string; text: string }
export interface SiteBanner { id?: string; title: string; subtitle: string; image_url: string; link: string; cta: string; active: boolean }
export interface SiteStat { label: string; source: "manual" | "providers" | "customers" | "orders" | "services" | "cities" | "rating"; value: string }
export interface SiteContent {
  domain: string;
  seo: { title: string; description: string; keywords: string };
  announcement: { active: boolean; text: string; link: string };
  hero: { badge: string; title: string; subtitle: string; image_url: string };
  banners: SiteBanner[];
  stats: SiteStat[];
  about: { title: string; body: string; image_url: string; points: string[] };
  services: { title: string; subtitle: string; limit: number };
  how_customer: { title: string; steps: SiteStep[] };
  how_provider: { title: string; steps: SiteStep[] };
  features: SiteStep[];
  subscription: { show: boolean; title: string; subtitle: string; note: string };
  testimonials: { name: string; role: string; text: string; rating: number }[];
  faqs: { q: string; a: string }[];
  contact: { phone: string; whatsapp: string; email: string; address: string; hours: string; show_form: boolean };
  social: Record<"x" | "instagram" | "snapchat" | "tiktok" | "youtube" | "linkedin", string>;
  footer: { text: string };
  sections: { key: string; visible: boolean }[];
}
export interface StoreLinks { ios: string | null; android: string | null; other: string | null }
export interface SiteData {
  content: SiteContent;
  numbers: Record<"providers" | "customers" | "orders" | "services" | "cities" | "rating", number>;
  services: { id: string; name: string; description: string | null; icon: string | null; color: string | null; tasks: number }[];
  pages: { slug: string; title: string; show_in_nav: number; show_in_footer: number }[];
  policies: { id: string; title: string }[];
  app: {
    name: string; logo_url: string | null; primary_color: string | null; currency_label: string; support_phone: string | null; support_email: string | null;
    customer: StoreLinks; provider: StoreLinks;
    billing: { coins: boolean; subscription: boolean; coin_price: number; vat_percent: number; plans: { months: number; price: number }[] };
  };
}

let cache: SiteData | null = null;
let pending: Promise<SiteData> | null = null;

export function loadSite(): Promise<SiteData> {
  if (cache) return Promise.resolve(cache);
  pending ??= fetch("/api/site").then((r) => { if (!r.ok) throw new Error("load"); return r.json() as Promise<SiteData>; }).then((d) => (cache = d)).finally(() => { pending = null; });
  return pending;
}

export function useSite() {
  const [data, setData] = useState<SiteData | null>(cache);
  const [error, setError] = useState(false);
  useEffect(() => { loadSite().then(setData).catch(() => setError(true)); }, []);
  return { data, error };
}

const post = (body: Record<string, unknown>) => {
  try { void fetch("/api/site/track", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), keepalive: true }).catch(() => {}); } catch { /* ignore */ }
};
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };

/** Counts a page view; the first view of the day also counts the visitor, source and device. */
export function trackView(path: string) {
  const today = new Date().toISOString().slice(0, 10);
  const last = store.get("mohemah.site.day");
  const first = last !== today;
  const body: Record<string, unknown> = { path };
  if (first) {
    const q = new URLSearchParams(window.location.search);
    Object.assign(body, { first_today: true, returning: !!last, ref: document.referrer, utm: q.get("utm_source") ?? "", mobile: window.matchMedia("(max-width: 767px)").matches });
    store.set("mohemah.site.day", today);
  }
  post(body);
}

/** Counts a button click (download_customer_android, whatsapp, call…). */
export const trackEvent = (event: string) => post({ event });
