import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, CheckCircle2, Info, Lightbulb, Search, TrendingDown, TrendingUp } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useAdmin, REGIONS_LIST } from "@/lib/adminStore";
import { useAuth } from "@/lib/AuthContext";

const adm = <T,>(path: string, opts: { method?: string; body?: unknown } = {}) => api<T>(path, { ...opts, app: "admin" });

type G = { name: string; count: number; share: number; completed: number; cancelled: number; pending: number; completion_rate: number; cancel_rate: number; avg_accept_min: number | null; rating: number | null; coins: number; top_service: string | null };
type Svc = G & { prev: number; growth: number | null };
interface Analytics {
  days: number;
  totals: { orders: number; prev_orders: number; completed: number; cancelled: number; pending: number; completion_rate: number; cancel_rate: number; accept_rate: number; avg_accept_min: number | null; rating: number | null; coins: number; customers: number; returning: number };
  services: Svc[]; sub_services: G[]; cities: G[]; districts: G[]; genders: G[]; nationalities: G[]; modes: G[]; periods: G[];
  weekdays: { name: string; count: number }[]; hours: { hour: number; count: number }[]; segments: { name: string; count: number }[];
  trend: { date: string; orders: number; completed: number }[];
  gaps: { service: string; region: string; orders: number; pending: number; providers: number; online: number; unserved_rate: number; per_provider: number | null }[];
  insights: { kind: "good" | "warn" | "info" | "tip"; text: string }[];
}
interface Match {
  order: { id: string; order_no: number; service: string; region: string | null; status: string };
  providers: { id: string; name: string; region: string | null; online: boolean; sees_order: boolean; notified: boolean; reasons: string[] }[];
}

const fmtMin = (m: number | null) => (m === null ? "—" : m < 60 ? `${Math.round(m)} د` : `${Math.round((m / 60) * 10) / 10} س`);

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "up" | "down" }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1" dir="ltr" style={{ textAlign: "right" }}>{value}</p>
      {sub && <p className={`text-[11px] mt-1 flex items-center gap-1 ${tone === "up" ? "text-emerald-600" : tone === "down" ? "text-destructive" : "text-muted-foreground"}`}>
        {tone === "up" && <TrendingUp className="size-3" />}{tone === "down" && <TrendingDown className="size-3" />}{sub}</p>}
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="bg-card border border-border rounded-2xl p-4 min-w-0">
      <h2 className="font-bold text-sm">{title}</h2>
      {hint && <p className="text-[11px] text-muted-foreground mb-3">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </section>
  );
}

