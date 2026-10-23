import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, session, type App } from "@/lib/api";

export type AppRole = "admin" | "staff" | "provider" | "customer";

export interface AppProfile {
  id: string;
  email: string | null;
  username: string | null;
  full_name: string | null;
  phone: string | null;
  region: string | null;
  gender: "male" | "female" | null;
  avatar_url: string | null;
  bio: string | null;
  coin_balance: number;
  rating: number;
  rating_count: number;
  customer_rating: number;
  is_active: boolean;
  is_online: boolean;
  billing_mode: "coins" | "subscription";
  verification_status: "none" | "pending" | "approved" | "rejected";
  review_note: string | null;
  national_id: string | null;
  nationality: string | null;
  requested_services: string[];
  referral_code: string | null;
  created_at: string;
}

export type MePayload = { profile: AppProfile | null; roles: AppRole[]; app: App | null; subscription_end?: string | null; token?: string };

interface AuthState {
  app: App;
  user: { id: string; email: string | null } | null;
  profile: AppProfile | null;
  roles: AppRole[];
  subscriptionEnd: string | null;
  loading: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  isProvider: boolean;
  isCustomer: boolean;
  signIn: (identifier: string, password: string) => Promise<MePayload>;
  acceptSession: (payload: MePayload) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ app, children }: { app: App; children: ReactNode }) {
  const [me, setMe] = useState<MePayload>({ profile: null, roles: [], app: null });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session.get(app)) { setMe({ profile: null, roles: [], app: null }); return; }
    try {
      const data = await api<MePayload>("/api/auth/me", { app });
      if (!data.profile) session.clear(app);
      setMe(data);
    } catch {
      /* offline: keep previous state */
    }
  }, [app]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const acceptSession = useCallback((payload: MePayload) => {
    if (payload.token) session.set(app, payload.token);
    setMe({ profile: payload.profile, roles: payload.roles, app: payload.app, subscription_end: payload.subscription_end });
  }, [app]);

  const signIn = useCallback(async (identifier: string, password: string) => {
    const data = await api<MePayload>("/api/auth/login", { app, body: { identifier: identifier.trim(), password, app } });
    acceptSession(data);
    return data;
  }, [app, acceptSession]);

  const signOut = useCallback(async () => {
    try { await api("/api/auth/logout", { app, method: "POST" }); } catch { /* ignore */ }
    session.clear(app);
    setMe({ profile: null, roles: [], app: null });
  }, [app]);

  const value = useMemo<AuthState>(() => {
    const roles = me.roles ?? [];
    return {
      app,
      user: me.profile ? { id: me.profile.id, email: me.profile.email } : null,
      profile: me.profile,
      roles,
      subscriptionEnd: me.subscription_end ?? null,
      loading,
      isAdmin: roles.includes("admin") || roles.includes("staff"),
      isOwner: roles.includes("admin"),
      isProvider: roles.includes("provider"),
      isCustomer: roles.includes("customer"),
      signIn,
      acceptSession,
      signOut,
      refreshProfile: load,
    };
  }, [app, me, loading, signIn, acceptSession, signOut, load]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
