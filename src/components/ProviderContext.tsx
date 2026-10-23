import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { api, ApiError, errMsg } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { inBackground, showSystemNotification } from "@/components/OrderAlerts";

export type ServiceMode = "in_person" | "remote";
export const INCOMING_TTL_MS = 60_000;

export interface AvailableOrder {
  id: string; order_no: number; service_name: string; sub_service_name: string | null; mode: ServiceMode; description: string | null;
  region: string | null; scheduled_at: string | null; coin_cost: number; created_at: string;
  customer: { name: string; rating: number; rating_count: number };
}
export interface ActiveJob {
  id: string; order_no: number; service_name: string; sub_service_name: string | null; mode: ServiceMode; description: string | null;
  region: string | null; address: string | null; lat: number | null; lng: number | null; scheduled_at: string | null;
  status: "accepted" | "arrived" | "in_progress"; coin_cost: number; charged_coins: number; billing_mode: string | null;
  created_at: string; accepted_at: string | null; arrived_at: string | null; started_at: string | null; unread: number;
  customer: { id: string | null; name: string | null; phone: string | null; rating: number };
}
export interface ProviderFeed {
  online: boolean; region: string | null; services_count: number; balance: number; billing_mode: string; subscription_end: string | null;
  available: AvailableOrder[]; active: ActiveJob[];
}
export type IncomingRequest = AvailableOrder & { expiresAt: number };
export type AcceptResult = { ok: boolean; reason?: string; error?: string };

interface ProviderState {
  feed: ProviderFeed | null;
  online: boolean;
  setOnline: (v: boolean) => Promise<void>;
  reload: () => Promise<void>;
  pendingIncoming: IncomingRequest | null;
  incomingMinimized: boolean;
  setIncomingMinimized: (v: boolean) => void;
  acceptOrder: (id: string) => Promise<AcceptResult>;
  rejectOrder: (id: string) => Promise<void>;
  dismissIncoming: () => void;
}

const ProviderCtx = createContext<ProviderState | null>(null);

export const orderTitle = (o: { service_name: string; sub_service_name: string | null }) => (o.sub_service_name ? `${o.service_name} - ${o.sub_service_name}` : o.service_name);

export function ProviderProvider({ children }: { children: ReactNode }) {
  const { user, isProvider, refreshProfile } = useAuth();
  const [feed, setFeed] = useState<ProviderFeed | null>(null);
  const [incomingMinimized, setIncomingMinimized] = useState(false);
  const [pendingIncoming, setPendingIncoming] = useState<IncomingRequest | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const dismissed = useRef<Set<string>>(new Set());

  const reload = useCallback(async () => {
    if (!user || !isProvider) { setFeed(null); return; }
    try { setFeed(await api<ProviderFeed>("/api/provider/feed")); } catch { /* offline */ }
  }, [user?.id, isProvider]);

  useEffect(() => {
    reload();
    const t = setInterval(reload, feed?.online ? 6000 : 15000);
    return () => clearInterval(t);
  }, [reload, feed?.online]);

  // New orders while online pop up as an incoming request for one minute.
  useEffect(() => {
    if (!feed) return;
    const ids = feed.available.map((o) => o.id);
    if (!seen.current) { seen.current = new Set(ids); return; }
    const fresh = feed.available.filter((o) => !seen.current!.has(o.id));
    fresh.forEach((o) => seen.current!.add(o.id));
    if (!feed.online || !fresh.length) return;
    const next = fresh[0];
    if (!pendingIncoming) {
      setPendingIncoming({ ...next, expiresAt: Date.now() + INCOMING_TTL_MS });
      setIncomingMinimized(false);
    }
    if (inBackground()) void showSystemNotification("طلب جديد في مهمة", `${orderTitle(next)}${next.region ? ` · ${next.region}` : ""}`);
  }, [feed]);

  // Expire the pop-up and drop it once the order is no longer available.
  useEffect(() => {
    if (!pendingIncoming) return;
    if (feed && !feed.available.some((o) => o.id === pendingIncoming.id)) { setPendingIncoming(null); return; }
    const t = setTimeout(() => { dismissed.current.add(pendingIncoming.id); setPendingIncoming(null); }, Math.max(0, pendingIncoming.expiresAt - Date.now()));
    return () => clearTimeout(t);
  }, [pendingIncoming, feed]);

  const setOnline = useCallback(async (v: boolean) => {
    try {
      await api("/api/provider/online", { body: { online: v } });
      setFeed((f) => (f ? { ...f, online: v } : f));
      if (v) seen.current = new Set(feed?.available.map((o) => o.id) ?? []);
      toast.success(v ? "أنت متصل الآن وستصلك الطلبات الجديدة" : "تم إيقاف استقبال الطلبات");
      reload();
    } catch (e) { toast.error(errMsg(e)); }
  }, [reload, feed]);

  const acceptOrder = useCallback(async (id: string): Promise<AcceptResult> => {
    try {
      const r = await api<{ success: boolean; mode: string; balance: number }>(`/api/orders/${id}/accept`, { method: "POST" });
      if (pendingIncoming?.id === id) setPendingIncoming(null);
      await Promise.all([reload(), refreshProfile()]);
      return { ok: true, reason: r.mode === "subscription" ? "تم قبول الطلب ضمن اشتراكك" : "تم قبول الطلب وخصم الكوينز" };
    } catch (e) {
      const code = e instanceof ApiError ? ((e.data as { error?: string })?.error ?? e.code) : "";
      const reason = code === "insufficient_balance" ? "رصيدك غير كافٍ، اشحن الكوينز لقبول الطلب"
        : code === "subscription_required" ? "اشتراكك غير فعّال، جدّد الاشتراك لقبول الطلبات" : errMsg(e);
      if (code === "not_pending" && pendingIncoming?.id === id) setPendingIncoming(null);
      reload();
      return { ok: false, reason, error: code };
    }
  }, [pendingIncoming, reload, refreshProfile]);

  const rejectOrder = useCallback(async (id: string) => {
    try { await api(`/api/orders/${id}/reject`, { method: "POST" }); } catch { /* ignore */ }
    if (pendingIncoming?.id === id) setPendingIncoming(null);
    reload();
  }, [pendingIncoming, reload]);

  const value = useMemo<ProviderState>(() => ({
    feed,
    online: !!feed?.online,
    setOnline,
    reload,
    pendingIncoming,
    incomingMinimized,
    setIncomingMinimized,
    acceptOrder,
    rejectOrder,
    dismissIncoming: () => { if (pendingIncoming) dismissed.current.add(pendingIncoming.id); setPendingIncoming(null); },
  }), [feed, setOnline, reload, pendingIncoming, incomingMinimized, acceptOrder, rejectOrder]);

  return <ProviderCtx.Provider value={value}>{children}</ProviderCtx.Provider>;
}

