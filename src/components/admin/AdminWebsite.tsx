import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowDown, ArrowUp, BarChart3, Check, ExternalLink, Eye, FileText, Image as ImageIcon, Inbox, LayoutTemplate, ListOrdered, Mail, MousePointerClick,
  Phone, Plus, Save, Search, Trash2, TrendingDown, TrendingUp, Upload, Users,
} from "lucide-react";
import { api, errMsg, fileUrl } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { uploadAdminImage } from "@/lib/adminStore";
import type { SiteContent, SiteStat } from "@/lib/site";

const adm = <T,>(path: string, opts: { method?: string; body?: unknown } = {}) => api<T>(path, { ...opts, app: "admin" });
const nf = (n: number) => new Intl.NumberFormat("en-US").format(n);

function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return <label className={`block text-sm ${className}`}><span className="text-xs text-muted-foreground">{label}</span><div className="mt-1">{children}</div>{hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}</label>;
}
function Card({ title, sub, children, action }: { title: string; sub?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="bg-card border border-border rounded-2xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-3"><div><h3 className="font-bold">{title}</h3>{sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}</div>{action}</div>
      {children}
    </section>
  );
}
function ImageInput({ value, onChange, hint }: { value: string; onChange: (v: string) => void; hint?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const pick = (f?: File) => { if (f) uploadAdminImage(f).then((u) => { onChange(u); toast.success("تم رفع الصورة"); }).catch((e) => toast.error(errMsg(e))); };
  return (
    <div className="flex items-center gap-2">
      <div className="h-14 w-24 rounded-lg bg-muted border border-border overflow-hidden grid place-items-center shrink-0">{value ? <img src={fileUrl(value)} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="size-5 text-muted-foreground" />}</div>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      <button type="button" onClick={() => ref.current?.click()} className="text-xs px-3 py-2 rounded-lg border border-border flex items-center gap-1"><Upload className="size-3.5" />{value ? "تغيير" : "رفع صورة"}</button>
      {value && <button type="button" onClick={() => onChange("")} className="text-xs px-2 py-2 rounded-lg text-red-600"><Trash2 className="size-3.5" /></button>}
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}
/** Generic editor for a list of items with add / remove / reorder. */
function ListEditor<T>({ items, onChange, blank, render, addLabel }: { items: T[]; onChange: (v: T[]) => void; blank: T; render: (item: T, set: (patch: Partial<T>) => void) => ReactNode; addLabel: string }) {
  const move = (i: number, d: number) => { const a = [...items]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; onChange(a); };
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex gap-2 items-start border border-border rounded-xl p-3 bg-background">
          <div className="flex-1 min-w-0">{render(it, (patch) => onChange(items.map((x, k) => (k === i ? { ...x, ...patch } : x))))}</div>
          <div className="flex flex-col gap-1">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-1 rounded border border-border disabled:opacity-30" aria-label="أعلى"><ArrowUp className="size-3.5" /></button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="p-1 rounded border border-border disabled:opacity-30" aria-label="أسفل"><ArrowDown className="size-3.5" /></button>
            <button type="button" onClick={() => onChange(items.filter((_, k) => k !== i))} className="p-1 rounded border border-border text-red-600" aria-label="حذف"><Trash2 className="size-3.5" /></button>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, blank])} className="text-xs px-3 py-2 rounded-lg border border-dashed border-border flex items-center gap-1"><Plus className="size-3.5" />{addLabel}</button>
    </div>
  );
}

const TABS = [
  { k: "analytics", label: "التحليلات", icon: BarChart3 },
  { k: "hero", label: "الواجهة والبنرات", icon: LayoutTemplate },
  { k: "numbers", label: "الأرقام", icon: ListOrdered },
  { k: "sections", label: "الأقسام والمحتوى", icon: FileText },
  { k: "pages", label: "الصفحات", icon: FileText },
  { k: "contact", label: "التواصل والظهور في البحث", icon: Search },
  { k: "inbox", label: "رسائل الزوار", icon: Inbox },
] as const;
type Tab = (typeof TABS)[number]["k"];

const SECTION_LABELS: Record<string, string> = { stats: "الأرقام", about: "من نحن", services: "الخدمات", how: "كيف تعمل", features: "المميزات", subscription: "الاشتراك والأسعار", testimonials: "آراء المستخدمين", faq: "الأسئلة الشائعة", download: "تحميل التطبيقين", contact: "تواصل معنا" };
const STAT_SOURCES: { v: SiteStat["source"]; label: string }[] = [
  { v: "providers", label: "تلقائي: عدد مقدمي الخدمة" }, { v: "customers", label: "تلقائي: عدد طالبي الخدمة" }, { v: "orders", label: "تلقائي: الطلبات المكتملة" },
  { v: "services", label: "تلقائي: المهام المتاحة" }, { v: "cities", label: "تلقائي: المدن" }, { v: "rating", label: "تلقائي: متوسط التقييم" }, { v: "manual", label: "رقم يدوي" },
];

