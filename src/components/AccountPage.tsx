import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { Star, ChevronLeft, LogOut, User, MapPin, Heart, Globe, Shield, FileText, Bell, Gift, Headphones, Plus, ChevronDown, ChevronUp, Copy, Check, X, Phone, ExternalLink, Share2, Info, KeyRound, LocateFixed, Trash2, Mail } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ProfileEditor, PasswordChange, DeleteAccount } from "@/components/AccountSettings";
import { EnableOrderAlerts } from "@/components/OrderAlerts";
import { AdminInbox } from "@/components/ProviderServicesSetup";
import { useAuth } from "@/lib/AuthContext";
import { findPolicy, usePublicData } from "@/lib/publicData";
import { useAddresses, notifyAddressesChanged } from "@/lib/customerData";
import { useMyOrders } from "@/lib/liveData";
import { api, errMsg } from "@/lib/api";

const DEFAULT_TERMS = [
  ["1. القبول بالشروط", "باستخدامك لتطبيق مهمة، فإنك توافق على الالتزام بهذه الشروط والأحكام."],
  ["2. وصف الخدمة", "تطبيق مهمة وسيط بين طالب الخدمة ومقدم الخدمة، ولا يتحمل المسؤولية عن جودة الخدمات المقدمة من مقدمي الخدمات المستقلين."],
  ["3. حسابات المستخدمين", "يجب أن تكون المعلومات المقدمة عند التسجيل صحيحة. أنت مسؤول عن الحفاظ على سرية بيانات حسابك."],
  ["4. سياسة الإلغاء", "يمكن إلغاء الطلب قبل وصول مقدم الخدمة."],
  ["5. التعديلات", "نحتفظ بحق تعديل هذه الشروط، وسيتم إشعارك بأي تغييرات جوهرية."],
];
const DEFAULT_PRIVACY = [
  ["1. جمع البيانات", "نجمع الاسم ورقم الجوال والبريد والعنوان والموقع عند طلب الخدمة لتنفيذ طلباتك."],
  ["2. استخدام البيانات", "تُستخدم بياناتك لمعالجة الطلبات والتواصل معك. لا نبيع بياناتك لأي طرف."],
  ["3. مشاركة البيانات", "يظهر عنوانك ورقم جوالك لمقدم الخدمة بعد قبوله طلبك فقط."],
  ["4. حقوقك", "يمكنك تعديل بياناتك أو حذف حسابك نهائياً من صفحة الحساب في أي وقت."],
];

