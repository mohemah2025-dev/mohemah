import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from "react";
import { api, errMsg } from "@/lib/api";
import { compressImage } from "@/lib/imageCompress";
import { useAuth, type AdminPermissions, type AdminSection } from "@/lib/AuthContext";
import { toast } from "sonner";

/* ============================ Types ============================ */
export interface SubService {
  id: string;
  name: string;
  description: string;
  details: string;
  estimatedDuration?: string;
  requiresPhotos?: boolean;
  icon?: string;
  color?: string;
  coinPrice?: number;
  deliveryMode?: "in_person" | "remote" | "both";
  active?: boolean;
  sortOrder?: number;
}

export interface MainService {
  id: string;
  name: string;
  description: string;
  icon: string;
  color?: string;
  coinPrice: number;
  active: boolean;
  sortOrder?: number;
  subServices: SubService[];
}

export interface AdminCustomer {
  id: string;
  name: string;
  phone: string;
  region: string;
  gender: "ذكر" | "أنثى";
  ordersCount: number;
  lastActive: string;
  favoriteService?: string;
}

export interface AdminProviderRow {
  id: string;
  name: string;
  phone: string;
  region: string;
  gender: "ذكر" | "أنثى";
  services: string[];
  rating: number;
  coinBalance: number;
  status: "نشط" | "موقوف";
}

export interface CoinTransaction {
  id: string;
  providerId: string;
  providerName: string;
  serviceName: string;
  coins: number;
  date: string;
  type: "خصم طلب" | "شحن";
  method?: "Apple Pay" | "Mada" | "تحويل" | "بطاقة";
  txType?: "topup" | "deduction" | "refund" | "bonus";
}

export interface AdminOrder {
  id: string; order_no: number; service_id: string | null; service_name: string; sub_service_name: string | null; mode: string; status: string;
  region: string | null; coin_cost: number; charged_coins: number; billing_mode: string | null; rating: number | null; created_at: string;
  accepted_at: string | null; completed_at: string | null; cancelled_at: string | null; provider_id: string | null; customer_id: string | null;
  customer_name: string | null; provider_name: string | null;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: "مالك" | "مشرف" | "دعم" | "محاسبة";
  permissions: { read: string[]; write: string[] };
  /** Page permissions (staff only; null for the owner). */
  access: AdminPermissions | null;
  active: boolean;
}

export type NotifCategory = "عام" | "وطني" | "ديني" | "ترويجي" | "تنبيه" | "صيانة";

export interface AdminNotification {
  id: string;
  title: string;
  body: string;
  audience: "all" | "customers" | "providers" | "specific";
  targetIds?: string[];
  scope: "عامة" | "خاصة";
  category: NotifCategory;
  icon?: string;
  accentColor?: string;
  /** Play the notification sound on the phone. */
  sound?: boolean;
  scheduledAt?: string;
  sentAt: string;
}

export interface AdminAd {
  id: string;
  sponsor: string;
  title: string;
  imageUrl?: string;
  link?: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  active: boolean;
  placement?: "بانر علوي" | "بانر سفلي" | "بطاقة منبثقة";
}

export interface AdminPolicy {
  id: string;
  title: string;
  body: string;
  audience: "all" | "customers" | "providers";
  type: "خصوصية" | "شروط استخدام" | "سياسة دفع" | "سياسة استرداد" | "سياسة عامة";
  version: string;
  updatedAt: string;
  published: boolean;
  /** Where it appears in the apps. */
  placements: PolicyPlacement[];
}

export type PolicyPlacement = "registration" | "account" | "order" | "billing" | "application";
export const POLICY_PLACEMENTS: { key: PolicyPlacement; label: string; who: "customers" | "providers" | "all" }[] = [
  { key: "registration", label: "صفحة التسجيل (موافقة قبل إنشاء الحساب)", who: "all" },
  { key: "account", label: "صفحة حسابي ← السياسات والشروط", who: "all" },
  { key: "order", label: "صفحة إرسال الطلب (طالب الخدمة)", who: "customers" },
  { key: "billing", label: "صفحة الرصيد والاشتراك (مقدم الخدمة)", who: "providers" },
  { key: "application", label: "طلب الانضمام والمستندات (مقدم الخدمة)", who: "providers" },
];