export function AdminWebsitePage() {
  const { can } = useAuth();
  const canEdit = can("website", "edit");
  const [tab, setTab] = useState<Tab>("analytics");
  const [c, setC] = useState<SiteContent | null>(null);
  const [numbers, setNumbers] = useState<Record<string, number>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inboxCount, setInboxCount] = useState(0);

  useEffect(() => {
    adm<{ content: SiteContent; numbers: Record<string, number> }>("/api/admin/site").then((d) => { setC(d.content); setNumbers(d.numbers); }).catch((e) => toast.error(errMsg(e)));
    adm<{ new_count: number }>("/api/admin/site/messages").then((d) => setInboxCount(d.new_count)).catch(() => {});
  }, []);
  const set = <K extends keyof SiteContent>(k: K, v: SiteContent[K]) => { setC((x) => (x ? { ...x, [k]: v } : x)); setDirty(true); };
  const patch = <K extends keyof SiteContent>(k: K, p: Partial<SiteContent[K]>) => { setC((x) => (x ? { ...x, [k]: { ...(x[k] as object), ...p } } : x)); setDirty(true); };
  const save = async () => {
    if (!c) return;
    setSaving(true);
    try { await adm("/api/admin/site", { method: "PUT", body: { content: c } }); setDirty(false); toast.success("تم حفظ الموقع، التغييرات تظهر للزوار خلال دقيقة"); }
    catch (e) { toast.error(errMsg(e)); }
    setSaving(false);
  };
  const contentTab = tab === "hero" || tab === "numbers" || tab === "sections" || tab === "contact";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold">إدارة الموقع</h1><p className="text-xs text-muted-foreground">الموقع التعريفي للزوار: المحتوى، البنرات، الأرقام، الصفحات، الرسائل وتحليل الزيارات.</p></div>
        <div className="flex gap-2">
          <a href="/site" target="_blank" rel="noreferrer" className="text-sm px-4 py-2 rounded-xl border border-border flex items-center gap-2"><ExternalLink className="size-4" />فتح الموقع</a>
          {canEdit && contentTab && <button onClick={save} disabled={!dirty || saving} className="mohemah-btn-coral text-sm px-4 py-2 rounded-xl flex items-center gap-2 disabled:opacity-50"><Save className="size-4" />{saving ? "جارٍ الحفظ" : dirty ? "حفظ التغييرات" : "محفوظ"}</button>}
        </div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`shrink-0 px-3.5 py-2 rounded-xl text-sm font-bold border flex items-center gap-1.5 ${tab === t.k ? "bg-primary text-primary-foreground border-transparent" : "bg-card border-border"}`}>
            <t.icon className="size-4" />{t.label}{t.k === "inbox" && inboxCount > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] grid place-items-center">{inboxCount}</span>}
          </button>
        ))}
      </div>

      {tab === "analytics" && <Analytics />}
      {tab === "pages" && <Pages canEdit={canEdit} />}
      {tab === "inbox" && <SiteInbox canEdit={canEdit} onCount={setInboxCount} />}
      {contentTab && !c && <p className="text-sm text-muted-foreground p-6 text-center">جارٍ التحميل…</p>}

      {tab === "hero" && c && (
        <fieldset disabled={!canEdit} className="grid gap-4">
          <Card title="شريط الإعلان العلوي" sub="سطر واحد يظهر أعلى كل صفحات الموقع (عرض، تنبيه، خبر).">
            <div className="grid sm:grid-cols-[auto_1fr_1fr] gap-3 items-end">
              <label className="flex items-center gap-2 text-sm pb-2"><input type="checkbox" checked={c.announcement.active} onChange={(e) => patch("announcement", { active: e.target.checked })} />مفعّل</label>
              <Field label="النص"><input className="admin-input" value={c.announcement.text} onChange={(e) => patch("announcement", { text: e.target.value })} placeholder="خصم 50% على الاشتراك هذا الشهر" /></Field>
              <Field label="الرابط (اختياري)"><input dir="ltr" className="admin-input" value={c.announcement.link} onChange={(e) => patch("announcement", { link: e.target.value })} placeholder="#subscription أو https://…" /></Field>
            </div>
          </Card>
          <Card title="البنرات العلوية" sub="صور عريضة متحركة أعلى الصفحة الرئيسية. المقاس المناسب 1500×500 (نسبة 3:1). يمكن ترك الصورة فارغة ليظهر البنر بلون الهوية.">
            <ListEditor items={c.banners} onChange={(v) => set("banners", v)} addLabel="إضافة بنر" blank={{ title: "", subtitle: "", image_url: "", link: "", cta: "", active: true }}
              render={(b, s) => (
                <div className="grid sm:grid-cols-2 gap-2">
                  <div className="sm:col-span-2 flex flex-wrap items-center gap-3"><ImageInput value={b.image_url} onChange={(v) => s({ image_url: v })} /><label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={b.active !== false} onChange={(e) => s({ active: e.target.checked })} />ظاهر</label></div>
                  <input className="admin-input" placeholder="العنوان" value={b.title} onChange={(e) => s({ title: e.target.value })} />
                  <input className="admin-input" placeholder="وصف قصير" value={b.subtitle} onChange={(e) => s({ subtitle: e.target.value })} />
                  <input className="admin-input" placeholder="نص الزر (اختياري)" value={b.cta} onChange={(e) => s({ cta: e.target.value })} />
                  <input dir="ltr" className="admin-input" placeholder="الرابط: #download أو https://…" value={b.link} onChange={(e) => s({ link: e.target.value })} />
                </div>
              )} />
          </Card>
          <Card title="الواجهة الرئيسية" sub="أول ما يراه الزائر: عنوان واضح يقول ماذا تقدم ولمن.">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="الشارة الصغيرة"><input className="admin-input" value={c.hero.badge} onChange={(e) => patch("hero", { badge: e.target.value })} /></Field>
              <Field label="صورة الواجهة (4:3)"><ImageInput value={c.hero.image_url} onChange={(v) => patch("hero", { image_url: v })} /></Field>
              <Field label="العنوان الرئيسي" className="sm:col-span-2"><input className="admin-input" value={c.hero.title} onChange={(e) => patch("hero", { title: e.target.value })} /></Field>
              <Field label="الوصف" className="sm:col-span-2"><textarea className="admin-input min-h-20" value={c.hero.subtitle} onChange={(e) => patch("hero", { subtitle: e.target.value })} /></Field>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">أزرار التحميل تأخذ روابطها من «الإعدادات ← روابط التحميل».</p>
          </Card>
        </fieldset>
      )}

      {tab === "numbers" && c && (
        <fieldset disabled={!canEdit}>
          <Card title="أرقام الموقع" sub="تظهر تحت الواجهة مباشرة. اختر رقماً تلقائياً يتحدّث من بيانات التطبيق، أو اكتب رقماً يدوياً.">
            <ListEditor items={c.stats} onChange={(v) => set("stats", v)} addLabel="إضافة رقم" blank={{ label: "", source: "manual" as const, value: "" }}
              render={(st, s) => (
                <div className="grid sm:grid-cols-3 gap-2 items-center">
                  <input className="admin-input" placeholder="الوصف (مثال: مقدم خدمة موثّق)" value={st.label} onChange={(e) => s({ label: e.target.value })} />
                  <select className="admin-input" value={st.source} onChange={(e) => s({ source: e.target.value as SiteStat["source"] })}>{STAT_SOURCES.map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}</select>
                  {st.source === "manual"
                    ? <input className="admin-input" dir="ltr" placeholder="+500" value={st.value} onChange={(e) => s({ value: e.target.value })} />
                    : <span className="text-sm font-bold px-2" dir="ltr">{st.source === "rating" ? `${numbers.rating ?? 0} / 5` : `+${nf(numbers[st.source] ?? 0)}`}<span className="text-[11px] font-normal text-muted-foreground"> الآن</span></span>}
                </div>
              )} />
            <p className="text-[11px] text-muted-foreground mt-3">نصيحة: في البداية قد تكون الأرقام التلقائية صغيرة؛ أخفِ قسم الأرقام من «الأقسام والمحتوى» حتى تكبر، ولا تكتب أرقاماً غير حقيقية.</p>
          </Card>
        </fieldset>
      )}

      {tab === "sections" && c && (
        <fieldset disabled={!canEdit} className="grid gap-4">
          <Card title="ترتيب الأقسام وإظهارها" sub="رتّب أقسام الصفحة الرئيسية وأخفِ ما لا تحتاجه.">
            <div className="grid sm:grid-cols-2 gap-2">
              {c.sections.map((s, i) => (
                <div key={s.key} className="flex items-center gap-2 border border-border rounded-xl px-3 py-2 bg-background">
                  <span className="text-xs text-muted-foreground w-5">{i + 1}</span>
                  <span className="flex-1 text-sm font-bold">{SECTION_LABELS[s.key] ?? s.key}</span>
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={s.visible !== false} onChange={(e) => set("sections", c.sections.map((x, k) => (k === i ? { ...x, visible: e.target.checked } : x)))} />ظاهر</label>
                  <button type="button" disabled={i === 0} onClick={() => { const a = [...c.sections]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; set("sections", a); }} className="p-1 rounded border border-border disabled:opacity-30"><ArrowUp className="size-3.5" /></button>
                  <button type="button" disabled={i === c.sections.length - 1} onClick={() => { const a = [...c.sections]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; set("sections", a); }} className="p-1 rounded border border-border disabled:opacity-30"><ArrowDown className="size-3.5" /></button>
                </div>
              ))}
            </div>
          </Card>
          <Card title="من نحن (نبذة)">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="العنوان"><input className="admin-input" value={c.about.title} onChange={(e) => patch("about", { title: e.target.value })} /></Field>
              <Field label="الصورة (4:3)"><ImageInput value={c.about.image_url} onChange={(v) => patch("about", { image_url: v })} /></Field>
              <Field label="النبذة" className="sm:col-span-2"><textarea className="admin-input min-h-28" value={c.about.body} onChange={(e) => patch("about", { body: e.target.value })} /></Field>
              <Field label="نقاط مختصرة (كل سطر نقطة)" className="sm:col-span-2"><textarea className="admin-input min-h-24" value={c.about.points.join("\n")} onChange={(e) => patch("about", { points: e.target.value.split("\n") })} /></Field>
            </div>
          </Card>
          <Card title="قسم الخدمات" sub="التصنيفات تُعرض تلقائياً من صفحة «الخدمات» في لوحة التحكم.">
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="العنوان"><input className="admin-input" value={c.services.title} onChange={(e) => patch("services", { title: e.target.value })} /></Field>
              <Field label="الوصف"><input className="admin-input" value={c.services.subtitle} onChange={(e) => patch("services", { subtitle: e.target.value })} /></Field>
              <Field label="أقصى عدد تصنيفات"><input type="number" min={4} max={40} className="admin-input" value={c.services.limit} onChange={(e) => patch("services", { limit: Number(e.target.value) || 12 })} /></Field>
            </div>
          </Card>
          {(["how_customer", "how_provider"] as const).map((k) => (
            <Card key={k} title={k === "how_customer" ? "كيف تعمل — خطوات طالب الخدمة" : "كيف يشترك ويعمل — خطوات مقدم الخدمة"}>
              <Field label="اسم التبويب"><input className="admin-input mb-3" value={c[k].title} onChange={(e) => patch(k, { title: e.target.value })} /></Field>
              <ListEditor items={c[k].steps} onChange={(v) => patch(k, { steps: v })} addLabel="إضافة خطوة" blank={{ title: "", text: "" }}
                render={(st, s) => <div className="grid sm:grid-cols-[1fr_2fr] gap-2"><input className="admin-input" placeholder="عنوان الخطوة" value={st.title} onChange={(e) => s({ title: e.target.value })} /><input className="admin-input" placeholder="الشرح" value={st.text} onChange={(e) => s({ text: e.target.value })} /></div>} />
            </Card>
          ))}
          <Card title="المميزات (لماذا مهمة؟)">
            <ListEditor items={c.features} onChange={(v) => set("features", v)} addLabel="إضافة ميزة" blank={{ title: "", text: "" }}
              render={(st, s) => <div className="grid sm:grid-cols-[1fr_2fr] gap-2"><input className="admin-input" placeholder="الميزة" value={st.title} onChange={(e) => s({ title: e.target.value })} /><input className="admin-input" placeholder="الشرح" value={st.text} onChange={(e) => s({ text: e.target.value })} /></div>} />
          </Card>
          <Card title="الاشتراك والأسعار" sub="الأسعار نفسها تُقرأ تلقائياً من «الاشتراكات والتحصيل»، وهنا تعدّل النصوص فقط.">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={c.subscription.show} onChange={(e) => patch("subscription", { show: e.target.checked })} />إظهار الأسعار في الموقع</label>
              <Field label="العنوان"><input className="admin-input" value={c.subscription.title} onChange={(e) => patch("subscription", { title: e.target.value })} /></Field>
              <Field label="الوصف"><input className="admin-input" value={c.subscription.subtitle} onChange={(e) => patch("subscription", { subtitle: e.target.value })} /></Field>
              <Field label="ملاحظة أسفل الأسعار" className="sm:col-span-2"><input className="admin-input" value={c.subscription.note} onChange={(e) => patch("subscription", { note: e.target.value })} /></Field>
            </div>
          </Card>
          <Card title="الأسئلة الشائعة">
            <ListEditor items={c.faqs} onChange={(v) => set("faqs", v)} addLabel="إضافة سؤال" blank={{ q: "", a: "" }}
              render={(f, s) => <div className="grid gap-2"><input className="admin-input" placeholder="السؤال" value={f.q} onChange={(e) => s({ q: e.target.value })} /><textarea className="admin-input min-h-16" placeholder="الإجابة" value={f.a} onChange={(e) => s({ a: e.target.value })} /></div>} />
          </Card>
          <Card title="آراء المستخدمين" sub="أضف آراء حقيقية فقط من عملائك أو مقدمي الخدمة. القسم يختفي تلقائياً إذا كان فارغاً.">
            <ListEditor items={c.testimonials} onChange={(v) => set("testimonials", v)} addLabel="إضافة رأي" blank={{ name: "", role: "", text: "", rating: 5 }}
              render={(t, s) => (
                <div className="grid sm:grid-cols-3 gap-2">
                  <input className="admin-input" placeholder="الاسم" value={t.name} onChange={(e) => s({ name: e.target.value })} />
                  <input className="admin-input" placeholder="الصفة (عميل، سباك…)" value={t.role} onChange={(e) => s({ role: e.target.value })} />
                  <select className="admin-input" value={t.rating} onChange={(e) => s({ rating: Number(e.target.value) })}>{[5, 4, 3].map((n) => <option key={n} value={n}>{n} نجوم</option>)}</select>
                  <textarea className="admin-input sm:col-span-3 min-h-16" placeholder="نص الرأي" value={t.text} onChange={(e) => s({ text: e.target.value })} />
                </div>
              )} />
          </Card>
        </fieldset>
      )}

      {tab === "contact" && c && (
        <fieldset disabled={!canEdit} className="grid gap-4">
          <Card title="بيانات التواصل" sub="إن تُركت فارغة يُستخدم رقم وبريد الدعم من الإعدادات.">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Field label="الهاتف"><input dir="ltr" className="admin-input" value={c.contact.phone} onChange={(e) => patch("contact", { phone: e.target.value })} /></Field>
              <Field label="واتساب (يظهر زر عائم)"><input dir="ltr" className="admin-input" placeholder="05XXXXXXXX" value={c.contact.whatsapp} onChange={(e) => patch("contact", { whatsapp: e.target.value })} /></Field>
              <Field label="البريد"><input dir="ltr" className="admin-input" value={c.contact.email} onChange={(e) => patch("contact", { email: e.target.value })} /></Field>
              <Field label="العنوان"><input className="admin-input" value={c.contact.address} onChange={(e) => patch("contact", { address: e.target.value })} /></Field>
              <Field label="ساعات العمل"><input className="admin-input" value={c.contact.hours} onChange={(e) => patch("contact", { hours: e.target.value })} /></Field>
              <label className="flex items-center gap-2 text-sm pt-5"><input type="checkbox" checked={c.contact.show_form} onChange={(e) => patch("contact", { show_form: e.target.checked })} />إظهار نموذج «راسلنا»</label>
            </div>
          </Card>
          <Card title="حسابات التواصل الاجتماعي" sub="روابط كاملة تبدأ بـ https://">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(Object.keys(c.social) as (keyof SiteContent["social"])[]).map((k) => <Field key={k} label={k === "x" ? "X (تويتر)" : k}><input dir="ltr" className="admin-input" value={c.social[k]} onChange={(e) => patch("social", { [k]: e.target.value } as Partial<SiteContent["social"]>)} /></Field>)}
            </div>
          </Card>
          <Card title="الظهور في محركات البحث (SEO)" sub="عنوان ووصف الصفحة كما يظهران في Google وعند مشاركة الرابط.">
            <div className="grid gap-3">
              <Field label="عنوان الصفحة" hint={`${c.seo.title.length} حرف — الأفضل أقل من 60`}><input className="admin-input" value={c.seo.title} onChange={(e) => patch("seo", { title: e.target.value })} /></Field>
              <Field label="الوصف" hint={`${c.seo.description.length} حرف — الأفضل 120 إلى 160`}><textarea className="admin-input min-h-20" value={c.seo.description} onChange={(e) => patch("seo", { description: e.target.value })} /></Field>
              <Field label="كلمات مفتاحية (مفصولة بفاصلة)"><input className="admin-input" value={c.seo.keywords} onChange={(e) => patch("seo", { keywords: e.target.value })} /></Field>
            </div>
          </Card>
          <Card title="نطاق الموقع والتذييل">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="نطاق الموقع (اختياري)" hint="مثال: mohemah.sa — عند فتح هذا النطاق يظهر الموقع التعريفي مباشرة بدل تطبيق الويب."><input dir="ltr" className="admin-input" placeholder="mohemah.sa" value={c.domain} onChange={(e) => set("domain", e.target.value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""))} /></Field>
              <Field label="نص التذييل"><input className="admin-input" value={c.footer.text} onChange={(e) => patch("footer", { text: e.target.value })} /></Field>
            </div>
          </Card>
        </fieldset>
      )}
    </div>
  );
}