export function useProvider() {
  const ctx = useContext(ProviderCtx);
  if (!ctx) throw new Error("useProvider must be used within ProviderProvider");
  return ctx;
}

export type ProviderStats = {
  completed: number; cancelled: number; active: number; rating: number; rating_count: number; work_hours: number;
  joined_at: string; full_name: string | null; services_breakdown: { name: string; count: number }[];
  weekly: { day: string; count: number }[]; demand_by_hour: { hour: number; count: number }[];
  recent: { id: string; service_name: string; sub_service_name: string | null; status: string; rating: number | null; at: string }[];
};

export function useProviderStats() {
  const { user, isProvider } = useAuth();
  const [stats, setStats] = useState<ProviderStats | null>(null);
  useEffect(() => {
    if (!user || !isProvider) { setStats(null); return; }
    api<ProviderStats>("/api/provider/stats").then(setStats).catch(() => setStats(null));
  }, [user?.id, isProvider]);
  return stats;
}

/** Loyalty tiers; the current tier follows completed orders and rating. */
export const LOYALTY_TIERS = [
  { name: "موثق", min: 0, minRating: 0, reward: "10 نقاط", requirement: "إكمال التسجيل والتحقق", perks: ["تمكين بدء العمل", "إحصائيات أداء أساسية"] },
  { name: "مُعتمد", min: 50, minRating: 4.5, reward: "30 نقطة", requirement: "إنجاز 50 طلب + تقييم 4.5/5", perks: ["شارة برونزية", "إبراز إنجازاتك لدى طالب الخدمة"] },
  { name: "مُميز", min: 150, minRating: 4.5, reward: "100 نقطة", requirement: "إنجاز 150 طلب + تقييم 4.5/5", perks: ["شارة فضية", "إحصائيات متقدمة", "ميزات مُعتمد كاملة"] },
  { name: "خبير", min: 300, minRating: 4.7, reward: "200 نقطة", requirement: "إنجاز 300 طلب + تقييم 4.7/5", perks: ["شارة ذهبية", "شهادة مميزة", "دعوات لورش ودورات", "أولوية في الظهور"] },
] as const;

export function currentTierIndex(completed: number, rating: number) {
  let idx = 0;
  LOYALTY_TIERS.forEach((t, i) => { if (completed >= t.min && rating >= t.minRating) idx = i; });
  return idx;
}
