import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api";

export interface PublicSettings {
  app_name: string; logo_url: string | null; currency_label: string; primary_color: string | null;
  support_email: string | null; support_phone: string | null; welcome_customer: string | null; welcome_provider: string | null;
  billing_coins_enabled: boolean; billing_subscription_enabled: boolean;
  sub_price_1m: number; sub_price_3m: number; sub_price_6m: number; sub_price_12m: number;
  vat_percent: number; test_payments_enabled: boolean;
}
export interface LiveSub { id: string; service_id: string; name: string; description: string | null; icon: string | null; color: string | null; coin_price: number; delivery_mode: "in_person" | "remote" | "both" }
export interface LiveService { id: string; name: string; description: string | null; icon: string | null; color: string; coin_price: number; subs: LiveSub[] }
export interface PublicAd { id: string; title: string; sponsor: string; image_url: string | null; link: string | null; placement: string }
export interface PublicPolicy { id: string; title: string; body: string; audience: "all" | "customers" | "providers"; policy_type: string; version: string; updated_at: string }

type Bootstrap = { settings: PublicSettings; services: Omit<LiveService, "subs">[]; sub_services: LiveSub[]; ads: PublicAd[]; policies: PublicPolicy[]; regions: string[] };

interface PublicState {
  loading: boolean;
  error: boolean;
  settings: PublicSettings | null;
  services: LiveService[];
  subs: LiveSub[];
  ads: PublicAd[];
  policies: PublicPolicy[];
  regions: string[];
  reload: () => Promise<void>;
}

export const DEFAULT_REGIONS = ["الرياض", "جدة", "مكة", "المدينة", "بريدة", "الدمام", "الخبر", "أبها", "تبوك", "حائل", "جازان", "نجران", "الطائف", "الأحساء", "الجوف", "عرعر", "الباحة"];

const Ctx = createContext<PublicState | null>(null);

export function PublicDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    try {
      setData(await api<Bootstrap>("/api/public/bootstrap"));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const value = useMemo<PublicState>(() => {
    const subs = data?.sub_services ?? [];
    return {
      loading,
      error,
      settings: data?.settings ?? null,
      services: (data?.services ?? []).map((s) => ({ ...s, subs: subs.filter((x) => x.service_id === s.id) })),
      subs,
      ads: data?.ads ?? [],
      policies: data?.policies ?? [],
      regions: data?.regions?.length ? data.regions : DEFAULT_REGIONS,
      reload,
    };
  }, [data, loading, error, reload]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePublicData() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePublicData must be used within PublicDataProvider");
  return c;
}

/** Published policy of a given type for an audience, or null. */
export function findPolicy(policies: PublicPolicy[], type: string, audience: "customers" | "providers") {
  return policies.find((p) => p.policy_type === type && (p.audience === "all" || p.audience === audience)) ?? null;
}