/* ---------- Analytics ---------- */
interface AnalyticsData {
  days: number;
  totals: Record<"views" | "prev_views" | "visitors" | "prev_visitors" | "new_visitors" | "returning" | "downloads" | "prev_downloads" | "conversion" | "prev_conversion" | "messages" | "signups_customers" | "signups_providers", number>;
  daily: { day: string; views: number; visitors: number; clicks: number }[];
  pages: { key: string; count: number }[]; sources: { key: string; count: number }[]; devices: { key: string; count: number }[]; countries: { key: string; count: number }[]; events: { key: string; count: number }[];
}
const EVENT_LABELS: Record<string, string> = {
  download_customer_ios: "تحميل تطبيق طالب الخدمة — آيفون", download_customer_android: "تحميل تطبيق طالب الخدمة — أندرويد", download_customer_other: "تحميل تطبيق طالب الخدمة — رابط آخر",
  download_provider_ios: "تحميل تطبيق مقدم الخدمة — آيفون", download_provider_android: "تحميل تطبيق مقدم الخدمة — أندرويد", download_provider_other: "تحميل تطبيق مقدم الخدمة — رابط آخر",
  nav_download: "زر «حمّل التطبيق» في القائمة", hero_provider: "«أنا مقدم خدمة» في الواجهة", whatsapp: "واتساب", call: "اتصال", email: "بريد", contact_form: "إرسال نموذج التواصل",
  banner_click: "ضغط على بنر", announcement: "ضغط على شريط الإعلان", faq_open: "فتح سؤال شائع", how_customer: "تبويب خطوات طالب الخدمة", how_provider: "تبويب خطوات مقدم الخدمة",
};