export interface AdminSettings {
  appName: string;
  logoUrl: string;
  currencyLabel: string;
  welcomeProvider: string;
  welcomeCustomer: string;
  supportEmail: string;
  supportPhone: string;
  primaryColor: string;
}

const PERM_SECTIONS = [
  "dashboard", "customers", "providers", "services",
  "finance", "notifications", "ads", "staff", "settings",
] as const;

export { DEFAULT_REGIONS as REGIONS_LIST } from "@/lib/publicData";

/* ============================ Enum mappers ============================ */
const dbCategoryToAr: Record<string, NotifCategory> = {
  general: "عام", national: "وطني", religious: "ديني", promo: "ترويجي", alert: "تنبيه", maintenance: "صيانة",
};
const arCategoryToDb: Record<NotifCategory, string> = {
  "عام": "general", "وطني": "national", "ديني": "religious", "ترويجي": "promo", "تنبيه": "alert", "صيانة": "maintenance",
};
const dbPlacementToAr: Record<string, AdminAd["placement"]> = {
  top_banner: "بانر علوي", bottom_banner: "بانر سفلي", popup_card: "بطاقة منبثقة",
};
const arPlacementToDb = (p?: AdminAd["placement"]) =>
  p === "بانر علوي" ? "top_banner" : p === "بانر سفلي" ? "bottom_banner" : p === "بطاقة منبثقة" ? "popup_card" : "top_banner";

const dbPolicyTypeOk = (t: AdminPolicy["type"]) => t; // stored as freeform text

function lastActiveLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 1) return "اليوم";
  if (diff < 2) return "أمس";
  if (diff < 8) return `قبل ${Math.floor(diff)} أيام`;
  return d.toISOString().slice(0, 10);
}

/* ============================ Notification presets ============================ */
export const NOTIFICATION_PRESETS: { key: string; category: NotifCategory; icon: string; accentColor: string; title: string; body: string }[] = [
  { key: "eid_fitr", category: "ديني", icon: "moon", accentColor: "#10B981",
    title: "كل عام وأنتم بخير بعيد الفطر المبارك",
    body: "تتقدم أسرة تطبيق مهمة بأطيب التهاني بمناسبة عيد الفطر السعيد، أعاده الله علينا وعليكم باليُمن والبركات." },
  { key: "eid_adha", category: "ديني", icon: "mosque", accentColor: "#0EA5E9",
    title: "عيد أضحى مبارك",
    body: "نسأل الله أن يتقبل منكم صالح الأعمال، وكل عام وأنتم بخير بمناسبة عيد الأضحى المبارك." },
  { key: "ramadan", category: "ديني", icon: "moon", accentColor: "#7C3AED",
    title: "رمضان كريم",
    body: "بلغكم الله شهر رمضان وأعانكم على صيامه وقيامه، تقبل الله منا ومنكم صالح الأعمال." },
  { key: "hijri_new", category: "ديني", icon: "star", accentColor: "#F59E0B",
    title: "بمناسبة العام الهجري الجديد",
    body: "نسأل الله أن يجعله عام خير وبركة على الأمة الإسلامية، كل عام وأنتم بخير." },
  { key: "arafah", category: "ديني", icon: "sun", accentColor: "#16A34A",
    title: "تذكير بيوم عرفة",
    body: "لا تنسوا فضل صيام يوم عرفة الذي يكفّر السنة الماضية والباقية." },
  { key: "saudi_national", category: "وطني", icon: "flag", accentColor: "#006C35",
    title: "كل عام والمملكة بخير",
    body: "بمناسبة اليوم الوطني للمملكة العربية السعودية، نرفع أسمى آيات التهاني والتبريكات لمقام خادم الحرمين الشريفين وسمو ولي عهده الأمين، وللشعب السعودي الكريم. هي لنا دار 🇸🇦." },
  { key: "founding_day", category: "وطني", icon: "palm", accentColor: "#8B5E3C",
    title: "يوم التأسيس - يوم بدينا",
    body: "نحتفي بثلاثة قرون من المجد والتأسيس، كل عام وأنتم بخير في يوم التأسيس." },
  { key: "promo", category: "ترويجي", icon: "gift", accentColor: "#EC4899",
    title: "عرض حصري لفترة محدودة",
    body: "استمتع بخصومات مميزة على باقات الكوينز هذا الأسبوع." },
  { key: "maintenance", category: "صيانة", icon: "wrench", accentColor: "#64748B",
    title: "صيانة مجدولة للتطبيق",
    body: "سيتم إيقاف الخدمة مؤقتاً لإجراء تحديثات تحسينية، نعتذر عن أي إزعاج." },
];

