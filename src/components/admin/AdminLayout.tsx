import { Button } from "@/components/ui/button";
import { ReactNode, useEffect, useState } from "react";
import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, UserCog, Wrench, Wallet, Shield, Settings, Bell, Menu, X, MessageSquare, Search, Megaphone, FileText, LogOut, ShieldCheck, CreditCard, Mail, Lock, BarChart3, BadgePercent } from "lucide-react";
import { AdminProvider, useAdmin } from "@/lib/adminStore";
import { useAuth, type AdminSection, type MePayload } from "@/lib/AuthContext";
import { api, errMsg, fileUrl } from "@/lib/api";
import { Field, inputCls, LoginForm } from "@/components/RegistrationForms";
import { toast } from "sonner";

const nav: { to: string; label: string; icon: typeof LayoutDashboard; section: AdminSection; exact?: boolean; group: string }[] = [
  { to: "/admin", label: "الرئيسية", icon: LayoutDashboard, section: "dashboard", group: "الرئيسية", exact: true },
  { to: "/admin/analytics", label: "تحليل الطلبات", icon: BarChart3, section: "analytics", group: "الرئيسية" },
  { to: "/admin/customers", label: "طالبو الخدمات", icon: Users, section: "customers", group: "المستخدمون" },
  { to: "/admin/providers", label: "مقدمو الخدمات", icon: UserCog, section: "providers", group: "المستخدمون" },
  { to: "/admin/services", label: "الخدمات", icon: Wrench, section: "services", group: "الخدمات والمحتوى" },
  { to: "/admin/finance", label: "المالية", icon: Wallet, section: "finance", group: "المالية" },
  { to: "/admin/billing", label: "الاشتراكات والتحصيل", icon: ShieldCheck, section: "billing", group: "المالية" },
  { to: "/admin/promotions", label: "العروض والخصومات", icon: BadgePercent, section: "billing", group: "المالية" },
  { to: "/admin/gateways", label: "بوابات الدفع", icon: CreditCard, section: "gateways", group: "المالية" },
  { to: "/admin/notifications", label: "الإشعارات", icon: Bell, section: "notifications", group: "التواصل" },
  { to: "/admin/messages", label: "الرسائل", icon: MessageSquare, section: "messages", group: "التواصل" },
  { to: "/admin/integrations", label: "الرسائل والبريد وواتساب", icon: Mail, section: "integrations", group: "التواصل" },
  { to: "/admin/ads", label: "المساحات الإعلانية", icon: Megaphone, section: "ads", group: "الخدمات والمحتوى" },
  { to: "/admin/policies", label: "السياسات والشروط", icon: FileText, section: "policies", group: "الخدمات والمحتوى" },
  { to: "/admin/staff", label: "المستخدمون والصلاحيات", icon: Shield, section: "staff", group: "الإدارة والإعدادات" },
  { to: "/admin/settings", label: "الإعدادات", icon: Settings, section: "settings", group: "الإدارة والإعدادات" },
];

const GROUP_ORDER = ["الرئيسية", "المستخدمون", "المالية", "الخدمات والمحتوى", "التواصل", "الإدارة والإعدادات"];

type Badges = { counts: Record<string, number>; items: { section: string; to: string; count: number; label: string }[]; total: number };