function Delta({ cur, prev, suffix = "" }: { cur: number; prev: number; suffix?: string }) {
  if (!prev) return <span className="text-[11px] text-muted-foreground">لا مقارنة بعد</span>;
  const d = Math.round(((cur - prev) / prev) * 100);
  const up = d >= 0;
  return <span className={`text-[11px] font-bold flex items-center gap-0.5 ${up ? "text-emerald-600" : "text-red-600"}`}>{up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}{Math.abs(d)}%{suffix} عن الفترة السابقة</span>;
}
function Bars({ title, rows, labels }: { title: string; rows: { key: string; count: number }[]; labels?: Record<string, string> }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const total = rows.reduce((a, r) => a + r.count, 0) || 1;
  return (
    <Card title={title}>
      {!rows.length && <p className="text-xs text-muted-foreground">لا توجد بيانات بعد.</p>}
      <div className="grid gap-2">
        {rows.map((r) => (
          <div key={r.key} className="text-xs">
            <div className="flex justify-between gap-2 mb-1"><span className="truncate" dir="auto">{labels?.[r.key] ?? r.key}</span><span className="font-bold shrink-0" dir="ltr">{nf(r.count)} · {Math.round((r.count / total) * 100)}%</span></div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${(r.count / max) * 100}%` }} /></div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Analytics() {
  const [days, setDays] = useState(30);
  const [d, setD] = useState<AnalyticsData | null>(null);
  useEffect(() => { setD(null); adm<AnalyticsData>(`/api/admin/site/analytics?days=${days}`).then(setD).catch((e) => toast.error(errMsg(e))); }, [days]);
  if (!d) return <p className="text-sm text-muted-foreground p-6 text-center">جارٍ التحميل…</p>;
  const t = d.totals;
  const tiles = [
    { label: "الزوار", value: nf(t.visitors), icon: Users, delta: <Delta cur={t.visitors} prev={t.prev_visitors} />, sub: `جديد ${nf(t.new_visitors)} · عائد ${nf(t.returning)}` },
    { label: "مشاهدات الصفحات", value: nf(t.views), icon: Eye, delta: <Delta cur={t.views} prev={t.prev_views} />, sub: t.visitors ? `${(t.views / t.visitors).toFixed(1)} صفحة لكل زائر` : "" },
    { label: "ضغطات التحميل", value: nf(t.downloads), icon: MousePointerClick, delta: <Delta cur={t.downloads} prev={t.prev_downloads} />, sub: "على أزرار المتاجر" },
    { label: "معدل التحويل", value: `${t.conversion}%`, icon: TrendingUp, delta: <Delta cur={t.conversion} prev={t.prev_conversion} />, sub: "زوار ضغطوا تحميل" },
  ];
  // Plain-language reading of the numbers.
  const insights: string[] = [];
  if (!t.visitors) insights.push("لا توجد زيارات مسجّلة بعد. انشر رابط الموقع في حساباتك وإعلاناتك وأضف ?utm_source=snapchat (مثلاً) لتعرف مصدر كل زيارة.");
  else {
    const topSource = d.sources[0];
    if (topSource) insights.push(`أكبر مصدر للزيارات: ${topSource.key} (${Math.round((topSource.count / t.visitors) * 100)}% من الزوار).`);
    const mobile = d.devices.find((x) => x.key === "جوال")?.count ?? 0;
    if (mobile / t.visitors >= 0.6) insights.push(`${Math.round((mobile / t.visitors) * 100)}% من الزوار على الجوال؛ راجع شكل الموقع والبنرات على الجوال أولاً.`);
    if (t.visitors >= 30 && t.conversion < 5) insights.push(`معدل التحويل ${t.conversion}% منخفض: جرّب عنواناً أوضح في الواجهة وبنراً يدعو للتحميل مباشرة.`);
    if (t.conversion >= 15) insights.push(`معدل التحويل ${t.conversion}% جيد؛ الأولوية الآن زيادة عدد الزوار.`);
    const prov = d.events.filter((e) => e.key.startsWith("download_provider")).reduce((a, e) => a + e.count, 0);
    const cust = d.events.filter((e) => e.key.startsWith("download_customer")).reduce((a, e) => a + e.count, 0);
    if (prov + cust > 0) insights.push(`ضغطات التحميل: طالب الخدمة ${nf(cust)} مقابل مقدم الخدمة ${nf(prov)}.`);
    if (t.downloads > 0) insights.push(`في نفس الفترة سجّل في التطبيق ${nf(t.signups_customers)} طالب خدمة و${nf(t.signups_providers)} مقدم خدمة (من كل المصادر، وليس الموقع فقط).`);
  }
  return (
    <div className="grid gap-4">
      <div className="flex gap-2 items-center">
        {[7, 30, 90].map((n) => <button key={n} onClick={() => setDays(n)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${days === n ? "bg-foreground text-background" : "bg-card border-border"}`}>آخر {n} يوم</button>)}
        <span className="text-[11px] text-muted-foreground mr-auto">تُحفظ أعداد فقط، بدون أي بيانات شخصية للزوار.</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((x) => (
          <div key={x.label} className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{x.label}</span><x.icon className="size-4" /></div>
            <div className="text-2xl font-extrabold mt-1" dir="ltr">{x.value}</div>
            {x.delta}
            {x.sub && <div className="text-[11px] text-muted-foreground mt-0.5">{x.sub}</div>}
          </div>
        ))}
      </div>
      <Card title="قراءة سريعة" sub="ملخص يساعدك على القرار">
        <ul className="grid gap-1.5 text-sm">{insights.map((x, i) => <li key={i} className="flex gap-2"><Check className="size-4 text-emerald-600 shrink-0 mt-1" />{x}</li>)}</ul>
      </Card>
      <Card title="الزوار والمشاهدات يومياً">
        <div className="h-64" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={d.daily.map((x) => ({ ...x, d: x.day.slice(5) }))} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="d" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip formatter={(v: number, n: string) => [nf(v), n === "views" ? "مشاهدات" : n === "visitors" ? "زوار" : "ضغطات تحميل"]} />
              <Area type="monotone" dataKey="views" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.12} strokeWidth={2} />
              <Area type="monotone" dataKey="visitors" stroke="#10b981" fill="#10b981" fillOpacity={0.12} strokeWidth={2} />
              <Area type="monotone" dataKey="clicks" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 justify-center text-[11px] mt-2"><span className="flex items-center gap-1"><i className="size-2.5 rounded-full bg-primary inline-block" />مشاهدات</span><span className="flex items-center gap-1"><i className="size-2.5 rounded-full bg-emerald-500 inline-block" />زوار</span><span className="flex items-center gap-1"><i className="size-2.5 rounded-full bg-amber-500 inline-block" />ضغطات تحميل</span></div>
      </Card>
      <div className="grid md:grid-cols-2 gap-4">
        <Bars title="مصادر الزيارات" rows={d.sources} />
        <Bars title="ضغطات الأزرار" rows={d.events} labels={EVENT_LABELS} />
        <Bars title="أكثر الصفحات مشاهدة" rows={d.pages} />
        <div className="grid gap-4"><Bars title="الأجهزة" rows={d.devices} /><Bars title="الدول" rows={d.countries} /></div>
      </div>
    </div>
  );
}

