import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronRight, Star, FileText, Printer, Phone, Mail, MessageCircle, Shield, CalendarClock, Coins, ChevronLeft } from "lucide-react";
import { useProviderStats, type ProviderStats } from "./ProviderContext";
import { useAuth } from "@/lib/AuthContext";
import { findPolicy, usePublicData } from "@/lib/publicData";
import { api, fileUrl } from "@/lib/api";
import { fmtDate } from "@/lib/liveData";
import { ProfileEditor, PasswordChange, DeleteAccount } from "./AccountSettings";
import logo from "@/assets/mohemah-logo-new.png";

const SECTIONS: Record<string, { title: string; desc: string }> = {
  profile: { title: "الملف الشخصي", desc: "بياناتك الشخصية وإعدادات الحساب" },
  payments: { title: "مراجعة المدفوعات", desc: "سجل الكوينز والإحصائيات" },
  ratings: { title: "التقييمات", desc: "تقييمات العملاء" },
  packages: { title: "الباقات والاشتراك", desc: "طريقة دفع رسوم الطلبات" },
  help: { title: "مركز المساعدة", desc: "الأسئلة الشائعة والدعم" },
  about: { title: "عن التطبيق", desc: "معلومات عن تطبيق مهمة" },
  privacy: { title: "السياسات والخصوصية", desc: "شروط الاستخدام وسياسة الخصوصية" },
  "experience-letter": { title: "خطاب خبرة من تطبيق مهمة", desc: "إصدار وطباعة خطاب رسمي" },
};

export function ProviderAccountSectionPage() {
  const { section } = useParams({ from: "/provider/account/$section" });
  const meta = SECTIONS[section] || { title: section, desc: "" };
  const stats = useProviderStats();

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mohemah-header-gradient text-primary-foreground px-4 pt-8 pb-6 print:hidden">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link to="/provider/account" className="p-2 -mr-2 rounded-full active:bg-white/20" aria-label="رجوع"><ChevronRight className="w-5 h-5" /></Link>
          <h1 className="text-lg font-bold">{meta.title}</h1>
          <div className="w-9" />
        </div>
        <p className="text-center text-xs opacity-80 mt-1">{meta.desc}</p>
      </div>

      <div className="max-w-lg mx-auto px-4 mt-4">
        {section === "payments" && <PaymentsSection stats={stats} />}
        {section === "profile" && <div className="space-y-3"><div className="mohemah-card p-4"><ProfileEditor /></div><div className="mohemah-card p-4"><PasswordChange /></div><div className="mohemah-card p-4"><DeleteAccount /></div></div>}
        {section === "ratings" && <RatingsSection />}
        {section === "packages" && <PackagesSection />}
        {section === "help" && <HelpSection />}
        {section === "about" && <AboutSection />}
        {section === "privacy" && <PrivacySection />}
        {section === "experience-letter" && <ExperienceLetterSection stats={stats} />}
      </div>
    </div>
  );
}

function tenure(joined: string | undefined) {
  if (!joined) return { years: 0, months: 0 };
  const j = new Date(joined), now = new Date();
  let years = now.getFullYear() - j.getFullYear();
  let months = now.getMonth() - j.getMonth();
  if (months < 0) { years -= 1; months += 12; }
  return { years: Math.max(0, years), months: Math.max(0, months) };
}

type Tx = { id: string; amount: number; tx_type: string; balance_after: number; description: string | null; method: string | null; created_at: string };
const TX_LABEL: Record<string, string> = { topup: "شحن", deduction: "خصم", refund: "استرجاع", bonus: "هدية" };

