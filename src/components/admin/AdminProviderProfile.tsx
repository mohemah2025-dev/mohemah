import { useEffect, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Ban, BellRing, CheckCircle2, Clock, FileText, RotateCcw, Star, Trash2, XCircle } from "lucide-react";
import { api, errMsg, fileUrl } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { ServiceIcon } from "@/components/ServiceAppearance";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AccountActionDialog, type AccountAction } from "./AccountActionDialog";

const adm = <T,>(path: string, opts: { method?: string; body?: unknown } = {}) => api<T>(path, { ...opts, app: "admin" });

interface Profile {
  user: { id: string; full_name: string | null; phone: string | null; email: string | null; region: string | null; gender: string | null; nationality: string | null; avatar_url: string | null;
    rating: number; rating_count: number; coin_balance: number; is_active: number; is_online: number; suspend_reason: string | null; created_at: string; reviewed_at: string | null; last_seen_at: string | null };
  days: number;
  services: { id: string; name: string; icon: string | null; color: string | null; enabled: boolean }[];
  requests: { id: string; service_id: string; service_name: string; status: string; note: string | null; admin_note: string | null; doc_url: string | null; created_at: string }[];
  performance: { offered: number; accepted: number; rejected: number; ignored: number; released: number; completed: number; customer_cancelled: number; warnings: number; accept_rate: number | null; flag_ignored: boolean; flag_cancelled: boolean };
  reasons: { kind: string; reason: string | null; created_at: string; order_no: number; service_name: string; sub_service_name: string | null; customer_name: string | null }[];
  ratings: { order_no: number; rating: number; review: string | null; service_name: string; customer_name: string | null; completed_at: string | null }[];
  customers: { customer_id: string; name: string | null; phone: string | null; orders: number; completed: number; cancelled: number; reasons: string | null }[];
  actions: { id: string; action: string; reason: string; letter_url: string | null; created_at: string }[];
  shifts: {
    today_hours: number; month: { hours: number; days: number }; year: { hours: number; days: number }; total: { hours: number; days: number };
    daily: { day: string; hours: number }[]; monthly: { month: string; hours: number; days: number }[]; yearly: { year: string; hours: number; days: number }[];
    recent: { started_at: string; ended_at: string | null; hours: number }[];
  };
  charts?: {
    monthly: { month: string; offered: number; accepted: number; completed: number; rejected: number; cancelled: number }[];
    ratings: { rating: number; n: number }[];
    services: { name: string; n: number }[];
  };
}

const axis = { tick: { fill: "var(--muted-foreground)", fontSize: 10 }, axisLine: false, tickLine: false } as const;