/* ============================ Defaults ============================ */
const defaultSettings: AdminSettings = {
  appName: "مهمة",
  logoUrl: "",
  currencyLabel: "كوين",
  welcomeProvider: "مرحباً بك في مهمة، فعّل الاتصال من الرئيسية لتصلك الطلبات الجديدة في خدماتك.",
  welcomeCustomer: "أهلاً بك في مهمة، اطلب أي خدمة بضغطة زر ونوصلك بأقرب مقدم خدمة.",
  supportEmail: "support@mohemah.app",
  supportPhone: "+966500000000",
  primaryColor: "#3b6fd8",
};

/* ============================ Store Interface ============================ */
interface AdminState {
  loading: boolean;
  isAdmin: boolean;

  services: MainService[];
  customers: AdminCustomer[];
  providers: AdminProviderRow[];
  transactions: CoinTransaction[];
  staff: StaffMember[];
  notifications: AdminNotification[];
  ads: AdminAd[];
  policies: AdminPolicy[];
  settings: AdminSettings;
  orders: AdminOrder[];

  bootstrapAdmin: () => Promise<void>;
  refreshAll: () => Promise<void>;
  resetPassword: (id: string, password: string) => Promise<void>;

  updateService: (id: string, patch: Partial<MainService>) => Promise<void>;
  addService: (s: Omit<MainService, "id" | "subServices">) => Promise<string>;
  removeService: (id: string) => Promise<void>;
  moveSubService: (subId: string, toMainId: string) => Promise<void>;
  addSubService: (mainId: string, s: Omit<SubService, "id">) => Promise<void>;
  updateSubService: (mainId: string, subId: string, patch: Partial<SubService>) => Promise<void>;
  removeSubService: (mainId: string, subId: string) => Promise<void>;
  reorder: (table: "services" | "sub_services", ids: string[]) => Promise<void>;
  addSuggestedServices: (list: unknown[]) => Promise<void>;

  addCustomer: (c: Omit<AdminCustomer, "id">) => void;
  updateCustomer: (id: string, patch: Partial<AdminCustomer>) => void;
  removeCustomer: (id: string) => void;

  addProvider: (p: Omit<AdminProviderRow, "id">) => void;
  updateProvider: (id: string, patch: Partial<AdminProviderRow>) => void;
  removeProvider: (id: string) => void;

  addStaff: (s: { name: string; login: string; password: string; role: "مالك" | "مشرف"; permissions?: AdminPermissions }) => Promise<void>;
  setStaffPermissions: (id: string, permissions: AdminPermissions) => Promise<void>;
  toggleStaff: (id: string) => void;
  removeStaff: (id: string) => void;

  sendNotification: (n: Omit<AdminNotification, "id" | "sentAt">) => void;
  removeNotification: (id: string) => void;

  addAd: (a: Omit<AdminAd, "id">) => void;
  updateAd: (id: string, patch: Partial<AdminAd>) => void;
  removeAd: (id: string) => void;

  addPolicy: (p: Omit<AdminPolicy, "id" | "updatedAt">) => void;
  updatePolicy: (id: string, patch: Partial<AdminPolicy>) => void;
  removePolicy: (id: string) => void;

  updateSettings: (patch: Partial<AdminSettings>) => Promise<void>;

  getCoinPriceForService: (serviceName: string) => number;
}

const Ctx = createContext<AdminState | null>(null);

/* ============================ Provider ============================ */
type ApiUser = {
  id: string; full_name: string | null; email: string | null; username: string | null; phone: string | null; region: string | null;
  gender: string | null; rating: number; coin_balance: number; is_active: boolean; roles: string[]; services: string[];
  orders_count: number; favorite_service: string | null; updated_at: string; last_seen_at: string | null;
  permissions?: AdminPermissions | null;
};
type ApiService = { id: string; name: string; description: string | null; icon: string; color: string; coin_price: number; active: number; sort_order: number };
type ApiSub = { id: string; service_id: string; name: string; description: string | null; details: string | null; estimated_duration: string | null; requires_photos: number; icon: string; color: string; coin_price: number | null; delivery_mode: string; active: number; sort_order: number };

