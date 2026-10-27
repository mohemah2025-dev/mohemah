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

/** Admin panel sections; each is "none" | "view" | "edit" for a staff member (the owner has everything). */
export const ADMIN_SECTIONS = [
  { key: "dashboard", label: "الرئيسية" },
  { key: "analytics", label: "تحليل الطلبات" },
  { key: "customers", label: "طالبو الخدمات" },
  { key: "providers", label: "مقدمو الخدمات" },
  { key: "services", label: "الخدمات" },
  { key: "finance", label: "المالية" },
  { key: "billing", label: "الاشتراكات والتحصيل" },
  { key: "gateways", label: "بوابات الدفع" },
  { key: "notifications", label: "الإشعارات" },
  { key: "messages", label: "الرسائل" },
  { key: "ads", label: "المساحات الإعلانية" },
  { key: "policies", label: "السياسات والشروط" },
  { key: "integrations", label: "الرسائل النصية والبريد" },
  { key: "staff", label: "المستخدمون والصلاحيات" },
  { key: "settings", label: "الإعدادات" },
] as const;
export type AdminSection = (typeof ADMIN_SECTIONS)[number]["key"];
export type PermLevel = "none" | "view" | "edit";
export type AdminPermissions = Record<AdminSection, PermLevel>;
/** Allowed actions inside a page ({} or a missing page = every action of that page). */
export type AdminFeatures = Partial<Record<AdminSection, string[]>>;

/** The actions of each page that can be granted one by one. */
export const ADMIN_FEATURES: Partial<Record<AdminSection, { key: string; label: string }[]>> = {
  customers: [{ key: "edit", label: "تعديل البيانات" }, { key: "suspend", label: "الإيقاف والحذف" }],
  providers: [{ key: "approve", label: "قبول ورفض الطلبات والخدمات" }, { key: "edit", label: "تعديل البيانات والخدمات" }, { key: "suspend", label: "الإيقاف والحذف" }, { key: "balance", label: "تعديل الرصيد" }, { key: "remind", label: "إرسال التنبيهات" }],
  services: [{ key: "add", label: "إضافة" }, { key: "edit", label: "تعديل وترتيب" }, { key: "delete", label: "حذف" }],
  billing: [{ key: "grant", label: "منح اشتراك أو كوينز" }, { key: "promotions", label: "العروض والخصومات" }, { key: "prices", label: "أسعار الباقات" }],
  notifications: [{ key: "send", label: "إرسال" }, { key: "delete", label: "حذف" }],
  messages: [{ key: "reply", label: "الرد" }, { key: "assign", label: "إسناد لموظف" }, { key: "close", label: "إنهاء المحادثة" }, { key: "start", label: "بدء محادثة" }],
  ads: [{ key: "add", label: "إضافة" }, { key: "edit", label: "تعديل وإيقاف" }, { key: "delete", label: "حذف" }],
  policies: [{ key: "add", label: "إضافة" }, { key: "edit", label: "تعديل" }, { key: "delete", label: "حذف" }],
  settings: [{ key: "general", label: "البيانات العامة" }, { key: "branding", label: "الشعارات والألوان" }, { key: "links", label: "روابط التحميل" }],
  staff: [{ key: "add", label: "إضافة مستخدم" }, { key: "permissions", label: "تعديل الصلاحيات" }, { key: "edit", label: "تعديل البيانات وكلمة المرور" }, { key: "suspend", label: "الإيقاف والحذف" }],
};

export type MePayload = { profile: AppProfile | null; roles: AppRole[]; app: App | null; subscription_end?: string | null; permissions?: AdminPermissions | null; features?: AdminFeatures | null; token?: string };

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
  permissions: AdminPermissions | null;
  /** Admin panel: may this account view / edit a section? */
  can: (section: AdminSection, level?: "view" | "edit") => boolean;
  features: AdminFeatures | null;
  /** May this account perform `action` inside `section` (edit access + the action granted)? */
  canDo: (section: AdminSection, action: string) => boolean;
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
    setMe({ profile: payload.profile, roles: payload.roles, app: payload.app, subscription_end: payload.subscription_end, permissions: payload.permissions ?? null, features: payload.features ?? null });
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
      permissions: me.permissions ?? null,
      can: (section, level = "view") => {
        if (roles.includes("admin")) return true;
        const v = me.permissions?.[section] ?? "none";
        return level === "view" ? v !== "none" : v === "edit";
      },
      features: me.features ?? null,
      canDo: (section, action) => {
        if (roles.includes("admin")) return true;
        if ((me.permissions?.[section] ?? "none") !== "edit") return false;
        const list = me.features?.[section];
        return !list || list.includes(action);
      },
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