/** Horizontal share bars: name, bar, count and an optional note. */
function Shares({ rows, note, empty = "لا توجد بيانات" }: { rows: { name: string; count: number; share?: number }[]; note?: (r: G) => string | null; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (!rows.length || !rows.some((r) => r.count)) return <p className="text-xs text-muted-foreground">{empty}</p>;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.name} className="text-xs">
          <div className="flex justify-between gap-2 mb-0.5">
            <span className="font-bold truncate">{r.name}</span>
            <span className="text-muted-foreground shrink-0">{r.count}{r.share !== undefined ? ` · ${r.share}%` : ""}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${(r.count / max) * 100}%` }} /></div>
          {note && (() => { const t = note(r as G); return t ? <p className="text-[10px] text-muted-foreground mt-0.5">{t}</p> : null; })()}
        </div>
      ))}
    </div>
  );
}

const insightStyle = {
  good: { icon: CheckCircle2, cls: "bg-emerald-50 border-emerald-200 text-emerald-900" },
  warn: { icon: AlertTriangle, cls: "bg-amber-50 border-amber-200 text-amber-900" },
  info: { icon: Info, cls: "bg-sky-50 border-sky-200 text-sky-900" },
  tip: { icon: Lightbulb, cls: "bg-violet-50 border-violet-200 text-violet-900" },
};

export function AdminAnalyticsPage() {
  const { services } = useAdmin();
  const { can } = useAuth();
  const [days, setDays] = useState(30);
  const [service, setService] = useState("");
  const [region, setRegion] = useState("");
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams({ days: String(days), ...(service ? { service } : {}), ...(region ? { region } : {}) });
    adm<Analytics>(`/api/admin/analytics?${q}`).then(setData).catch((e) => toast.error(errMsg(e))).finally(() => setLoading(false));
  }, [days, service, region]);

  const t = data?.totals;
  const growth = t && t.prev_orders ? Math.round(((t.orders - t.prev_orders) / t.prev_orders) * 100) : null;
  const peakHours = useMemo(() => (data?.hours ?? []).map((h) => ({ name: `${h.hour}`, count: h.count })), [data]);

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">تحليل الطلبات</h1>
          <p className="text-xs text-muted-foreground">الطلب حسب الخدمة والمدينة والحي والعميل والوقت، مع توصيات تجارية. الأوقات بتوقيت الرياض.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="admin-input w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[7, 30, 90, 180, 365].map((d) => <option key={d} value={d}>آخر {d} يوماً</option>)}
          </select>
          <select className="admin-input w-auto" value={service} onChange={(e) => setService(e.target.value)}>
            <option value="">كل الخدمات</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="admin-input w-auto" value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">كل المدن</option>{REGIONS_LIST.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      {loading && !data && <p className="text-sm text-muted-foreground">جاري التحليل…</p>}
      {data && t && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <Kpi label="الطلبات" value={String(t.orders)} sub={growth === null ? "لا توجد فترة سابقة" : `${growth >= 0 ? "+" : ""}${growth}% عن الفترة السابقة`} tone={growth === null ? undefined : growth >= 0 ? "up" : "down"} />
            <Kpi label="معدل الإنجاز" value={`${t.completion_rate}%`} sub={`${t.completed} طلب مكتمل`} />
            <Kpi label="معدل الإلغاء" value={`${t.cancel_rate}%`} sub={`${t.cancelled} طلب ملغى`} tone={t.cancel_rate > 15 ? "down" : undefined} />
            <Kpi label="متوسط وقت القبول" value={fmtMin(t.avg_accept_min)} sub={`قُبل ${t.accept_rate}% من الطلبات`} />
            <Kpi label="متوسط التقييم" value={t.rating ? `${t.rating}/5` : "—"} />
            <Kpi label="العملاء" value={String(t.customers)} sub={`${t.returning} متكرر`} />
          </div>

          <Card title="قراءة المحلل وتوصياته" hint="ملخص تلقائي من البيانات الفعلية لهذه الفترة">
            <div className="grid md:grid-cols-2 gap-2">
              {data.insights.map((x, i) => {
                const st = insightStyle[x.kind]; const Icon = st.icon;
                return <div key={i} className={`flex gap-2 items-start border rounded-xl p-3 text-xs leading-6 ${st.cls}`}><Icon className="size-4 shrink-0 mt-1" /><span>{x.text}</span></div>;
              })}
            </div>
          </Card>

          <Card title="تطور الطلبات اليومي">
            <div className="h-56 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
                  <XAxis dataKey="date" tickFormatter={(v) => String(v).slice(5)} minTickGap={24} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis width={28} allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Legend formatter={(v) => (v === "orders" ? "الطلبات" : "المكتملة")} />
                  <Line type="monotone" dataKey="orders" stroke="var(--primary)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="completed" stroke="#16a34a" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="أداء الخدمات" hint="الحصة والنمو والإنجاز والإلغاء وسرعة القبول والتقييم لكل خدمة رئيسية">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right min-w-[720px]">
                <thead className="bg-mohemah-light text-muted-foreground"><tr>{["الخدمة", "الطلبات", "الحصة", "النمو", "الإنجاز", "الإلغاء", "وقت القبول", "التقييم", "الأكثر في"].map((h) => <th key={h} className="p-2">{h}</th>)}</tr></thead>
                <tbody>
                  {data.services.map((s) => (
                    <tr key={s.name} className="border-t border-border">
                      <td className="p-2 font-bold">{s.name}</td>
                      <td className="p-2">{s.count}</td>
                      <td className="p-2 w-32"><div className="flex items-center gap-1"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.max(4, s.share)}%` }} /><span>{s.share}%</span></div></td>
                      <td className={`p-2 ${s.growth === null ? "text-muted-foreground" : s.growth >= 0 ? "text-emerald-600" : "text-destructive"}`}>{s.growth === null ? "جديد" : `${s.growth >= 0 ? "+" : ""}${s.growth}%`}</td>
                      <td className="p-2">{s.completion_rate}%</td>
                      <td className={`p-2 ${s.cancel_rate > 20 ? "text-destructive font-bold" : ""}`}>{s.cancel_rate}%</td>
                      <td className="p-2">{fmtMin(s.avg_accept_min)}</td>
                      <td className="p-2">{s.rating ?? "—"}</td>
                      <td className="p-2 text-muted-foreground">{data.cities.find((c) => c.top_service === s.name)?.name ?? "—"}</td>
                    </tr>
                  ))}
                  {!data.services.length && <tr><td colSpan={9} className="p-3 text-muted-foreground">لا توجد طلبات.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card title="المدن" hint="عدد الطلبات وأكثر خدمة تُطلب في كل مدينة">
              <Shares rows={data.cities} note={(r) => r.top_service ? `الأكثر طلباً: ${r.top_service} · إنجاز ${r.completion_rate}%` : null} />
            </Card>
            <Card title="الأحياء الأكثر طلباً" hint="من عنوان الطلب المحدد على الخريطة أو بالموقع">
              <Shares rows={data.districts} note={(r) => r.top_service ? `الأكثر طلباً: ${r.top_service}` : null} empty="لا توجد عناوين بأحياء بعد (تظهر عند تحديد الموقع في الطلب)" />
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <Card title="فترات اليوم">
              <Shares rows={data.periods} note={(r) => r.top_service ? `الأكثر: ${r.top_service}` : null} />
            </Card>
            <Card title="الجنس" hint="من بيانات حساب طالب الخدمة">
              <Shares rows={data.genders} note={(r) => r.top_service ? `الأكثر طلباً: ${r.top_service}` : null} />
            </Card>
            <Card title="شرائح العملاء">
              <Shares rows={data.segments} />
              <div className="mt-4"><Shares rows={data.modes} /></div>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card title="الطلبات حسب الساعة" hint="لتوجيه مقدمي الخدمة للاتصال في أوقات الذروة">
              <div className="h-48" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={peakHours} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
                    <XAxis dataKey="name" interval={2} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis width={24} allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => [`${v} طلب`, "الطلبات"]} labelFormatter={(l) => `الساعة ${l}:00`} />
                    <Bar dataKey="count" fill="var(--primary)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="أيام الأسبوع">
              <Shares rows={data.weekdays} />
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card title="أكثر المهام طلباً">
              <Shares rows={data.sub_services} />
            </Card>
            <Card title="الجنسيات" hint="من بيانات الحساب إن وُجدت">
              <Shares rows={data.nationalities} empty="لا توجد بيانات جنسية للعملاء" />
            </Card>
          </div>

          <Card title="العرض مقابل الطلب" hint="خدمات ومدن فيها طلبات لم تُقبل أو مقدمو خدمة قليلون — أولوية الاستقطاب">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right min-w-[600px]">
                <thead className="bg-mohemah-light text-muted-foreground"><tr>{["الخدمة", "المدينة", "الطلبات", "لم تُقبل", "مقدمو الخدمة", "المتصلون الآن", "طلبات لكل مقدم"].map((h) => <th key={h} className="p-2">{h}</th>)}</tr></thead>
                <tbody>
                  {data.gaps.map((g) => (
                    <tr key={`${g.service}|${g.region}`} className="border-t border-border">
                      <td className="p-2 font-bold">{g.service}</td><td className="p-2">{g.region}</td><td className="p-2">{g.orders}</td>
                      <td className={`p-2 ${g.pending ? "text-destructive font-bold" : ""}`}>{g.pending} ({g.unserved_rate}%)</td>
                      <td className={`p-2 ${g.providers === 0 ? "text-destructive font-bold" : ""}`}>{g.providers}</td><td className="p-2">{g.online}</td><td className="p-2">{g.per_provider ?? "—"}</td>
                    </tr>
                  ))}
                  {!data.gaps.length && <tr><td colSpan={7} className="p-3 text-muted-foreground">لا توجد بيانات.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <OrderDiagnostics canFix={can("providers", "edit")} />
    </div>
  );
}