const adm = <T,>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}) => api<T>(path, { ...opts, app: "admin" });

function subPatch(patch: Partial<SubService>) {
  const p: Record<string, unknown> = {};
  if (patch.name !== undefined) p.name = patch.name;
  if (patch.description !== undefined) p.description = patch.description;
  if (patch.details !== undefined) p.details = patch.details;
  if (patch.estimatedDuration !== undefined) p.estimated_duration = patch.estimatedDuration;
  if (patch.requiresPhotos !== undefined) p.requires_photos = patch.requiresPhotos;
  if (patch.icon !== undefined) p.icon = patch.icon;
  if (patch.color !== undefined) p.color = patch.color;
  if (patch.coinPrice !== undefined) p.coin_price = patch.coinPrice;
  if (patch.deliveryMode !== undefined) p.delivery_mode = patch.deliveryMode;
  if (patch.active !== undefined) p.active = patch.active;
  if (patch.sortOrder !== undefined) p.sort_order = patch.sortOrder;
  return p;
}

/** Uploads an image (logo, ad banner) and returns its public URL. */
export async function uploadAdminImage(file: File) {
  const form = new FormData();
  form.set("file", await compressImage(file, 1600, 0.85));
  return (await adm<{ url: string }>("/api/admin/upload", { form })).url;
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const { user, roles, can } = useAuth();
  const isAdmin = roles.includes("admin") || roles.includes("staff");

  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<MainService[]>([]);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [providers, setProviders] = useState<AdminProviderRow[]>([]);
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [ads, setAds] = useState<AdminAd[]>([]);
  const [policies, setPolicies] = useState<AdminPolicy[]>([]);
  const [settings, setSettings] = useState<AdminSettings>(defaultSettings);
  const [orders, setOrders] = useState<AdminOrder[]>([]);

  const report = (e: unknown) => toast.error(errMsg(e));

  /* ---------- Loaders ---------- */
  const loadServices = useCallback(async () => {
    const { services: svcs, sub_services: subs } = await adm<{ services: ApiService[]; sub_services: ApiSub[] }>("/api/admin/services");
    setServices(svcs.map((s) => ({
      id: s.id, name: s.name, description: s.description ?? "", icon: s.icon ?? "Wrench", color: s.color,
      coinPrice: s.coin_price, active: !!s.active, sortOrder: s.sort_order,
      subServices: subs.filter((x) => x.service_id === s.id).map((x) => ({
        id: x.id, name: x.name, description: x.description ?? "", details: x.details ?? "",
        estimatedDuration: x.estimated_duration ?? "", requiresPhotos: !!x.requires_photos,
        icon: x.icon, color: x.color, coinPrice: x.coin_price ?? s.coin_price,
        deliveryMode: (x.delivery_mode as SubService["deliveryMode"]) ?? "both", active: !!x.active, sortOrder: x.sort_order,
      })),
    })));
  }, []);

  const loadUsers = useCallback(async () => {
    const rows = await adm<ApiUser[]>("/api/admin/users");
    const cs: AdminCustomer[] = [];
    const ps: AdminProviderRow[] = [];
    const st: StaffMember[] = [];
    rows.forEach((p) => {
      const name = p.full_name || p.phone || p.username || p.id.slice(0, 8);
      const gender: "ذكر" | "أنثى" = p.gender === "female" ? "أنثى" : "ذكر";
      const region = p.region ?? "—";
      if (p.roles.includes("admin") || p.roles.includes("staff")) {
        st.push({
          id: p.id, name, email: p.email ?? p.username ?? "—",
          role: p.roles.includes("admin") ? "مالك" : "مشرف",
          permissions: { read: [...PERM_SECTIONS], write: p.roles.includes("admin") ? [...PERM_SECTIONS] : PERM_SECTIONS.filter((x) => x !== "staff" && x !== "settings") },
          access: p.permissions ?? null,
          active: p.is_active,
        });
      }
      if (p.roles.includes("provider")) {
        ps.push({ id: p.id, name, phone: p.phone ?? "—", region, gender, services: p.services, rating: Number(p.rating ?? 0), coinBalance: p.coin_balance, status: p.is_active ? "نشط" : "موقوف" });
      }
      if (p.roles.includes("customer")) {
        cs.push({ id: p.id, name, phone: p.phone ?? "—", region, gender, ordersCount: p.orders_count, lastActive: lastActiveLabel(p.last_seen_at ?? p.updated_at), favoriteService: p.favorite_service ?? undefined });
      }
    });
    setCustomers(cs);
    setProviders(ps);
    setStaff(st);
  }, []);

  const loadTransactions = useCallback(async () => {
    const data = await adm<{ id: string; provider_id: string; order_id: string | null; amount: number; tx_type: string; method: string | null; created_at: string; provider_name: string | null; provider_phone: string | null; service_name: string | null }[]>("/api/admin/transactions");
    setTransactions(data.map((t) => ({
      id: t.id, providerId: t.provider_id, providerName: t.provider_name || t.provider_phone || t.provider_id.slice(0, 8),
      serviceName: t.tx_type === "deduction" ? (t.service_name ?? "—") : t.tx_type === "topup" ? "شحن" : t.tx_type === "refund" ? "استرجاع" : "هدية",
      coins: t.amount,
      date: new Date(t.created_at).toISOString().slice(0, 16).replace("T", " "),
      type: t.tx_type === "deduction" ? "خصم طلب" : "شحن",
      method: (t.method as CoinTransaction["method"]) ?? undefined,
      txType: t.tx_type as CoinTransaction["txType"],
    })));
  }, []);

  const loadOrders = useCallback(async () => { setOrders(await adm<AdminOrder[]>("/api/admin/orders")); }, []);

  const loadNotifications = useCallback(async () => {
    const data = await adm<{ id: string; title: string; body: string; audience: string; target_ids: string[]; category: string; icon: string | null; accent_color: string | null; scheduled_at: string | null; sent_at: string; sound?: number }[]>("/api/admin/notifications");
    setNotifications(data.map((n) => ({
      id: n.id, title: n.title, body: n.body,
      audience: n.audience as AdminNotification["audience"],
      targetIds: n.target_ids?.length ? n.target_ids : undefined,
      scope: n.audience === "all" ? "عامة" : "خاصة",
      category: dbCategoryToAr[n.category] ?? "عام",
      icon: n.icon ?? "bell",
      sound: n.sound !== 0,
      accentColor: n.accent_color ?? "#FF6B5C",
      scheduledAt: n.scheduled_at ?? undefined,
      sentAt: new Date(n.sent_at).toISOString().slice(0, 16).replace("T", " "),
    })));
  }, []);

  const loadAds = useCallback(async () => {
    const data = await adm<{ id: string; sponsor: string; title: string; image_url: string | null; link: string | null; start_date: string; end_date: string; active: number; placement: string }[]>("/api/admin/ads");
    setAds(data.map((a) => ({
      id: a.id, sponsor: a.sponsor, title: a.title, imageUrl: a.image_url ?? undefined, link: a.link ?? undefined,
      startDate: a.start_date, endDate: a.end_date,
      durationDays: Math.max(1, Math.round((new Date(a.end_date).getTime() - new Date(a.start_date).getTime()) / 86400000)),
      active: !!a.active, placement: dbPlacementToAr[a.placement] ?? "بانر علوي",
    })));
  }, []);

  const loadPolicies = useCallback(async () => {
    const data = await adm<{ id: string; title: string; body: string; audience: string; policy_type: string; version: string; updated_at: string; published: number; placements: string | null }[]>("/api/admin/policies");
    setPolicies(data.map((p) => ({
      id: p.id, title: p.title, body: p.body, audience: p.audience as AdminPolicy["audience"],
      type: (p.policy_type as AdminPolicy["type"]) || "سياسة عامة", version: p.version,
      updatedAt: new Date(p.updated_at).toISOString().slice(0, 10), published: !!p.published,
      placements: (() => { try { return JSON.parse(p.placements ?? "[]") as PolicyPlacement[]; } catch { return ["registration", "account"] as PolicyPlacement[]; } })(),
    })));
  }, []);

  const loadSettings = useCallback(async () => {
    const data = await adm<Record<string, string | null>>("/api/admin/settings");
    setSettings({
      appName: data.app_name ?? defaultSettings.appName,
      logoUrl: data.logo_url ?? "",
      currencyLabel: data.currency_label ?? defaultSettings.currencyLabel,
      welcomeProvider: data.welcome_provider ?? defaultSettings.welcomeProvider,
      welcomeCustomer: data.welcome_customer ?? defaultSettings.welcomeCustomer,
      supportEmail: data.support_email ?? defaultSettings.supportEmail,
      supportPhone: data.support_phone ?? defaultSettings.supportPhone,
      primaryColor: data.primary_color ?? defaultSettings.primaryColor,
    });
  }, []);

  const refreshAll = useCallback(async () => {
    if (!isAdmin) { setLoading(false); return; }
    setLoading(true);
    // Load only what this account may view (the server enforces the same rules).
    const any = (...xs: AdminSection[]) => xs.some((x) => can(x, "view"));
    const results = await Promise.allSettled([
      any("services", "providers", "dashboard", "finance") ? loadServices() : null,
      loadSettings(),
      any("ads") ? loadAds() : null,
      any("policies") ? loadPolicies() : null,
      any("notifications") ? loadNotifications() : null,
      any("customers", "providers", "staff", "dashboard", "billing", "finance") ? loadUsers() : null,
      any("finance", "billing", "dashboard") ? loadTransactions() : null,
      any("finance", "dashboard", "customers", "providers") ? loadOrders() : null,
    ]);
    const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    if (failed) report(failed.reason);
    setLoading(false);
  }, [isAdmin, can, loadServices, loadSettings, loadAds, loadPolicies, loadNotifications, loadUsers, loadTransactions, loadOrders]);

  useEffect(() => { refreshAll(); }, [refreshAll, user?.id]);

  /* ---------- Mutations ---------- */
  const bootstrapAdmin = useCallback(async () => { /* first-run setup is handled by the sign-in screen */ }, []);

  const addService = async (s: Omit<MainService, "id" | "subServices">) => {
    const r = await adm<{ id: string }>("/api/admin/services", { body: { name: s.name, icon: s.icon, color: s.color ?? "blue", coin_price: s.coinPrice, description: s.description, active: s.active, sort_order: services.length } });
    await loadServices();
    return r.id;
  };
  const updateService = async (id: string, patch: Partial<MainService>) => {
    const p: Record<string, unknown> = {};
    if (patch.name !== undefined) p.name = patch.name;
    if (patch.icon !== undefined) p.icon = patch.icon;
    if (patch.color !== undefined) p.color = patch.color;
    if (patch.description !== undefined) p.description = patch.description;
    if (patch.coinPrice !== undefined) p.coin_price = patch.coinPrice;
    if (patch.active !== undefined) p.active = patch.active;
    if (patch.sortOrder !== undefined) p.sort_order = patch.sortOrder;
    await adm(`/api/admin/services/${id}`, { method: "PATCH", body: p });
    await loadServices();
  };
  const removeService = async (id: string) => { await adm(`/api/admin/services/${id}`, { method: "DELETE" }); await loadServices(); };
  const moveSubService = async (sid: string, toMainId: string) => { await adm(`/api/admin/sub-services/${sid}`, { method: "PATCH", body: { service_id: toMainId, sort_order: 9999 } }); await loadServices(); };
  const addSubService = async (mid: string, s: Omit<SubService, "id">) => {
    await adm("/api/admin/sub-services", { body: { service_id: mid, ...subPatch({ ...s, icon: s.icon ?? "Wrench", color: s.color ?? "blue", deliveryMode: s.deliveryMode ?? "both", active: s.active ?? true, sortOrder: s.sortOrder ?? 999 }) } });
    await loadServices();
  };
  const updateSubService = async (_mid: string, sid: string, patch: Partial<SubService>) => { await adm(`/api/admin/sub-services/${sid}`, { method: "PATCH", body: subPatch(patch) }); await loadServices(); };
  const reorder = async (table: "services" | "sub_services", ids: string[]) => { await adm("/api/admin/reorder", { body: { table, ids } }); await loadServices(); };
  const addSuggestedServices = async (list: unknown[]) => { await adm("/api/admin/services/suggested", { body: { list } }); await loadServices(); };
  const removeSubService = async (_mid: string, sid: string) => { await adm(`/api/admin/sub-services/${sid}`, { method: "DELETE" }); await loadServices(); };

  // Customers register themselves from the customer app; administration edits their data.
  const addCustomer = (_c: Omit<AdminCustomer, "id">) => { toast.info("يسجّل طالب الخدمة حسابه من تطبيق طالب الخدمة"); };
  const userPatch = (patch: Partial<AdminCustomer & AdminProviderRow>) => {
    const p: Record<string, unknown> = {};
    if (patch.name !== undefined) p.full_name = patch.name;
    if (patch.phone !== undefined && patch.phone !== "—") p.phone = patch.phone;
    if (patch.region !== undefined && patch.region !== "—") p.region = patch.region;
    if (patch.gender !== undefined) p.gender = patch.gender === "أنثى" ? "female" : "male";
    if (patch.coinBalance !== undefined) p.coin_balance = patch.coinBalance;
    if (patch.status !== undefined) p.is_active = patch.status === "نشط";
    if (patch.services !== undefined) p.services = patch.services;
    return p;
  };
  const updateCustomer = async (id: string, patch: Partial<AdminCustomer>) => {
    try { await adm(`/api/admin/users/${id}`, { method: "PATCH", body: userPatch(patch) }); await loadUsers(); } catch (e) { report(e); }
  };
  const removeCustomer = async (id: string) => {
    try { await adm(`/api/admin/users/${id}`, { method: "PATCH", body: { is_active: false } }); toast.success("تم إيقاف الحساب"); await loadUsers(); } catch (e) { report(e); }
  };

  const addProvider = (_p: Omit<AdminProviderRow, "id">) => { toast.info("يسجّل مقدم الخدمة من تطبيق مقدم الخدمة، ثم تراجع طلبه هنا"); };
  const updateProvider = async (id: string, patch: Partial<AdminProviderRow>) => {
    try { await adm(`/api/admin/users/${id}`, { method: "PATCH", body: userPatch(patch) }); await loadUsers(); } catch (e) { report(e); }
  };
  const removeProvider = async (id: string) => {
    try { await adm(`/api/admin/users/${id}/role`, { body: { role: "provider", enable: false } }); toast.success("تم إلغاء صفة مقدم الخدمة"); await loadUsers(); } catch (e) { report(e); }
  };

  const addStaff = async (s: { name: string; login: string; password: string; role: "مالك" | "مشرف"; permissions?: AdminPermissions }) => {
    await adm("/api/admin/staff", { body: { full_name: s.name, login: s.login, password: s.password, role: s.role === "مالك" ? "admin" : "staff", permissions: s.permissions } });
    await loadUsers();
  };
  const setStaffPermissions = async (id: string, permissions: AdminPermissions) => {
    await adm(`/api/admin/users/${id}/permissions`, { method: "PUT", body: { permissions } });
    await loadUsers();
  };
  const toggleStaff = async (id: string) => {
    const member = staff.find((s) => s.id === id);
    if (!member) return;
    try { await adm(`/api/admin/users/${id}`, { method: "PATCH", body: { is_active: !member.active } }); await loadUsers(); } catch (e) { report(e); }
  };
  const removeStaff = async (id: string) => {
    try {
      await adm(`/api/admin/users/${id}/role`, { body: { role: "staff", enable: false } });
      await adm(`/api/admin/users/${id}/role`, { body: { role: "admin", enable: false } });
      await loadUsers();
    } catch (e) { report(e); }
  };
  const resetPassword = async (id: string, password: string) => { await adm(`/api/admin/users/${id}/password`, { body: { password } }); };

  const sendNotification = async (n: Omit<AdminNotification, "id" | "sentAt">) => {
    try {
      await adm("/api/admin/notifications", { body: { title: n.title, body: n.body, audience: n.audience, category: arCategoryToDb[n.category], icon: n.icon, accent_color: n.accentColor, sound: n.sound ?? true, scheduled_at: n.scheduledAt || null, target_ids: n.targetIds ?? [] } });
      await loadNotifications();
    } catch (e) { report(e); }
  };
  const removeNotification = async (id: string) => { try { await adm(`/api/admin/notifications/${id}`, { method: "DELETE" }); await loadNotifications(); } catch (e) { report(e); } };

  const adBody = (a: Partial<AdminAd>) => {
    const p: Record<string, unknown> = {};
    if (a.sponsor !== undefined) p.sponsor = a.sponsor;
    if (a.title !== undefined) p.title = a.title;
    if (a.imageUrl !== undefined) p.image_url = a.imageUrl || null;
    if (a.link !== undefined) p.link = a.link || null;
    if (a.startDate !== undefined) p.start_date = a.startDate;
    if (a.endDate !== undefined) p.end_date = a.endDate;
    if (a.active !== undefined) p.active = a.active;
    if (a.placement !== undefined) p.placement = arPlacementToDb(a.placement);
    return p;
  };
  const addAd = async (a: Omit<AdminAd, "id">) => { try { await adm("/api/admin/ads", { body: adBody(a) }); await loadAds(); } catch (e) { report(e); } };
  const updateAd = async (id: string, patch: Partial<AdminAd>) => { try { await adm(`/api/admin/ads/${id}`, { method: "PATCH", body: adBody(patch) }); await loadAds(); } catch (e) { report(e); } };
  const removeAd = async (id: string) => { try { await adm(`/api/admin/ads/${id}`, { method: "DELETE" }); await loadAds(); } catch (e) { report(e); } };

  const policyBody = (p: Partial<AdminPolicy>) => {
    const b: Record<string, unknown> = {};
    if (p.title !== undefined) b.title = p.title;
    if (p.body !== undefined) b.body = p.body;
    if (p.audience !== undefined) b.audience = p.audience;
    if (p.type !== undefined) b.policy_type = dbPolicyTypeOk(p.type);
    if (p.version !== undefined) b.version = p.version;
    if (p.published !== undefined) b.published = p.published;
    if (p.placements !== undefined) b.placements = p.placements;
    return b;
  };
  const addPolicy = async (p: Omit<AdminPolicy, "id" | "updatedAt">) => { try { await adm("/api/admin/policies", { body: policyBody(p) }); await loadPolicies(); } catch (e) { report(e); } };
  const updatePolicy = async (id: string, patch: Partial<AdminPolicy>) => { try { await adm(`/api/admin/policies/${id}`, { method: "PATCH", body: policyBody(patch) }); await loadPolicies(); } catch (e) { report(e); } };
  const removePolicy = async (id: string) => { try { await adm(`/api/admin/policies/${id}`, { method: "DELETE" }); await loadPolicies(); } catch (e) { report(e); } };

  const updateSettings = async (patch: Partial<AdminSettings>) => {
    const merged = { ...settings, ...patch };
    await adm("/api/admin/settings", { method: "PUT", body: {
      app_name: merged.appName, logo_url: merged.logoUrl || null, currency_label: merged.currencyLabel,
      welcome_provider: merged.welcomeProvider, welcome_customer: merged.welcomeCustomer,
      support_email: merged.supportEmail, support_phone: merged.supportPhone, primary_color: merged.primaryColor,
    } });
    setSettings(merged);
  };

  const value = useMemo<AdminState>(() => ({
    loading, isAdmin,
    services, customers, providers, transactions, staff, notifications, ads, policies, settings, orders,
    bootstrapAdmin, refreshAll, resetPassword,
    updateService, addService, removeService, moveSubService, addSubService, updateSubService, removeSubService, reorder, addSuggestedServices,
    addCustomer, updateCustomer, removeCustomer,
    addProvider, updateProvider, removeProvider,
    addStaff, setStaffPermissions, toggleStaff, removeStaff,
    sendNotification, removeNotification,
    addAd, updateAd, removeAd,
    addPolicy, updatePolicy, removePolicy,
    updateSettings,
    getCoinPriceForService: (name) => {
      const s = services.find((x) => name.includes(x.name) || x.name.includes(name));
      return s?.coinPrice ?? 5;
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [loading, isAdmin, services, customers, providers, transactions, staff, notifications, ads, policies, settings, orders]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdmin() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAdmin must be used within AdminProvider");
  return c;
}

export const PERMISSION_SECTIONS = PERM_SECTIONS;