/* ---------- Extra pages ---------- */
interface PageRow { id: string; slug: string; title: string; body: string; show_in_nav: number; show_in_footer: number; published: number; sort_order: number }
function Pages({ canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState<PageRow[] | null>(null);
  const [edit, setEdit] = useState<Partial<PageRow> | null>(null);
  const load = () => adm<PageRow[]>("/api/admin/site/pages").then(setRows).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []);
  const save = async () => {
    if (!edit) return;
    try {
      const body = { title: edit.title, slug: edit.slug, body: edit.body ?? "", show_in_nav: !!edit.show_in_nav, show_in_footer: edit.show_in_footer !== 0, published: edit.published !== 0, sort_order: edit.sort_order ?? 0 };
      if (edit.id) await adm(`/api/admin/site/pages/${edit.id}`, { method: "PATCH", body }); else await adm("/api/admin/site/pages", { body });
      toast.success("تم حفظ الصفحة"); setEdit(null); load();
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Card title="صفحات الموقع" sub="صفحات إضافية مثل: من نحن بالتفصيل، الوظائف، الشراكات. السياسات المنشورة تظهر تلقائياً في تذييل الموقع."
      action={canEdit && <button onClick={() => setEdit({ published: 1, show_in_footer: 1, show_in_nav: 0 })} className="mohemah-btn-coral text-xs px-3 py-2 rounded-lg flex items-center gap-1"><Plus className="size-3.5" />صفحة جديدة</button>}>
      <div className="divide-y divide-border">
        {(rows ?? []).map((p) => (
          <div key={p.id} className="py-2.5 flex flex-wrap items-center gap-2 text-sm">
            <b className="flex-1 min-w-[160px]">{p.title}</b>
            <a href={`/site/${p.slug}`} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground" dir="ltr">/site/{p.slug}</a>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.published ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{p.published ? "منشورة" : "مسودة"}</span>
            {!!p.show_in_nav && <span className="text-[10px] px-2 py-0.5 rounded-full bg-mohemah-light">في القائمة</span>}
            {canEdit && <>
              <button onClick={() => setEdit(p)} className="text-xs px-2 py-1 rounded-lg border border-border">تعديل</button>
              <button onClick={async () => { if (!window.confirm(`حذف صفحة «${p.title}»؟`)) return; await adm(`/api/admin/site/pages/${p.id}`, { method: "DELETE" }).catch((e) => toast.error(errMsg(e))); load(); }} className="text-xs px-2 py-1 rounded-lg border border-border text-red-600">حذف</button>
            </>}
          </div>
        ))}
        {rows && !rows.length && <p className="text-xs text-muted-foreground py-4 text-center">لا توجد صفحات إضافية بعد.</p>}
      </div>
      {edit && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEdit(null)}>
          <div className="bg-card rounded-2xl p-5 w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold mb-3">{edit.id ? "تعديل الصفحة" : "صفحة جديدة"}</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="العنوان"><input className="admin-input" value={edit.title ?? ""} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
              <Field label="الرابط (إنجليزي)" hint="مثال: about-us"><input dir="ltr" className="admin-input" value={edit.slug ?? ""} onChange={(e) => setEdit({ ...edit, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} /></Field>
              <Field label="المحتوى" hint="كل سطر فقرة. ابدأ السطر بـ # لعنوان، ## لعنوان فرعي، - لنقطة." className="sm:col-span-2"><textarea className="admin-input min-h-56" value={edit.body ?? ""} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.published !== 0} onChange={(e) => setEdit({ ...edit, published: e.target.checked ? 1 : 0 })} />منشورة</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!edit.show_in_nav} onChange={(e) => setEdit({ ...edit, show_in_nav: e.target.checked ? 1 : 0 })} />تظهر في القائمة العلوية</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.show_in_footer !== 0} onChange={(e) => setEdit({ ...edit, show_in_footer: e.target.checked ? 1 : 0 })} />تظهر في التذييل</label>
              <Field label="الترتيب"><input type="number" className="admin-input" value={edit.sort_order ?? 0} onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) || 0 })} /></Field>
            </div>
            <div className="flex gap-2 mt-4"><button onClick={() => setEdit(null)} className="flex-1 py-2.5 rounded-xl bg-mohemah-light text-sm font-bold">إلغاء</button><button onClick={save} className="flex-1 py-2.5 rounded-xl mohemah-btn-coral text-sm font-bold">حفظ</button></div>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ---------- Visitor messages ---------- */