/** "Why didn't my order reach the provider?" — enter an order number. */
function OrderDiagnostics({ canFix }: { canFix: boolean }) {
  const [q, setQ] = useState("");
  const [m, setM] = useState<Match | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (id = q) => {
    if (!id.trim()) return;
    setBusy(true);
    try { setM(await adm<Match>(`/api/admin/orders/${encodeURIComponent(id.trim().replace(/^#/, ""))}/match`)); } catch (e) { toast.error(errMsg(e)); setM(null); }
    setBusy(false);
  };
  const fix = async (pid: string) => {
    try { await adm(`/api/admin/providers/${pid}/sync-services`, { body: {} }); toast.success("تم تفعيل الخدمات التي اختارها عند التسجيل"); run(String(m?.order.order_no ?? q)); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Card title="تشخيص وصول طلب لمقدمي الخدمة" hint="اكتب رقم الطلب لمعرفة من يراه من مقدمي الخدمة، وسبب عدم ظهوره لغيرهم">
      <div className="flex gap-2 max-w-md">
        <input className="admin-input" dir="ltr" placeholder="رقم الطلب مثل 1024" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} />
        <button onClick={() => run()} disabled={busy} className="mohemah-btn-coral rounded-lg px-4 text-sm font-bold flex items-center gap-1 disabled:opacity-50"><Search className="size-4" />فحص</button>
      </div>
      {m && (
        <div className="mt-4 space-y-2">
          <p className="text-xs text-muted-foreground">طلب #{m.order.order_no} · {m.order.service} · {m.order.region ?? "بدون مدينة"} · الحالة: {m.order.status}</p>
          {m.providers.length === 0 && <p className="text-sm text-destructive">لا يوجد أي مقدم خدمة مسجل بعد.</p>}
          {m.providers.map((p) => (
            <div key={p.id} className={`border rounded-xl p-3 text-xs ${p.sees_order ? "border-emerald-200 bg-emerald-50" : "border-border"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold">{p.name} <span className="text-muted-foreground font-normal">· {p.region ?? "بدون مدينة"} · {p.online ? "متصل" : "غير متصل"}</span></span>
                <span className={p.sees_order ? "text-emerald-700 font-bold" : "text-destructive font-bold"}>{p.sees_order ? (p.notified ? "يرى الطلب ووصله تنبيه" : "يرى الطلب (لا تنبيه لأنه غير متصل)") : "لا يرى الطلب"}</span>
              </div>
              {!p.sees_order && <ul className="mt-1 list-disc pr-5 text-muted-foreground">{p.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
              {canFix && p.reasons.some((r) => r.includes("اختارها عند التسجيل")) && (
                <button onClick={() => fix(p.id)} className="mt-2 text-mohemah-blue hover:underline">تفعيل الخدمات التي اختارها عند التسجيل</button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