function PaymentsSection({ stats }: { stats: ProviderStats | null }) {
  const [txs, setTxs] = useState<Tx[] | null>(null);
  useEffect(() => { api<Tx[]>("/api/provider/transactions").then(setTxs).catch(() => setTxs([])); }, []);
  const t = tenure(stats?.joined_at);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="طلبات مكتملة" value={String(stats?.completed ?? 0)} color="text-mohemah-coral" />
        <Stat label="التقييم" value={stats?.rating_count ? stats.rating.toFixed(1) : "—"} color="text-mohemah-blue" />
        <Stat label="مدة العمل" value={`${t.years}س ${t.months}ش`} color="text-mohemah-gold" />
      </div>
      <div className="mohemah-card p-4">
        <h3 className="text-sm font-bold text-right mb-2">الخدمات المقدمة</h3>
        {!stats?.services_breakdown.length ? <p className="text-xs text-muted-foreground">لا توجد طلبات مكتملة بعد</p> : (
          <div className="space-y-1">
            {stats.services_breakdown.map((s) => (
              <div key={s.name} className="flex justify-between text-xs bg-mohemah-light rounded-lg px-3 py-2"><span>{s.name}</span><span className="font-bold text-mohemah-coral">{s.count}</span></div>
            ))}
          </div>
        )}
      </div>
      <div className="mohemah-card p-4">
        <h3 className="text-sm font-bold text-right mb-2">حركة الكوينز</h3>
        {txs === null ? <p className="text-xs text-muted-foreground">جارٍ التحميل…</p> : !txs.length ? <p className="text-xs text-muted-foreground">لا توجد حركات بعد</p> : (
          <div className="space-y-1">
            {txs.map((p) => {
              const plus = p.tx_type !== "deduction";
              return (
                <div key={p.id} className="flex items-center justify-between gap-2 text-xs bg-mohemah-light rounded-lg px-3 py-2.5">
                  <div className="min-w-0 text-right">
                    <p className="font-bold truncate">{p.description ?? TX_LABEL[p.tx_type]}</p>
                    <p className="text-[10px] text-muted-foreground">{fmtDate(p.created_at)}{p.method ? ` · ${p.method}` : ""} · الرصيد {p.balance_after}</p>
                  </div>
                  <span className={`font-bold shrink-0 tabular-nums ${plus ? "text-success" : "text-destructive"}`} dir="ltr">{plus ? "+" : "−"}{p.amount}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Link to="/provider/account/$section" params={{ section: "experience-letter" }} className="w-full mohemah-btn-coral py-3 flex items-center justify-center gap-2 text-sm font-bold rounded-2xl">
        <FileText className="w-4 h-4" />إصدار خطاب خبرة من تطبيق مهمة
      </Link>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-mohemah-light rounded-xl p-3 text-center">
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

type RatingRow = { id: string; rating: number; review: string | null; created_at: string };

function Stars({ value, size = "w-3.5 h-3.5" }: { value: number; size?: string }) {
  return (
    <div className="flex" aria-label={`${value} من 5`}>
      {[1, 2, 3, 4, 5].map((s) => <Star key={s} className={`${size} ${s <= Math.round(value) ? "text-mohemah-gold fill-mohemah-gold" : "text-muted-foreground/30"}`} />)}
    </div>
  );
}

/** Customer ratings are anonymous: no voter names are shown. */
function RatingsSection() {
  const [rows, setRows] = useState<RatingRow[] | null>(null);
  useEffect(() => { api<RatingRow[]>("/api/provider/ratings").then(setRows).catch(() => setRows([])); }, []);
  if (rows === null) return <p className="text-xs text-muted-foreground text-center py-6">جارٍ تحميل التقييمات…</p>;
  if (rows.length === 0) return <div className="mohemah-card p-6 text-center text-sm text-muted-foreground">لا توجد تقييمات بعد</div>;
  const avg = rows.reduce((s, r) => s + r.rating, 0) / rows.length;
  const counts = [5, 4, 3, 2, 1].map((n) => ({ n, c: rows.filter((r) => r.rating === n).length }));
  const withNotes = rows.filter((r) => r.rating > 2 && r.review?.trim());
  const low = rows.filter((r) => r.rating <= 2);
  return (
    <div className="space-y-3">
      <div className="mohemah-card p-4 flex items-center gap-4">
        <div className="text-center shrink-0">
          <p className="text-3xl font-bold">{avg.toFixed(1)}</p>
          <Stars value={avg} />
          <p className="text-[11px] text-muted-foreground mt-1">{rows.length} تقييم</p>
        </div>
        <div className="flex-1 space-y-1" dir="ltr">
          {counts.map(({ n, c }) => (
            <div key={n} className="flex items-center gap-2 text-[11px]">
              <span className="w-3">{n}</span>
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden"><div className={`h-full ${n <= 2 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${(c / rows.length) * 100}%` }} /></div>
              <span className="w-6 text-muted-foreground text-right">{c}</span>
            </div>
          ))}
        </div>
      </div>
      {low.length > 0 && (
        <div className="mohemah-card p-4 text-right border border-destructive/40">
          <p className="text-sm font-bold text-destructive mb-2">أسباب التقييمات المنخفضة ({low.length})</p>
          <div className="space-y-2">
            {low.map((r) => (
              <div key={r.id} className="rounded-xl bg-destructive/5 p-3">
                <div className="flex items-center justify-between"><Stars value={r.rating} /><span className="text-[10px] text-muted-foreground">{fmtDate(r.created_at)}</span></div>
                <p className="text-xs mt-1.5">{r.review?.trim() || "لم يذكر العميل سببًا للتقييم"}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="text-sm font-bold text-right pt-1">ملاحظات العملاء</p>
      {withNotes.length === 0 ? <p className="text-xs text-muted-foreground text-right">لا توجد ملاحظات مكتوبة</p> : withNotes.map((r) => (
        <div key={r.id} className="mohemah-card p-4 text-right">
          <div className="flex items-center justify-between"><Stars value={r.rating} /><span className="text-[10px] text-muted-foreground">{fmtDate(r.created_at)}</span></div>
          <p className="text-xs text-muted-foreground mt-2">{r.review}</p>
        </div>
      ))}
    </div>
  );
}

function PackagesSection() {
  const { settings } = usePublicData();
  const { profile, subscriptionEnd } = useAuth();
  const plans = settings ? [["شهري", settings.sub_price_1m], ["3 أشهر", settings.sub_price_3m], ["6 أشهر", settings.sub_price_6m], ["سنوي", settings.sub_price_12m]] as const : [];
  return (
    <div className="space-y-3">
      <div className="mohemah-card p-4 space-y-1 text-sm">
        <p className="font-bold">طريقتك الحالية: {profile?.billing_mode === "subscription" ? "اشتراك مفتوح" : "كوينز لكل طلب"}</p>
        <p className="text-xs text-muted-foreground">{subscriptionEnd ? `اشتراكك فعّال حتى ${fmtDate(subscriptionEnd)}` : `رصيدك ${profile?.coin_balance ?? 0} كوين`}</p>
      </div>
      {settings?.billing_subscription_enabled && (
        <div className="grid grid-cols-2 gap-2">
          {plans.map(([label, price]) => (
            <div key={label} className="mohemah-card p-3 text-right">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><CalendarClock className="size-3.5" />{label}</p>
              <p className="text-lg font-bold mt-1">{price} <span className="text-xs text-muted-foreground">ر.س</span></p>
            </div>
          ))}
        </div>
      )}
      <Link to="/provider/billing" className="mohemah-card p-4 flex items-center justify-between text-sm font-bold"><span className="flex items-center gap-2"><Coins className="size-4 text-primary" />إدارة طريقة الدفع والاشتراك</span><ChevronLeft className="size-4 text-muted-foreground" /></Link>
    </div>
  );
}

function HelpSection() {
  const { settings } = usePublicData();
  const faqs = [
    { q: "كيف أستلم طلباً؟", a: "فعّل الاتصال من الدائرة في الصفحة الرئيسية، وستظهر لك الطلبات الجديدة في الخدمات التي اخترتها." },
    { q: "كم تكلفة قبول الطلب؟", a: "يظهر عدد الكوينز على كل طلب قبل قبوله ويختلف حسب الخدمة. مع الاشتراك الفعّال تُقبل الطلبات بلا خصم." },
    { q: "ماذا لو ألغى العميل بعد قبولي؟", a: "تُعاد الكوينز المخصومة إلى رصيدك تلقائياً." },
    { q: "كيف أعبئ رصيدي؟", a: "من صفحة الحساب ← الكوينز، أو من زر الشحن عند قبول طلب." },
  ];
  return (
    <div className="space-y-2">
      {faqs.map((f) => (
        <div key={f.q} className="mohemah-card p-4 text-right">
          <p className="text-sm font-bold text-mohemah-coral">{f.q}</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.a}</p>
        </div>
      ))}
      <div className="mohemah-card p-4 space-y-2 text-sm">
        <p className="font-bold flex items-center gap-2"><MessageCircle className="w-4 h-4 text-mohemah-blue" />تواصل مع الدعم</p>
        {settings?.support_phone && <p className="flex items-center gap-2 text-xs"><Phone className="size-3.5" /><a href={`tel:${settings.support_phone}`} dir="ltr" className="select-all">{settings.support_phone}</a></p>}
        {settings?.support_email && <p className="flex items-center gap-2 text-xs"><Mail className="size-3.5" /><a href={`mailto:${settings.support_email}`} dir="ltr" className="select-all">{settings.support_email}</a></p>}
        <Link to="/provider/services" className="block text-xs font-bold text-primary">أو راسل الإدارة من «خدماتي والرسائل»</Link>
      </div>
    </div>
  );
}

function AboutSection() {
  const { settings } = usePublicData();
  return (
    <div className="mohemah-card p-6 text-center">
      <img src={settings?.logo_url ? fileUrl(settings.logo_url) : logo} alt={settings?.app_name ?? "مهمة"} className="w-24 h-24 mx-auto object-contain" />
      <h2 className="text-lg font-bold mt-3 text-mohemah-coral">تطبيق {settings?.app_name ?? "مهمة"}</h2>
      <p className="text-xs text-muted-foreground mt-1">الإصدار 1.0.0</p>
      <p className="text-sm text-foreground mt-4 leading-relaxed">منصة سعودية تربط طالبي الخدمات بمقدميها بأسلوب احترافي وموثوق، تركز على الجودة والشفافية.</p>
    </div>
  );
}

const DEFAULT_PRIVACY = [
  { title: "جمع البيانات", body: "نجمع البيانات اللازمة فقط لتقديم الخدمة، مثل بيانات الحساب والهوية والطلبات." },
  { title: "حماية البيانات", body: "تُحفظ مستنداتك في تخزين خاص لا يطّلع عليه إلا فريق المراجعة، ولا تُشارك مع جهات خارجية إلا بموافقتك أو بحكم النظام." },
  { title: "الاستخدام المسموح", body: "يجب الالتزام بالأنظمة والآداب العامة، ويحق للتطبيق إيقاف الحساب المخالف." },
  { title: "حقوق المستخدم", body: "يمكنك تعديل بياناتك أو حذف حسابك نهائياً من الملف الشخصي في أي وقت." },
];

function PrivacySection() {
  const { policies } = usePublicData();
  const list = policies.filter((p) => p.audience !== "customers");
  return (
    <div className="space-y-2">
      <div className="mohemah-card p-4 flex items-center gap-3">
        <Shield className="w-6 h-6 text-mohemah-blue" />
        <div className="text-right"><p className="text-sm font-bold">سياسة الخصوصية وشروط الاستخدام</p><p className="text-[11px] text-muted-foreground">{list[0] ? `آخر تحديث: ${fmtDate(list[0].updated_at)}` : "النسخة الافتراضية"}</p></div>
      </div>
      {(list.length ? list.map((p) => ({ title: p.title, body: p.body })) : DEFAULT_PRIVACY).map((it) => (
        <div key={it.title} className="mohemah-card p-4 text-right">
          <p className="text-sm font-bold text-mohemah-coral">{it.title}</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed whitespace-pre-line">{it.body}</p>
        </div>
      ))}
    </div>
  );
}

function ExperienceLetterSection({ stats }: { stats: ProviderStats | null }) {
  const { profile } = useAuth();
  const { settings } = usePublicData();
  const appName = settings?.app_name ?? "مهمة";
  const name = profile?.full_name ?? "—";
  const services = stats?.services_breakdown.map((s) => s.name) ?? [];
  const t = tenure(stats?.joined_at);
  const today = new Date().toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "long", year: "numeric" });
  const ref = `MHM-${(profile?.id ?? "").slice(0, 8).toUpperCase()}`;
  const enough = (stats?.completed ?? 0) > 0;

  return (
    <div className="space-y-3">
      {!enough && <p className="mohemah-card p-3 text-xs text-muted-foreground print:hidden">يُصدر الخطاب بعد إكمال طلب واحد على الأقل عبر التطبيق.</p>}
      <div className="bg-white text-foreground rounded-2xl shadow p-6 text-right print:shadow-none print:p-12">
        <div className="flex items-center justify-between border-b-4 border-mohemah-coral pb-4">
          <div className="text-left text-xs text-muted-foreground"><p>التاريخ: {today}</p><p className="mt-1">المرجع: {ref}</p></div>
          <div className="flex items-center gap-3">
            <div className="text-right"><p className="text-lg font-bold text-mohemah-coral">تطبيق {appName}</p><p className="text-[11px] text-muted-foreground">منصة الخدمات الموثوقة</p></div>
            <img src={settings?.logo_url ? fileUrl(settings.logo_url) : logo} alt={appName} className="w-16 h-16 object-contain" />
          </div>
        </div>
        <h1 className="text-center text-xl font-bold mt-6 mb-6 text-mohemah-blue">خطاب إثبات خبرة</h1>
        <div className="space-y-4 leading-loose text-sm">
          <p>السلام عليكم ورحمة الله وبركاته،،</p>
          <p>
            تشهد إدارة <span className="font-bold text-mohemah-coral">تطبيق {appName}</span> بأن {profile?.gender === "female" ? "السيدة" : "السيد"}/ <span className="font-bold">{name}</span> قد عمل عبر التطبيق
            كمقدم خدمة، وأنجز عدد <span className="font-bold text-mohemah-coral">({stats?.completed ?? 0})</span> طلب خدمة
            {stats?.rating_count ? <>، بتقييم متوسط بلغ <span className="font-bold text-mohemah-coral">({stats.rating.toFixed(1)} من 5)</span></> : null}
            {services.length ? "، في مجالات الأعمال التالية:" : "."}
          </p>
          {services.length > 0 && <ul className="pr-6 list-disc space-y-1">{services.map((s) => <li key={s}>{s}</li>)}</ul>}
          <p>وقد امتدت فترة عمله مع التطبيق لمدة<span className="font-bold text-mohemah-coral"> ({t.years}) سنة و({t.months}) شهر </span>(بالتقويم الميلادي).</p>
          <p>وقد مُنح هذا الخطاب بناءً على طلبه ليُستخدم لما يراه مناسباً.</p>
          <p className="pt-6">والله ولي التوفيق،،</p>
        </div>
        <div className="mt-12 flex justify-end">
          <div className="text-center"><div className="w-32 border-b-2 border-foreground/40 pb-1"><p className="text-xs">ختم وتوقيع</p></div><p className="text-xs mt-2 font-bold">إدارة تطبيق {appName}</p></div>
        </div>
      </div>
      <div className="mohemah-card p-4 print:hidden">
        <button onClick={() => window.print()} disabled={!enough} className="w-full mohemah-btn-coral py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"><Printer className="w-4 h-4" />طباعة الخطاب</button>
        <p className="text-[10px] text-muted-foreground text-center mt-2">خدمة مقدمة من تطبيق {appName} لمقدمي الخدمات لتوثيق سابقة الأعمال.</p>
      </div>
    </div>
  );
}