interface SiteMsg { id: string; name: string; phone: string | null; email: string | null; topic: string; message: string; status: string; created_at: string; handled_by_name: string | null }
const TOPICS: Record<string, string> = { general: "استفسار عام", customer: "طالب خدمة", provider: "مقدم خدمة", partnership: "شراكة / إعلان", complaint: "ملاحظة / شكوى" };
function SiteInbox({ canEdit, onCount }: { canEdit: boolean; onCount: (n: number) => void }) {
  const [status, setStatus] = useState<"new" | "done">("new");
  const [rows, setRows] = useState<SiteMsg[] | null>(null);
  const load = () => adm<{ rows: SiteMsg[]; new_count: number }>(`/api/admin/site/messages?status=${status}`).then((d) => { setRows(d.rows); onCount(d.new_count); }).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, [status]);
  return (
    <Card title="رسائل زوار الموقع" sub="تصل من نموذج «تواصل معنا». تواصل مع صاحبها بالجوال أو البريد ثم علّمها «تمت المتابعة».">
      <div className="flex gap-2 mb-3">{(["new", "done"] as const).map((k) => <button key={k} onClick={() => setStatus(k)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${status === k ? "bg-foreground text-background" : "bg-card border-border"}`}>{k === "new" ? "جديدة" : "تمت متابعتها"}</button>)}</div>
      <div className="grid gap-2">
        {(rows ?? []).map((m) => (
          <div key={m.id} className="border border-border rounded-xl p-3 text-sm bg-background">
            <div className="flex flex-wrap items-center gap-2">
              <b>{m.name}</b><span className="text-[10px] px-2 py-0.5 rounded-full bg-mohemah-light">{TOPICS[m.topic] ?? m.topic}</span>
              <span className="text-[11px] text-muted-foreground mr-auto" dir="ltr">{new Date(m.created_at).toLocaleString("ar-SA-u-ca-gregory-nu-latn", { dateStyle: "medium", timeStyle: "short" })}</span>
            </div>
            <p className="mt-2 whitespace-pre-line text-slate-700">{m.message}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
              {m.phone && <a href={`tel:${m.phone}`} className="px-2 py-1 rounded-lg border border-border flex items-center gap-1" dir="ltr"><Phone className="size-3.5" />{m.phone}</a>}
              {m.email && <a href={`mailto:${m.email}`} className="px-2 py-1 rounded-lg border border-border flex items-center gap-1" dir="ltr"><Mail className="size-3.5" />{m.email}</a>}
              {m.handled_by_name && <span className="text-muted-foreground">تابعها: {m.handled_by_name}</span>}
              {canEdit && m.status === "new" && <button onClick={async () => { await adm(`/api/admin/site/messages/${m.id}/done`, { body: {} }).catch((e) => toast.error(errMsg(e))); load(); }} className="mr-auto px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold">تمت المتابعة</button>}
              {canEdit && m.status === "done" && <button onClick={async () => { await adm(`/api/admin/site/messages/${m.id}`, { method: "DELETE" }).catch((e) => toast.error(errMsg(e))); load(); }} className="mr-auto px-2 py-1 rounded-lg text-red-600 border border-border">حذف</button>}
            </div>
          </div>
        ))}
        {rows && !rows.length && <p className="text-xs text-muted-foreground py-4 text-center">لا توجد رسائل هنا.</p>}
      </div>
    </Card>
  );
}