export function AccountPage() {
  const { user, profile, signOut, loading } = useAuth();
  const { settings } = usePublicData();
  const { orders } = useMyOrders();
  const navigate = useNavigate();
  const hash = useRouterState({ select: (s) => s.location.hash });
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [modal, setModal] = useState<null | "invite" | "join" | "help" | "about" | "terms" | "privacy">(null);
  useEffect(() => { if (hash === "addresses") setActiveSection("addresses"); }, [hash]);

  if (!loading && !user) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <AppHeader />
        <div className="max-w-lg mx-auto px-4 mt-6 space-y-3">
          <div className="mohemah-card p-6 text-center text-sm space-y-3">
            <p>سجّل دخولك لإدارة حسابك وعناوينك وطلباتك</p>
            <Link to="/auth" className="mohemah-btn-primary inline-block px-6 py-2">تسجيل الدخول / حساب جديد</Link>
          </div>
          <LinksCard onOpen={setModal} />
        </div>
        <AccountModals modal={modal} close={() => setModal(null)} />
      </div>
    );
  }

  const completed = (orders ?? []).filter((o) => o.status === "completed").length;
  const activeCount = (orders ?? []).filter((o) => !["completed", "cancelled"].includes(o.status)).length;
  const toggle = (s: string) => setActiveSection((p) => (p === s ? null : s));
  const logout = async () => { await signOut(); toast.success("تم تسجيل الخروج"); navigate({ to: "/" }); };

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader />
      <div className="max-w-lg mx-auto px-4 mt-6">
        <div className="mohemah-card p-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-mohemah-blue to-mohemah-coral flex items-center justify-center shrink-0 shadow-lg"><User className="w-7 h-7 text-primary-foreground" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold truncate">{profile?.full_name}</p>
              <p className="text-xs text-muted-foreground truncate" dir="ltr">{profile?.email}</p>
              <p className="text-xs text-muted-foreground" dir="ltr">{profile?.phone?.replace(/^\+966/, "0")}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <Stat value={String(completed)} label="مهمة مكتملة" tone="text-mohemah-blue" />
            <Stat value={String(activeCount)} label="مهمة جارية" tone="text-mohemah-coral" />
            <Stat value={profile?.customer_rating ? profile.customer_rating.toFixed(1) : "—"} label="تقييمك" tone="text-mohemah-gold" />
          </div>
        </div>

        <Section id="personal" title="البيانات الشخصية" icon={User} open={activeSection === "personal"} onToggle={toggle}><div className="pt-3"><ProfileEditor /></div></Section>
        <Section id="addresses" title="العناوين" icon={MapPin} open={activeSection === "addresses"} onToggle={toggle}><Addresses /></Section>
        <Section id="notifications" title="الإشعارات" icon={Bell} open={activeSection === "notifications"} onToggle={toggle}>
          <div className="space-y-2 pt-3 text-xs text-muted-foreground">
            <p>تصلك إشعارات حالة طلباتك داخل التطبيق تلقائياً (القبول، الوصول، الإنجاز).</p>
            <EnableOrderAlerts />
            <p>إشعارات الجوال الفورية تصل مع نسخة التطبيق على المتاجر.</p>
          </div>
        </Section>
        <Section id="messages" title="الرسائل مع الإدارة" icon={Mail} open={activeSection === "messages"} onToggle={toggle}><div className="pt-3"><AdminInbox /></div></Section>
        <Section id="security" title="الأمان والحساب" icon={KeyRound} open={activeSection === "security"} onToggle={toggle}>
          <div className="pt-3 space-y-4"><PasswordChange /><DeleteAccount /></div>
        </Section>

        <LinksCard onOpen={setModal} />

        <div className="mt-3 mohemah-card px-5 py-4 flex items-center justify-between">
          <span className="text-xs px-2 py-0.5 rounded-full bg-mohemah-blue/10 text-mohemah-blue font-semibold">العربية</span>
          <span className="flex items-center gap-3 text-sm font-semibold">لغة التطبيق<Globe className="w-4.5 h-4.5 text-mohemah-blue" /></span>
        </div>

        <div className="mt-3 mohemah-card overflow-hidden">
          {([["about", "نبذة عن التطبيق", FileText], ["terms", "شروط الاستخدام", Shield], ["privacy", "سياسة الخصوصية", Shield]] as const).map(([k, label, Icon], i) => (
            <button key={k} onClick={() => setModal(k)} className={`w-full flex items-center justify-between px-5 py-4 text-right hover:bg-mohemah-light transition-colors ${i < 2 ? "border-b border-border" : ""}`}>
              <span className="flex items-center gap-3 font-semibold text-sm"><Icon className="w-4.5 h-4.5 text-muted-foreground" />{label}</span>
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4 mb-2">الإصدار 1.0.0 · {settings?.app_name ?? "مهمة"}</p>
        <button onClick={logout} className="w-full mohemah-btn-coral py-3.5 mt-1 flex items-center justify-center gap-2 text-base mb-4"><LogOut className="w-5 h-5" />تسجيل خروج</button>
      </div>
      <AccountModals modal={modal} close={() => setModal(null)} />
    </div>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone: string }) {
  return <div className="bg-mohemah-light rounded-xl p-2.5 text-center"><p className={`text-lg font-bold ${tone}`}>{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>;
}

function Section({ id, title, icon: Icon, open, onToggle, children }: { id: string; title: string; icon: React.ComponentType<{ className?: string }>; open: boolean; onToggle: (id: string) => void; children: ReactNode }) {
  return (
    <div className="mt-3 mohemah-card overflow-hidden" id={id}>
      <button onClick={() => onToggle(id)} aria-expanded={open} className="w-full flex items-center justify-between px-5 py-4 text-right hover:bg-mohemah-light transition-colors">
        <span className="flex items-center gap-3"><Icon className="w-4.5 h-4.5 text-mohemah-blue" /><span className="font-semibold text-sm">{title}</span></span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-5 pb-4 animate-in fade-in slide-in-from-top-1 duration-200 border-t border-border">{children}</div>}
    </div>
  );
}

function Addresses() {
  const { addresses } = useAddresses();
  const { regions } = usePublicData();
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ label: "", address: "", region: "", lat: null as number | null, lng: null as number | null });
  const [busy, setBusy] = useState(false);
  const locate = () => {
    if (!("geolocation" in navigator)) return toast.error("المتصفح لا يدعم تحديد الموقع");
    navigator.geolocation.getCurrentPosition(
      (p) => { setF((x) => ({ ...x, lat: Number(p.coords.latitude.toFixed(6)), lng: Number(p.coords.longitude.toFixed(6)) })); toast.success("تم تحديد موقعك"); },
      () => toast.error("تعذّر تحديد الموقع، اسمح بالوصول للموقع"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  const save = async () => {
    if (!f.label.trim() || f.address.trim().length < 3 || !f.region) return toast.error("أكمل اسم العنوان والمدينة والتفاصيل");
    setBusy(true);
    try { await api("/api/me/addresses", { body: f }); toast.success("تم حفظ العنوان"); setAdding(false); setF({ label: "", address: "", region: "", lat: null, lng: null }); notifyAddressesChanged(); }
    catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };
  const remove = async (id: string) => { try { await api(`/api/me/addresses/${id}`, { method: "DELETE" }); notifyAddressesChanged(); } catch (e) { toast.error(errMsg(e)); } };
  const makeDefault = async (id: string) => { try { await api(`/api/me/addresses/${id}/default`, { method: "POST" }); notifyAddressesChanged(); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <div className="space-y-2 mt-3">
      {addresses.map((a) => (
        <div key={a.id} className="flex items-center gap-3 p-3 bg-mohemah-light rounded-xl">
          <MapPin className="w-4 h-4 text-mohemah-coral shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2"><p className="text-sm font-bold">{a.label}</p>{a.is_default ? <span className="text-xs px-2 py-0.5 rounded-full bg-mohemah-blue/10 text-mohemah-blue font-semibold">افتراضي</span> : <button onClick={() => makeDefault(a.id)} className="text-[11px] text-primary font-semibold">جعله افتراضياً</button>}</div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{[a.region, a.address].filter(Boolean).join(" - ")}{a.lat ? " · 📍" : ""}</p>
          </div>
          <button onClick={() => remove(a.id)} aria-label={`حذف ${a.label}`} className="p-1.5 text-destructive"><Trash2 className="size-4" /></button>
        </div>
      ))}
      {adding ? (
        <div className="rounded-xl border border-border p-3 space-y-2">
          <input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} maxLength={60} placeholder="اسم العنوان: المنزل، العمل…" className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm" />
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <select value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm"><option value="">المدينة</option>{regions.map((r) => <option key={r}>{r}</option>)}</select>
            <button type="button" onClick={locate} className={`flex items-center gap-1 rounded-xl px-3 text-xs font-bold ${f.lat ? "bg-success/10 text-success" : "bg-accent text-primary"}`}><LocateFixed className="size-4" />{f.lat ? "تم التحديد" : "موقعي"}</button>
          </div>
          <input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} maxLength={300} placeholder="الحي - الشارع - رقم المنزل" className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <button disabled={busy} onClick={save} className="mohemah-btn-primary py-2.5 text-sm disabled:opacity-50">حفظ العنوان</button>
            <button onClick={() => setAdding(false)} className="rounded-xl bg-muted py-2.5 text-sm">إلغاء</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-mohemah-blue/30 text-mohemah-blue text-sm font-semibold hover:bg-mohemah-blue/5 transition-colors">
          <Plus className="w-4 h-4" />إضافة عنوان جديد
        </button>
      )}
    </div>
  );
}

function LinksCard({ onOpen }: { onOpen: (m: "invite" | "join" | "help") => void }) {
  const rows = [
    { to: "about" as const, title: "عن مهمة وطريقة العمل", sub: "شرح مصوّر لطالب الخدمة ومقدم الخدمة", icon: Info },
    { m: "invite" as const, title: "دعوة صديق", sub: "شارك رمز الإحالة الخاص بك", icon: Gift },
    { m: "join" as const, title: "انضم إلى مقدمي الخدمات", sub: "سجّل من تطبيق مقدم الخدمة", icon: Heart },
    { m: "help" as const, title: "مركز المساعدة", sub: "تواصل مع فريق الدعم", icon: Headphones },
  ];
  return (
    <div className="mt-3 mohemah-card overflow-hidden">
      {rows.map((r, i) => {
        const inner = (
          <>
            <span className="flex items-center gap-3 min-w-0"><r.icon className="w-4.5 h-4.5 text-mohemah-blue shrink-0" /><span className="text-right min-w-0"><span className="block font-semibold text-sm">{r.title}</span><span className="block text-xs text-muted-foreground">{r.sub}</span></span></span>
            <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
          </>
        );
        const cls = `w-full flex items-center justify-between px-5 py-4 text-right hover:bg-mohemah-light transition-colors ${i < rows.length - 1 ? "border-b border-border" : ""}`;
        return "to" in r && r.to ? <Link key={r.title} to="/about" className={cls}>{inner}</Link> : <button key={r.title} onClick={() => onOpen(r.m!)} className={cls}>{inner}</button>;
      })}
    </div>
  );
}

function Sheet({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 bg-foreground/40 z-[60] flex items-end sm:items-center justify-center" onClick={close}>
      <div className="bg-card rounded-t-3xl sm:rounded-2xl p-6 max-w-lg w-full mx-0 sm:mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <button onClick={close} aria-label="إغلاق"><X className="w-5 h-5 text-muted-foreground" /></button>
          <h2 className="text-lg font-bold">{title}</h2>
          <div className="w-5" />
        </div>
        {children}
      </div>
    </div>
  );
}

function AccountModals({ modal, close }: { modal: string | null; close: () => void }) {
  const { profile } = useAuth();
  const { settings, policies } = usePublicData();
  const [copied, setCopied] = useState(false);
  if (!modal) return null;
  const code = profile?.referral_code ?? "";
  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => toast.error("انسخ الرمز يدوياً"));
  };
  const policyBlock = (type: string, fallback: string[][]) => {
    const p = findPolicy(policies, type, "customers");
    return p ? <div className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{p.body}</div>
      : <div className="text-right space-y-4 text-sm leading-relaxed text-muted-foreground">{fallback.map(([h, b]) => <div key={h}><h4 className="font-bold text-foreground mb-1">{h}</h4><p>{b}</p></div>)}</div>;
  };

  if (modal === "invite") return (
    <Sheet title="دعوة صديق" close={close}>
      {!code ? <p className="text-sm text-muted-foreground text-center">سجّل دخولك للحصول على رمز الإحالة</p> : (
        <>
          <p className="text-sm text-muted-foreground leading-relaxed text-center mb-5">شارك رمز الإحالة الخاص بك مع أصدقائك لتجربة تطبيق {settings?.app_name ?? "مهمة"}</p>
          <div className="bg-mohemah-light rounded-xl p-4 flex items-center justify-between mb-4">
            <button onClick={copy} className="flex items-center gap-1 text-mohemah-blue text-sm font-semibold">{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copied ? "تم النسخ" : "نسخ"}</button>
            <div className="text-right"><p className="text-xs text-muted-foreground mb-0.5">رمز الإحالة</p><p className="text-xl font-bold tracking-widest text-mohemah-blue select-all" dir="ltr">{code}</p></div>
          </div>
          <button onClick={() => { const text = `جرب تطبيق ${settings?.app_name ?? "مهمة"} للخدمات! رمز الإحالة: ${code}`; if (navigator.share) navigator.share({ title: "تطبيق مهمة", text }).catch(() => {}); else copy(); }}
            className="w-full mohemah-btn-primary py-3 text-sm flex items-center justify-center gap-2"><Share2 className="w-4 h-4" />مشاركة</button>
        </>
      )}
    </Sheet>
  );
  if (modal === "join") return (
    <Sheet title="انضم كمقدم خدمة" close={close}>
      <p className="text-sm text-muted-foreground leading-relaxed text-center mb-5">هل لديك مهارة أو خبرة؟ سجّل في تطبيق مقدمي الخدمات، أرفق هويتك وشهادتك، وابدأ استقبال الطلبات بعد موافقة الإدارة.</p>
      <Link to="/provider/auth" onClick={close} className="w-full mohemah-btn-coral py-3 text-sm font-bold flex items-center justify-center gap-2"><ExternalLink className="size-4" />فتح تطبيق مقدم الخدمة</Link>
    </Sheet>
  );
  if (modal === "help") return (
    <Sheet title="مركز المساعدة" close={close}>
      <div className="space-y-3">
        {settings?.support_phone && <a href={`tel:${settings.support_phone}`} className="flex items-center gap-3 p-4 bg-mohemah-light rounded-xl"><Phone className="w-5 h-5 text-mohemah-blue shrink-0" /><span className="flex-1"><span className="block text-sm font-bold">اتصل بنا</span><span className="block text-xs text-muted-foreground select-all" dir="ltr">{settings.support_phone}</span></span></a>}
        {settings?.support_email && <a href={`mailto:${settings.support_email}`} className="flex items-center gap-3 p-4 bg-mohemah-light rounded-xl"><Mail className="w-5 h-5 text-mohemah-blue shrink-0" /><span className="flex-1"><span className="block text-sm font-bold">البريد الإلكتروني</span><span className="block text-xs text-muted-foreground select-all" dir="ltr">{settings.support_email}</span></span></a>}
        <p className="text-xs text-muted-foreground text-center">أو راسل الإدارة من «الرسائل مع الإدارة» في حسابك.</p>
      </div>
    </Sheet>
  );
  if (modal === "about") return (
    <Sheet title="نبذة عن التطبيق" close={close}>
      <div className="text-center mb-4"><h3 className="text-xl font-bold text-mohemah-blue">{settings?.app_name ?? "مهمة"}</h3><p className="text-xs text-muted-foreground">الإصدار 1.0.0</p></div>
      <div className="text-right space-y-3 text-sm leading-relaxed text-muted-foreground">
        <p>تطبيق <strong className="text-foreground">مهمة</strong> منصة رقمية تربط الأفراد الباحثين عن خدمات يومية بمقدمي الخدمات المحترفين، بطريقة سريعة وسهلة تعتمد على الموقع والاحتياج الفعلي.</p>
        <p>تختار نوع الخدمة وتحدد إن كانت حضورية أو عن بُعد، ثم يصل طلبك لمقدمي الخدمة في مدينتك، وتتابع التنفيذ حتى اكتماله.</p>
      </div>
    </Sheet>
  );
  if (modal === "terms") return <Sheet title="شروط الاستخدام" close={close}>{policyBlock("شروط استخدام", DEFAULT_TERMS)}</Sheet>;
  if (modal === "privacy") return <Sheet title="سياسة الخصوصية" close={close}>{policyBlock("خصوصية", DEFAULT_PRIVACY)}</Sheet>;
  return null;
}