/** Pending work per page (applications, unanswered messages…), refreshed every 30 s and on every page change. */
function useAdminBadges(path: string) {
  const [b, setB] = useState<Badges>({ counts: {}, items: [], total: 0 });
  useEffect(() => {
    let alive = true;
    const load = () => api<Badges>("/api/admin/badges", { app: "admin" }).then((x) => alive && setB(x)).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { alive = false; clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [path]);
  return b;
}

function CountPill({ n }: { n?: number }) {
  if (!n) return null;
  return <span className="ms-auto min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold grid place-items-center animate-in zoom-in">{n > 99 ? "99+" : n}</span>;
}

function BellMenu({ badges }: { badges: Badges }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button variant="ghost" size="icon" aria-label="التنبيهات" onClick={() => setOpen((v) => !v)} className="relative">
        <Bell />
        {badges.total > 0 && <span className="absolute -top-0.5 -left-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold grid place-items-center">{badges.total > 99 ? "99+" : badges.total}</span>}
      </Button>
      {open && <>
        <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
        <div className="absolute left-0 top-11 z-40 w-80 max-w-[90vw] bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
          <p className="px-4 py-3 text-sm font-bold border-b border-border">بانتظار إجراء</p>
          {badges.items.length === 0
            ? <p className="px-4 py-6 text-center text-xs text-muted-foreground">لا توجد مهام معلّقة 👌</p>
            : badges.items.map((x, i) => (
              <Link key={i} to={x.to} onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-3 text-xs hover:bg-mohemah-light border-b border-border last:border-0">
                <span className="min-w-6 h-6 px-1.5 rounded-full bg-red-500/10 text-red-600 font-bold grid place-items-center">{x.count}</span>
                <span className="flex-1">{x.label}</span>
              </Link>
            ))}
        </div>
      </>}
    </div>
  );
}

/** Sidebar links grouped by category, in a fixed order. */
function NavGroups({ items, path, onPick, large = false, counts = {} }: { items: typeof nav; path: string; onPick?: () => void; large?: boolean; counts?: Record<string, number> }) {
  return (
    <>
      {GROUP_ORDER.map((g) => {
        const list = items.filter((n) => n.group === g);
        if (!list.length) return null;
        return (
          <div key={g} className="mb-3">
            <p className="px-3 mb-1 text-[10px] font-bold tracking-wide text-muted-foreground/80">{g}</p>
            <div className="space-y-0.5">
              {list.map((n) => {
                const active = n.exact ? path === n.to || path === `${n.to}/` : path.startsWith(n.to);
                const Icon = n.icon;
                return (
                  <Link key={n.to} to={n.to} onClick={onPick}
                    className={`relative flex items-center gap-3 px-3 ${large ? "py-3 text-sm" : "py-2 text-xs"} rounded-lg transition ${active ? "admin-nav-active font-bold" : "hover:bg-mohemah-light text-foreground"}`}>
                    <Icon className="w-4 h-4" /><span>{n.label}</span>{!n.exact && <CountPill n={counts[n.section]} />}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}

/** Applies the identity colour (settings → primary colour) to the admin panel and the logo to the browser tab. */
function useAdminBranding(color: string | undefined, logo: string | undefined, appName: string | undefined) {
  useEffect(() => {
    const root = document.documentElement;
    if (color && /^#[0-9a-f]{6}$/i.test(color)) {
      root.style.setProperty("--brand", color);
      root.style.setProperty("--primary", color);
      root.style.setProperty("--mohemah-blue", color);
      root.style.setProperty("--ring", color);
    }
    if (appName) document.title = `لوحة تحكم ${appName}`;
    if (logo) {
      const href = fileUrl(logo);
      let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
      link.href = href;
      let apple = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
      if (!apple) { apple = document.createElement("link"); apple.rel = "apple-touch-icon"; document.head.appendChild(apple); }
      apple.href = href;
    }
    return () => { ["--brand", "--primary", "--mohemah-blue", "--ring"].forEach((v) => root.style.removeProperty(v)); };
  }, [color, logo, appName]);
}

/** Section of the current admin path (longest matching nav entry). */
function sectionOf(path: string): AdminSection | null {
  if (path.startsWith("/admin/provider-profile")) return "providers";
  const hit = nav.filter((n) => (n.exact ? path === n.to || path === `${n.to}/` : path.startsWith(n.to))).sort((a, b) => b.to.length - a.to.length)[0];
  return hit?.section ?? null;
}

function AdminGate({ children }: { children: ReactNode }) {
  const { user, loading, isAdmin, signOut, acceptSession } = useAuth();
  const { refreshAll } = useAdmin();
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    if (user) return;
    api<{ needs_admin: boolean }>("/api/setup/status", { app: "admin" }).then((r) => setNeedsSetup(r.needs_admin)).catch(() => setNeedsSetup(false));
  }, [user]);

  if (loading || (!user && needsSetup === null)) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">جاري التحميل…</div>;
  }

  const frame = (title: string, sub: string, body: ReactNode) => (
    <div className="min-h-screen flex items-center justify-center p-6 bg-mohemah-light/40" dir="rtl">
      <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-mohemah-coral to-mohemah-blue flex items-center justify-center text-primary-foreground font-bold text-2xl">م</div>
        <h2 className="text-lg font-bold mb-1 text-center">{title}</h2>
        <p className="text-sm text-muted-foreground mb-5 text-center">{sub}</p>
        {body}
      </div>
    </div>
  );

  if (!user && needsSetup) {
    return frame("إعداد حساب المالك", "أول تشغيل: أنشئ حساب المالك. اسم الدخول سيكون admin", <OwnerSetup onDone={(p) => { acceptSession(p); refreshAll(); }} />);
  }
  if (!user) {
    return frame("لوحة تحكم مهمة", "سجّل الدخول باسم المستخدم admin أو بريدك", <><LoginForm onDone={() => refreshAll()} /></>);
  }
  if (!isAdmin) {
    return frame("لا تملك صلاحية الدخول", "هذا الحساب ليس من حسابات الإدارة", <Button variant="secondary" className="w-full" onClick={() => signOut()}>تسجيل الخروج</Button>);
  }
  return <>{children}</>;
}

function OwnerSetup({ onDone }: { onDone: (p: MePayload) => void }) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (password.length < 8) return toast.error("كلمة المرور 8 أحرف على الأقل");
    if (password !== confirm) return toast.error("كلمتا المرور غير متطابقتين");
    setBusy(true);
    try {
      const p = await api<MePayload>("/api/setup/admin", { app: "admin", body: { full_name: name.trim() || "مالك التطبيق", password } });
      toast.success("تم إنشاء حساب المالك");
      onDone(p);
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <Field label="اسم الدخول"><input value="admin" readOnly dir="ltr" className={`${inputCls} bg-muted`} /></Field>
      <Field label="اسمك"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
      <Field label="كلمة المرور"><input type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} autoComplete="new-password" /></Field>
      <Field label="تأكيد كلمة المرور"><input type="password" dir="ltr" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} autoComplete="new-password" /></Field>
      <button type="submit" disabled={busy} className="w-full mohemah-btn-coral py-2.5 rounded-xl text-sm font-bold disabled:opacity-50">{busy ? "جارٍ…" : "إنشاء حساب المالك"}</button>
    </form>
  );
}

function AdminShell({ children }: { children?: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, profile, signOut, isOwner, can } = useAuth();
  // Every admin account sees the messages page (conversations belong to whoever answers first).
  const visibleNav = nav.filter((n) => n.section === "messages" || can(n.section, "view"));
  const section = sectionOf(path);
  const allowed = !section || section === "messages" || can(section, "view");
  const navigate = useNavigate();
  const displayName = profile?.full_name || profile?.username || user?.email || "المالك";
  const [menuOpen, setMenuOpen] = useState(false);
  const { settings } = useAdmin();
  useAdminBranding(settings.primaryColor, settings.logoUrl, settings.appName);
  const badges = useAdminBadges(path);
  const initials = (displayName || "م").trim().slice(0, 2).toUpperCase();

  return (
    <div dir="rtl" className="min-h-screen bg-background flex">
      <aside className="admin-sidebar w-56 shrink-0 bg-card border-l border-border sticky top-0 hidden md:flex flex-col">
        <div className="p-5 admin-brand-head">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 shrink-0 rounded-lg bg-white/95 grid place-items-center text-primary font-bold shadow">{settings.logoUrl ? <img src={fileUrl(settings.logoUrl)} alt="شعار الجهة" className="size-9 object-contain" /> : "م"}</div>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate text-white">لوحة تحكم {settings.appName}</p>
              <p className="text-[11px] text-white/75">Admin Panel</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 overflow-y-auto">
          <NavGroups items={visibleNav} path={path} counts={badges.counts} />
        </nav>
        <Button variant="unstyled" size="unstyled" onClick={async () => { await signOut(); navigate({ to: "/admin" }); }}
          className="m-3 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm bg-mohemah-light hover:bg-red-50 hover:text-red-600 transition">
          <LogOut className="w-4 h-4" /> تسجيل الخروج
        </Button>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        {menuOpen && <div className="fixed inset-0 z-50 bg-foreground/30 md:hidden" onClick={() => setMenuOpen(false)}>
          <aside className="w-64 max-w-[85vw] h-dvh bg-card p-4 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><p className="font-bold">إدارة مهمة</p><Button variant="ghost" size="icon" aria-label="إغلاق القائمة" onClick={() => setMenuOpen(false)}><X /></Button></div>
            <nav><NavGroups items={visibleNav} path={path} onPick={() => setMenuOpen(false)} large counts={badges.counts} /></nav>
            <Button variant="secondary" className="w-full mt-4" onClick={async () => { await signOut(); navigate({ to: "/admin" }); }}><LogOut />تسجيل الخروج</Button>
          </aside>
        </div>}
        <header className="bg-card border-b border-border px-4 sm:px-6 h-16 flex items-center justify-between sticky top-0 z-10">
          <Button variant="ghost" size="icon" className="md:hidden ml-2" aria-label="فتح قائمة الإدارة" onClick={() => setMenuOpen(true)}><Menu /></Button>
          <div className="flex-1 min-w-0 max-w-md relative ml-3">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input placeholder="بحث سريع..." className="w-full bg-mohemah-light rounded-xl pr-10 pl-3 py-2 text-sm outline-none focus:ring-2 focus:ring-mohemah-coral/40" />
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <BellMenu badges={badges} />
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-mohemah-blue text-primary-foreground flex items-center justify-center text-xs font-bold">{initials}</div>
              <div className="hidden sm:block text-right">
                <p className="max-w-40 truncate text-xs font-bold">{displayName}</p>
                <p className="text-[10px] text-muted-foreground">{isOwner ? "مالك" : "مشرف"}</p>
              </div>
            </div>
          </div>
        </header>
        <div className="admin-content p-4 sm:p-6 flex-1">{allowed && section && section !== "messages" && !can(section, "edit") && (
          <p className="mb-4 text-xs rounded-lg bg-amber-50 text-amber-800 border border-amber-200 px-3 py-2">صلاحيتك على هذه الصفحة: عرض فقط، ولن تُحفظ أي تعديلات.</p>
        )}{allowed ? (children ?? <Outlet />) : (
          <div className="max-w-md mx-auto mt-16 text-center bg-card border border-border rounded-2xl p-8">
            <Lock className="size-10 mx-auto mb-3 text-muted-foreground" />
            <h2 className="font-bold mb-1">لا تملك صلاحية هذه الصفحة</h2>
            <p className="text-sm text-muted-foreground mb-4">اطلب من المالك منحك صلاحية «عرض» أو «تعديل» لهذا القسم.</p>
            {visibleNav[0] && <Link to={visibleNav[0].to} className="text-sm text-mohemah-blue hover:underline">الذهاب إلى {visibleNav[0].label}</Link>}
          </div>
        )}</div>
      </main>
    </div>
  );
}

export function AdminLayout({ children }: { children?: ReactNode }) {
  return (
    <AdminProvider>
      <AdminGate>
        <AdminShell>{children}</AdminShell>
      </AdminGate>
    </AdminProvider>
  );
}