function Charts({ p }: { p: Profile }) {
  const c = p.charts;
  if (!c) return null;
  const daily = [...p.shifts.daily].reverse();
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <section className="bg-card border border-border rounded-2xl p-4 lg:col-span-2">
        <h2 className="font-bold text-sm mb-2">الطلبات شهرياً (آخر 12 شهراً)</h2>
        <div className="h-64" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={c.monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
              <XAxis dataKey="month" {...axis} tickFormatter={(v) => String(v).slice(5)} />
              <YAxis width={26} allowDecimals={false} {...axis} />
              <Tooltip />
              <Legend formatter={(v) => ({ offered: "وصله", accepted: "قبل", completed: "أنجز", rejected: "رفض", cancelled: "ألغى" } as Record<string, string>)[v] ?? v} />
              <Bar dataKey="offered" fill="#94a3b8" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="accepted" fill="#3b82f6" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="completed" fill="#16a34a" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="rejected" fill="#f59e0b" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="cancelled" fill="#dc2626" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="bg-card border border-border rounded-2xl p-4">
        <h2 className="font-bold text-sm mb-2">ساعات الدوام اليومية</h2>
        <div className="h-52" dir="ltr">
          {daily.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
                <XAxis dataKey="day" {...axis} tickFormatter={(v) => String(v).slice(5)} minTickGap={20} />
                <YAxis width={26} {...axis} />
                <Tooltip formatter={(v) => [`${v} ساعة`, "الدوام"]} />
                <Line type="monotone" dataKey="hours" stroke="var(--primary)" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-muted-foreground">لا يوجد دوام مسجل بعد.</p>}
        </div>
      </section>
      <section className="bg-card border border-border rounded-2xl p-4">
        <h2 className="font-bold text-sm mb-2">توزيع التقييمات</h2>
        <div className="h-52" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={c.ratings} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 4" />
              <XAxis type="number" allowDecimals={false} {...axis} />
              <YAxis type="category" dataKey="rating" width={36} {...axis} tickFormatter={(v) => `${v}★`} />
              <Tooltip formatter={(v) => [`${v} تقييم`, ""]} />
              <Bar dataKey="n" fill="#f59e0b" radius={[0, 3, 3, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      {c.services.length > 0 && (
        <section className="bg-card border border-border rounded-2xl p-4 lg:col-span-2">
          <h2 className="font-bold text-sm mb-2">الطلبات المنجزة حسب الخدمة</h2>
          <div className="h-52" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={c.services} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                <XAxis type="number" allowDecimals={false} {...axis} />
                <YAxis type="category" dataKey="name" width={110} {...axis} />
                <Tooltip formatter={(v) => [`${v} طلب`, ""]} />
                <Bar dataKey="n" fill="#16a34a" radius={[0, 3, 3, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  );
}

const dt = (v: string | null) => (v ? new Date(v).toLocaleString("ar-SA-u-ca-gregory-nu-latn", { dateStyle: "medium", timeStyle: "short" }) : "—");
const TABS = [
  { k: "overview", label: "الأداء" }, { k: "services", label: "الخدمات" }, { k: "shifts", label: "الدوام" },
  { k: "ratings", label: "التقييمات" }, { k: "customers", label: "العملاء" }, { k: "actions", label: "الإجراءات" },
] as const;

function Box({ label, value, tone, hint }: { label: string; value: string | number; tone?: "green" | "yellow" | "red"; hint?: string }) {
  const cls = tone === "green" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : tone === "yellow" ? "border-amber-300 bg-amber-50 text-amber-900" : tone === "red" ? "border-red-300 bg-red-50 text-red-800" : "border-border bg-card";
  return <div className={`border rounded-2xl p-3 ${cls}`} title={hint}><p className="text-[11px] opacity-80">{label}</p><p className="text-2xl font-bold">{value}</p></div>;
}

export function AdminProviderProfilePage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const { can } = useAuth();
  const canEdit = can("providers", "edit");
  const [days, setDays] = useState(30);
  const [p, setP] = useState<Profile | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["k"]>("overview");
  const [action, setAction] = useState<AccountAction | null>(null);

  const load = () => adm<Profile>(`/api/admin/providers/${id}/profile?days=${days}`).then(setP).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, [id, days]);

  if (!p) return <p className="text-sm text-muted-foreground">جاري التحميل…</p>;
  const u = p.user;
  const perf = p.performance;

  const remind = async (kind: "ignored" | "cancelled") => {
    try { await adm(`/api/admin/providers/${id}/remind`, { body: { kind } }); toast.success("تم إرسال التذكير لمقدم الخدمة"); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  const review = async (rid: string, approve: boolean) => {
    const note = approve ? null : window.prompt("سبب عدم القبول؟") ?? "";
    if (!approve && !note?.trim()) return;
    try { await adm(`/api/admin/service-requests/${rid}/review`, { body: { approve, note } }); toast.success(approve ? "تمت إضافة الخدمة لمقدم الخدمة" : "تم رفض الطلب"); load(); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="space-y-5" dir="rtl">
      <Link to="/admin/providers" className="text-xs text-mohemah-blue flex items-center gap-1"><ArrowRight className="w-3.5 h-3.5" />مقدمو الخدمات</Link>

      {/* Header */}
      <div className="bg-card border border-border rounded-2xl p-4 flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-3">
          {u.avatar_url ? <img src={fileUrl(u.avatar_url)} alt="" className="w-16 h-16 rounded-full object-cover" /> : <div className="w-16 h-16 rounded-full bg-mohemah-light grid place-items-center text-xl font-bold">{(u.full_name ?? "؟").slice(0, 1)}</div>}
          <div>
            <h1 className="text-xl font-bold">{u.full_name}</h1>
            <p className="text-xs text-muted-foreground" dir="ltr" style={{ textAlign: "right" }}>{u.phone} · {u.email}</p>
            <p className="text-xs text-muted-foreground">{u.region ?? "—"} · {u.nationality ?? ""} · انضم {dt(u.reviewed_at ?? u.created_at)}</p>
            <div className="flex flex-wrap gap-1.5 mt-1 text-[11px]">
              <span className={`px-2 py-0.5 rounded-full ${u.is_active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{u.is_active ? "نشط" : "معلّق"}</span>
              <span className={`px-2 py-0.5 rounded-full ${u.is_online ? "bg-sky-100 text-sky-700" : "bg-muted text-muted-foreground"}`}>{u.is_online ? "متصل الآن" : "غير متصل"}</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 flex items-center gap-1"><Star className="w-3 h-3" />{Number(u.rating).toFixed(1)} ({u.rating_count})</span>
              <span className="px-2 py-0.5 rounded-full bg-muted">الرصيد {u.coin_balance}</span>
            </div>
            {!u.is_active && u.suspend_reason && <p className="text-xs text-red-700 mt-1">سبب التعليق: {u.suspend_reason}</p>}
          </div>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {u.is_active
              ? <button onClick={() => setAction("suspend")} className="px-3 py-2 rounded-xl bg-amber-100 text-amber-900 text-xs font-bold flex items-center gap-1"><Ban className="w-3.5 h-3.5" />تعليق الحساب</button>
              : <button onClick={() => setAction("reactivate")} className="px-3 py-2 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1"><RotateCcw className="w-3.5 h-3.5" />إعادة التفعيل</button>}
            <button onClick={() => setAction("delete")} className="px-3 py-2 rounded-xl bg-red-100 text-red-700 text-xs font-bold flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" />حذف الحساب</button>
          </div>
        )}
      </div>

      {/* Alerts */}
      {(perf.flag_ignored || perf.flag_cancelled) && (
        <div className="grid md:grid-cols-2 gap-3">
          {perf.flag_ignored && (
            <div className="border-2 border-amber-300 bg-amber-50 text-amber-900 rounded-2xl p-3 flex items-center justify-between gap-2">
              <span className="text-sm flex items-center gap-2"><AlertTriangle className="w-5 h-5" />وصله {perf.ignored} طلبات ولم يقبلها أو يرفضها</span>
              {canEdit && <button onClick={() => remind("ignored")} className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-bold flex items-center gap-1"><BellRing className="w-3.5 h-3.5" />إرسال تذكير</button>}
            </div>
          )}
          {perf.flag_cancelled && (
            <div className="border-2 border-red-300 bg-red-50 text-red-800 rounded-2xl p-3 flex items-center justify-between gap-2">
              <span className="text-sm flex items-center gap-2"><XCircle className="w-5 h-5" />ألغى {perf.released} طلبات بعد قبولها</span>
              {canEdit && <button onClick={() => remind("cancelled")} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold flex items-center gap-1"><BellRing className="w-3.5 h-3.5" />إرسال تذكير</button>}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1 bg-mohemah-light rounded-xl p-1">
          {TABS.map((t) => <button key={t.k} onClick={() => setTab(t.k)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${tab === t.k ? "bg-card shadow text-primary" : "text-muted-foreground"}`}>{t.label}{t.k === "services" && p.requests.some((r) => r.status === "pending") ? " •" : ""}</button>)}
        </div>
        {tab === "overview" && (
          <select className="admin-input w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[7, 30, 90, 365, 3650].map((d) => <option key={d} value={d}>{d === 3650 ? "كل الفترة" : `آخر ${d} يوماً`}</option>)}
          </select>
        )}
      </div>

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Box label="وصله" value={perf.offered} />
            <Box label="قبل" value={perf.accepted} tone="green" />
            <Box label="رفض" value={perf.rejected} tone={perf.rejected >= 5 ? "yellow" : undefined} />
            <Box label="وصله ولم يرد" value={perf.ignored} tone={perf.flag_ignored ? "yellow" : undefined} />
            <Box label="ألغى بعد القبول" value={perf.released} tone={perf.flag_cancelled ? "red" : undefined} />
            <Box label="أنجز" value={perf.completed} tone="green" />
            <Box label="نسبة القبول" value={perf.accept_rate === null ? "—" : `${perf.accept_rate}%`} />
            <Box label="تنبيهات أُرسلت" value={perf.warnings} />
          </div>
          <Charts p={p} />
          <section className="bg-card border border-border rounded-2xl p-4">
            <h2 className="font-bold text-sm mb-2">سجل الرفض والإلغاء مع الأسباب</h2>
            <ul className="divide-y divide-border text-xs">
              {p.reasons.map((r, i) => (
                <li key={i} className="py-2 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span className={`px-2 rounded-full ${r.kind === "release" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{r.kind === "release" ? "إلغاء بعد القبول" : "رفض"}</span>
                  <b>#{r.order_no}</b><span>{r.sub_service_name ?? r.service_name}</span><span className="text-muted-foreground">{r.customer_name ?? ""}</span>
                  <span className="text-muted-foreground">{dt(r.created_at)}</span>
                  {r.kind === "release" && <span className="w-full text-muted-foreground">السبب: {r.reason || "—"}</span>}
                </li>
              ))}
              {!p.reasons.length && <li className="py-2 text-muted-foreground">لا يوجد.</li>}
            </ul>
          </section>
        </div>
      )}

      {tab === "services" && (
        <div className="space-y-4">
          <section className="bg-card border border-border rounded-2xl p-4">
            <h2 className="font-bold text-sm mb-3">الخدمات المعتمدة</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {p.services.map((s) => (
                <div key={s.id} className="border border-border rounded-xl p-2.5 flex items-center gap-2">
                  <ServiceIcon icon={s.icon} color={s.color} className="size-9" />
                  <div><p className="text-xs font-bold">{s.name}</p><p className={`text-[10px] ${s.enabled ? "text-emerald-600" : "text-muted-foreground"}`}>{s.enabled ? "مفعّلة" : "موقوفة من مقدم الخدمة"}</p></div>
                </div>
              ))}
              {!p.services.length && <p className="text-xs text-muted-foreground">لا توجد خدمات معتمدة.</p>}
            </div>
          </section>
          <section className="bg-card border border-border rounded-2xl p-4">
            <h2 className="font-bold text-sm mb-3">طلبات إضافة خدمة</h2>
            <ul className="space-y-2">
              {p.requests.map((r) => (
                <li key={r.id} className={`border rounded-xl p-3 text-xs ${r.status === "pending" ? "border-sky-300 bg-sky-50" : "border-border"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-sm">{r.service_name}</span>
                    <span className={`px-2 py-0.5 rounded-full ${r.status === "approved" ? "bg-emerald-100 text-emerald-700" : r.status === "rejected" ? "bg-red-100 text-red-700" : "bg-sky-100 text-sky-800"}`}>{r.status === "approved" ? "معتمدة" : r.status === "rejected" ? "مرفوضة" : "بانتظار المراجعة"}</span>
                  </div>
                  <p className="text-muted-foreground mt-1">{dt(r.created_at)}{r.note ? ` · ملاحظته: ${r.note}` : ""}{r.admin_note ? ` · رد الإدارة: ${r.admin_note}` : ""}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {r.doc_url && <a href={fileUrl(r.doc_url)} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg border border-border flex items-center gap-1"><FileText className="w-3.5 h-3.5" />عرض الشهادة / الإثبات</a>}
                    {canEdit && r.status === "pending" && <>
                      <button onClick={() => review(r.id, true)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />موافقة وإضافة</button>
                      <button onClick={() => review(r.id, false)} className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 font-bold">رفض</button>
                    </>}
                  </div>
                </li>
              ))}
              {!p.requests.length && <li className="text-xs text-muted-foreground">لا توجد طلبات.</li>}
            </ul>
          </section>
        </div>
      )}

      {tab === "shifts" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Box label="ساعات اليوم" value={p.shifts.today_hours} />
            <Box label="هذا الشهر" value={`${p.shifts.month.hours} س / ${p.shifts.month.days} يوم`} />
            <Box label="هذه السنة" value={`${p.shifts.year.hours} س / ${p.shifts.year.days} يوم`} />
            <Box label="الإجمالي" value={`${p.shifts.total.hours} س / ${p.shifts.total.days} يوم`} />
          </div>
          <div className="grid lg:grid-cols-3 gap-4">
            {[
              { t: "يومياً (آخر 31 يوماً)", rows: p.shifts.daily.map((d) => [d.day, `${d.hours} ساعة`]) },
              { t: "شهرياً", rows: p.shifts.monthly.map((m) => [m.month, `${m.hours} ساعة · ${m.days} يوم`]) },
              { t: "سنوياً", rows: p.shifts.yearly.map((y) => [y.year, `${y.hours} ساعة · ${y.days} يوم`]) },
            ].map((b) => (
              <section key={b.t} className="bg-card border border-border rounded-2xl p-4">
                <h2 className="font-bold text-sm mb-2">{b.t}</h2>
                <ul className="text-xs divide-y divide-border max-h-72 overflow-y-auto">
                  {b.rows.map(([k, v]) => <li key={k} className="py-1.5 flex justify-between"><span dir="ltr">{k}</span><span className="font-bold">{v}</span></li>)}
                  {!b.rows.length && <li className="py-1.5 text-muted-foreground">لا يوجد دوام مسجل.</li>}
                </ul>
              </section>
            ))}
          </div>
          <section className="bg-card border border-border rounded-2xl p-4">
            <h2 className="font-bold text-sm mb-2 flex items-center gap-1"><Clock className="w-4 h-4" />فترات الاتصال الأخيرة</h2>
            <ul className="text-xs divide-y divide-border">
              {p.shifts.recent.map((s, i) => <li key={i} className="py-1.5 flex flex-wrap justify-between gap-2"><span>من {dt(s.started_at)} إلى {s.ended_at ? dt(s.ended_at) : "الآن"}</span><b>{s.hours} ساعة</b></li>)}
              {!p.shifts.recent.length && <li className="py-1.5 text-muted-foreground">تُسجل الفترات من وقت تحديث التطبيق، عند كل تفعيل وإيقاف للاتصال.</li>}
            </ul>
          </section>
        </div>
      )}

      {tab === "ratings" && (
        <section className="bg-card border border-border rounded-2xl p-4">
          <h2 className="font-bold text-sm mb-2">التقييمات والتعليقات ({p.ratings.length})</h2>
          <ul className="divide-y divide-border text-xs">
            {p.ratings.map((r) => (
              <li key={r.order_no} className="py-2">
                <div className="flex flex-wrap gap-2 items-center"><span className="text-amber-500">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span><b>#{r.order_no}</b><span>{r.service_name}</span><span className="text-muted-foreground">{r.customer_name ?? ""} · {dt(r.completed_at)}</span></div>
                {r.review && <p className="mt-1 text-foreground">«{r.review}»</p>}
              </li>
            ))}
            {!p.ratings.length && <li className="py-2 text-muted-foreground">لا توجد تقييمات.</li>}
          </ul>
        </section>
      )}

      {tab === "customers" && (
        <section className="bg-card border border-border rounded-2xl p-4 overflow-x-auto">
          <h2 className="font-bold text-sm mb-2">طالبو الخدمة الذين تعامل معهم</h2>
          <table className="w-full text-xs text-right min-w-[600px]">
            <thead className="bg-mohemah-light text-muted-foreground"><tr>{["العميل", "الجوال", "الطلبات", "أنجز", "ملغاة", "أسباب الإلغاء"].map((h) => <th key={h} className="p-2">{h}</th>)}</tr></thead>
            <tbody>
              {p.customers.map((c) => (
                <tr key={c.customer_id} className="border-t border-border">
                  <td className="p-2 font-bold">{c.name ?? "—"}</td><td className="p-2" dir="ltr">{c.phone ?? ""}</td><td className="p-2">{c.orders}</td>
                  <td className="p-2 text-emerald-700">{c.completed}</td><td className={`p-2 ${c.cancelled ? "text-red-700 font-bold" : ""}`}>{c.cancelled}</td>
                  <td className="p-2 text-muted-foreground">{c.reasons ?? "—"}</td>
                </tr>
              ))}
              {!p.customers.length && <tr><td colSpan={6} className="p-2 text-muted-foreground">لا يوجد.</td></tr>}
            </tbody>
          </table>
        </section>
      )}

      {tab === "actions" && (
        <section className="bg-card border border-border rounded-2xl p-4">
          <h2 className="font-bold text-sm mb-2">سجل إجراءات الحساب</h2>
          <ul className="divide-y divide-border text-xs">
            {p.actions.map((a) => (
              <li key={a.id} className="py-2 flex flex-wrap items-center gap-2">
                <span className={`px-2 rounded-full ${a.action === "suspend" ? "bg-amber-100 text-amber-800" : a.action === "delete" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>{a.action === "suspend" ? "تعليق" : a.action === "delete" ? "حذف" : "إعادة تفعيل"}</span>
                <span className="text-muted-foreground">{dt(a.created_at)}</span>
                <span className="w-full">السبب: {a.reason}</span>
                {a.letter_url && <a href={fileUrl(a.letter_url)} target="_blank" rel="noreferrer" className="text-mohemah-blue flex items-center gap-1"><FileText className="w-3.5 h-3.5" />الخطاب المرفق</a>}
              </li>
            ))}
            {!p.actions.length && <li className="py-2 text-muted-foreground">لا توجد إجراءات.</li>}
          </ul>
        </section>
      )}

      {action && <AccountActionDialog userId={u.id} userName={u.full_name ?? "—"} action={action} onClose={() => setAction(null)}
        onDone={() => { setAction(null); if (action === "delete") window.history.back(); else load(); }} />}
    </div>
  );
}
