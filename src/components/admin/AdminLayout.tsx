import { Button } from "@/components/ui/button";
import { ReactNode, useEffect, useState } from "react";
import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, UserCog, Wrench, Wallet, Shield, Settings, Bell, Menu, X, MessageSquare, Search, Megaphone, FileText, LogOut, ShieldCheck, CreditCard, Mail, Lock, BarChart3, BadgePercent } from "lucide-react";
import { AdminProvider, useAdmin } from "@/lib/adminStore";
import { useAuth, type AdminSection, type MePayload } from "@/lib/AuthContext";
import { api, errMsg, fileUrl } from "@/lib/api";
import { Field, inputCls, LoginForm } from "@/components/RegistrationForms";
import { toast } from "sonner";

const nav: { to: string; label: string; icon: typeof LayoutDashboard; section: AdminSection; exact?: boolean }[] = [
  { to: "/admin", label: "الرئيسية", icon: LayoutDashboard, section: "dashboard", exact: true },
  { to: "/admin/analytics", label: "تحليل الطلبات", icon: BarChart3, section: "analytics" },
  { to: "/admin/customers", label: "طالبو الخدمات", icon: Users, section: "customers" },
  { to: "/admin/providers", label: "مقدمو الخدمات", icon: UserCog, section: "providers" },
  { to: "/admin/services", label: "الخدمات", icon: Wrench, section: "services" },
  { to: "/admin/finance", label: "المالية", icon: Wallet, section: "finance" },
  { to: "/admin/billing", label: "الاشتراكات والتحصيل", icon: ShieldCheck, section: "billing" },
  { to: "/admin/promotions", label: "العروض والخصومات", icon: BadgePercent, section: "billing" },
  { to: "/admin/gateways", label: "بوابات الدفع", icon: CreditCard, section: "gateways" },
  { to: "/admin/notifications", label: "الإشعارات", icon: Bell, section: "notifications" },
  { to: "/admin/messages", label: "الرسائل", icon: MessageSquare, section: "messages" },
  { to: "/admin/integrations", label: "الرسائل والبريد وواتساب", icon: Mail, section: "integrations" },
  { to: "/admin/ads", label: "المساحات الإعلانية", icon: Megaphone, section: "ads" },
  { to: "/admin/policies", label: "السياسات والشروط", icon: FileText, section: "policies" },
  { to: "/admin/staff", label: "المستخدمون والصلاحيات", icon: Shield, section: "staff" },
  { to: "/admin/settings", label: "الإعدادات", icon: Settings, section: "settings" },
];

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
  const visibleNav = nav.filter((n) => can(n.section, "view"));
  const section = sectionOf(path);
  const allowed = !section || can(section, "view");
  const navigate = useNavigate();
  const displayName = profile?.full_name || profile?.username || user?.email || "المالك";
  const [menuOpen, setMenuOpen] = useState(false);
  const { settings } = useAdmin();
  const initials = (displayName || "م").trim().slice(0, 2).toUpperCase();

  return (
    <div dir="rtl" className="min-h-screen bg-background flex">
      <aside className="admin-sidebar w-56 shrink-0 bg-card border-l border-border sticky top-0 hidden md:flex flex-col">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 shrink-0 rounded-lg bg-accent grid place-items-center text-primary font-bold">{settings.logoUrl ? <img src={fileUrl(settings.logoUrl)} alt="شعار الجهة" className="size-9 object-contain" /> : "م"}</div>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">لوحة تحكم {settings.appName}</p>
              <p className="text-[11px] text-muted-foreground">Admin Panel</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleNav.map((n) => {
            const active = n.exact ? path === n.to : path.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link key={n.to} to={n.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition ${active ? "bg-accent text-primary font-bold" : "hover:bg-mohemah-light text-foreground"}`}>
                <Icon className="w-4 h-4" /><span>{n.label}</span>
              </Link>
            );
          })}
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
            <nav className="space-y-1">{visibleNav.map(n => { const Icon = n.icon; const active = n.exact ? path === n.to : path.startsWith(n.to); return <Link key={n.to} to={n.to} onClick={() => setMenuOpen(false)} className={`flex items-center gap-3 p-3 rounded-lg text-sm ${active ? "bg-accent text-primary font-bold" : "text-foreground"}`}><Icon className="size-4" />{n.label}</Link>; })}</nav>
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
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-mohemah-blue text-primary-foreground flex items-center justify-center text-xs font-bold">{initials}</div>
              <div className="hidden sm:block text-right">
                <p className="max-w-40 truncate text-xs font-bold">{displayName}</p>
                <p className="text-[10px] text-muted-foreground">{isOwner ? "مالك" : "مشرف"}</p>
              </div>
            </div>
          </div>
        </header>
        <div className="admin-content p-4 sm:p-6 flex-1">{allowed && section && !can(section, "edit") && (
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
