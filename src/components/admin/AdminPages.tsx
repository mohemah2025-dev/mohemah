import { ActivityTrendChart, ServiceDemandChart } from "./AdminOverviewCharts";
import { ServiceIcon } from "@/components/ServiceAppearance";
import { AdminProviderApplications } from "@/components/ProviderApplication";
import { AdminProviderPerformance } from "./AdminProviderPerformance";
import { AccountActionDialog, type AccountAction } from "./AccountActionDialog";
import { ADMIN_FEATURES, ADMIN_SECTIONS, useAuth, type AdminFeatures, type AdminPermissions, type AdminSection, type PermLevel } from "@/lib/AuthContext";
import { api, errMsg } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useAdmin, MainService, SubService, REGIONS_LIST, AdminCustomer, AdminProviderRow, uploadAdminImage, type StaffMember } from "@/lib/adminStore";
import { ArrowLeft, Plus, Pencil, Trash2, TrendingUp, TrendingDown, Coins, Users, UserCheck, Star, Wrench, MapPin, ArrowDownCircle, ArrowUpCircle, Upload, Download, Save, LoaderCircle, Ban, RotateCcw, Shield, KeyRound, Smartphone } from "lucide-react";
import { toast } from "sonner";

const REGIONS = ["الكل", ...REGIONS_LIST];
const GENDERS = ["الكل", "ذكر", "أنثى"];

function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center mb-4 gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone = "coral" }: { label: string; value: string | number; icon: any; tone?: "coral" | "blue" | "gold" | "green" }) {
  const toneClass = {
    coral: "bg-mohemah-coral/10 text-mohemah-coral",
    blue: "bg-mohemah-blue/10 text-mohemah-blue",
    gold: "bg-mohemah-gold/15 text-mohemah-gold",
    green: "bg-success/10 text-success",
  }[tone];
  return (
    <div className="min-w-0 bg-card border border-border rounded-lg p-3 sm:p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <p className="min-w-0 text-xs text-muted-foreground">{label}</p>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${toneClass}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-xl sm:text-2xl font-bold mt-2 tabular-nums break-all">{value}</p>
    </div>
  );
}

/* ============ Dashboard ============ */
export function AdminDashboardPage() {
  const { customers, providers, transactions, services, orders: allOrders } = useAdmin();
  const [service, setService] = useState("الكل");
  const [region, setRegion] = useState("الكل");
  const [gender, setGender] = useState("الكل");
  const [period, setPeriod] = useState("الكل");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const filteredCustomers = customers.filter(c => (region === "الكل" || c.region === region) && (gender === "الكل" || c.gender === gender));
  const filteredProviders = providers.filter(p => (region === "الكل" || p.region === region) && (gender === "الكل" || p.gender === gender) && (service === "الكل" || p.services.includes(service)));
  const range = useMemo(() => {
    const since = new Date();
    let until: Date | null = null;
    if (period === "اليوم") since.setHours(0, 0, 0, 0);
    if (period === "هذا الأسبوع") since.setDate(since.getDate() - 7);
    if (period === "هذا الشهر") { since.setDate(1); since.setHours(0, 0, 0, 0); }
    if (period === "السنة") since.setFullYear(since.getFullYear() - 1);
    if (period === "فترة محددة") {
      since.setTime(from ? new Date(`${from}T00:00:00`).getTime() : 0);
      until = to ? new Date(`${to}T23:59:59`) : null;
    }
    return { since, until };
  }, [period, from, to]);
  const inRange = (iso: string) => { const d = new Date(iso.replace(" ", "T")); return period === "الكل" || (d >= range.since && (!range.until || d <= range.until)); };
  const filteredTx = useMemo(() => transactions.filter(t => {
    const provider = providers.find(p => p.id === t.providerId);
    return (service === "الكل" || t.serviceName === service || t.type === "شحن") && (region === "الكل" || provider?.region === region) && (gender === "الكل" || provider?.gender === gender) && inRange(t.date);
  }), [transactions, providers, service, region, gender, range]);
  const filteredOrders = useMemo(() => allOrders.filter(o => (service === "الكل" || o.service_name === service) && (region === "الكل" || o.region === region) && inRange(o.created_at)), [allOrders, service, region, range]);
  const orders = filteredOrders.filter(o => o.accepted_at);
  const totalCoinsRevenue = filteredTx.filter(t => t.txType === "deduction").reduce((sum, t) => sum + t.coins, 0) - filteredTx.filter(t => t.txType === "refund").reduce((sum, t) => sum + t.coins, 0);
  const totalTopups = filteredTx.filter(t => t.txType === "topup").reduce((sum, t) => sum + t.coins, 0);
  const rated = filteredProviders.filter(p => p.rating > 0);
  const avgRating = rated.length ? (rated.reduce((sum, p) => sum + p.rating, 0) / rated.length).toFixed(2) : "—";
  const demand = services.filter(s => service === "الكل" || s.name === service).map(s => ({ ...s, count: filteredOrders.filter(o => o.service_name === s.name).length }));
  const trend = useMemo(() => {
    const days: Record<string, { date: string; orders: number; coins: number }> = {};
    filteredOrders.forEach(o => {
      const date = o.created_at.slice(0, 10);
      days[date] ??= { date, orders: 0, coins: 0 };
      days[date].orders += 1;
      days[date].coins += o.charged_coins;
    });
    return Object.values(days).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredOrders]);
  const byRegion = REGIONS_LIST.filter(r => region === "الكل" || r === region).map(r => ({ region: r, customers: filteredCustomers.filter(c => c.region === r).length, providers: filteredProviders.filter(p => p.region === r).length, orders: filteredOrders.filter(o => o.region === r).length })).filter(r => r.customers + r.providers + r.orders > 0);
  return <div className="admin-dashboard space-y-4">
    <PageHeader title="لوحة تحكم مهمة" subtitle="نظرة عامة على نشاط التطبيق" action={<Button variant="outline" size="sm" asChild><Link to="/admin/services"><Wrench />الخدمات</Link></Button>} />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
      <FilterSelect label="الخدمة" value={service} onChange={setService} options={["الكل", ...services.map(s => s.name)]} />
      <FilterSelect label="المنطقة" value={region} onChange={setRegion} options={REGIONS} />
      <FilterSelect label="الجنس" value={gender} onChange={setGender} options={GENDERS} />
      <FilterSelect label="الفترة" value={period} onChange={setPeriod} options={["الكل", "اليوم", "هذا الأسبوع", "هذا الشهر", "السنة"]} />
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
      <StatCard label="الطلبات المقبولة" value={`${orders.length} / ${filteredOrders.length}`} icon={TrendingUp} tone="green" />
      <StatCard label="إيراد بالكوينز" value={totalCoinsRevenue} icon={Coins} tone="gold" />
      <StatCard label="رصيد مشحون" value={totalTopups} icon={ArrowUpCircle} tone="green" />
      <StatCard label="طالبو الخدمات" value={filteredCustomers.length} icon={Users} tone="blue" />
      <StatCard label="مقدمو الخدمات" value={filteredProviders.length} icon={UserCheck} tone="green" />
    </div>
    <div className="grid lg:grid-cols-2 gap-4">
      <section className="min-w-0"><div className="flex items-center justify-between mb-2"><h2 className="text-sm font-bold">نشاط الطلبات</h2><span className="text-xs text-muted-foreground">{period}</span></div><ActivityTrendChart data={trend} /></section>
      <section className="min-w-0"><h2 className="text-sm font-bold mb-2">الطلبات حسب الخدمة</h2><ServiceDemandChart data={demand} /></section>
    </div>
    <section><div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
      <Row label="متوسط التقييم" value={<span className="flex items-center gap-1">{avgRating}<Star className="size-3 text-bronze" /></span>} />
      <Row label="الخدمات الرئيسية" value={services.length} />
      <Row label="الخدمات الفرعية" value={services.reduce((sum, s) => sum + s.subServices.length, 0)} />
      <Row label="طلب / مقدم" value={filteredProviders.length ? (orders.length / filteredProviders.length).toFixed(1) : "0"} />
    </div></section>
    <div className="grid lg:grid-cols-2 gap-4">
      <section><h2 className="text-sm font-bold mb-3">الخدمات</h2><div className="max-h-48 overflow-y-auto space-y-2">
        {demand.map(s => <div key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-center text-xs border-b border-border pb-2 last:border-0"><span className="flex min-w-0 items-center gap-2"><ServiceIcon icon={s.icon} color={s.color} className="size-7 shrink-0" /><span className="truncate" title={s.name}>{s.name}</span></span><span className="text-muted-foreground text-right">{s.count} طلب · {s.coinPrice} كوين</span></div>)}
        {!demand.length && <p className="text-xs text-muted-foreground">لا توجد خدمات</p>}
      </div></section>
      <section><h2 className="text-sm font-bold mb-3 flex items-center gap-2"><MapPin className="size-4" />النشاط حسب المنطقة</h2><div className="max-h-48 overflow-y-auto space-y-3">
        {byRegion.map(r => <div key={r.region} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-xs border-b border-border pb-2"><span className="font-semibold">{r.region}</span><span className="text-muted-foreground">{r.orders} طلب · {r.customers} عميل · {r.providers} مقدم</span></div>)}
        {!byRegion.length && <p className="text-xs text-muted-foreground">لا توجد بيانات</p>}
      </div></section>
    </div>
    <div className="grid lg:grid-cols-2 gap-4">
      <section><h2 className="text-sm font-bold mb-3">أفضل مقدمي الخدمات</h2><div className="space-y-3">
        {[...filteredProviders].sort((a, b) => b.rating - a.rating).slice(0, 4).map(p => <div key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-center border-b border-border pb-2 last:border-0"><div className="min-w-0"><p className="font-semibold text-xs truncate">{p.name}</p><p className="text-[11px] text-muted-foreground truncate">{p.region} · {p.services.join("، ")}</p></div><span className="flex items-center gap-1 text-xs">{p.rating}<Star className="size-3 text-bronze" /></span></div>)}
        {!filteredProviders.length && <p className="text-xs text-muted-foreground">لا توجد بيانات</p>}
      </div></section>
      <section><h2 className="text-sm font-bold mb-3">التوزيع حسب الجنس</h2><div className="space-y-3">
        {(["ذكر", "أنثى"] as const).map(g => { const c = filteredCustomers.filter(c => c.gender === g); const p = filteredProviders.filter(p => p.gender === g); const total = c.length + p.length || 1; const favorites = [...new Set(c.map(c => c.favoriteService).filter(Boolean))].slice(0, 3); return <div key={g}><div className="flex justify-between gap-2 text-xs"><span>{g}</span><span className="text-muted-foreground">{c.length} عميل · {p.length} مقدم</span></div><div className="h-1.5 bg-muted rounded-full overflow-hidden flex mt-2"><div className="bg-primary" style={{ width: `${c.length / total * 100}%` }} /><div className="bg-bronze" style={{ width: `${p.length / total * 100}%` }} /></div>{favorites.length > 0 && <p className="text-[11px] text-muted-foreground mt-1">الخدمات المفضلة: {favorites.join("، ")}</p>}</div>; })}
      </div></section>
    </div>
  </div>;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-b border-border pb-2 last:border-0"><span className="text-muted-foreground">{label}</span><span className="font-bold">{value}</span></div>;
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="w-full min-w-0 mt-1 bg-mohemah-light rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40">
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
}

/* ============ Customers ============ */
export function AdminCustomersPage() {
  const { customers, services, addCustomer, updateCustomer, refreshAll } = useAdmin();
  const [act, setAct] = useState<{ id: string; name: string; action: AccountAction } | null>(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<AdminCustomer | null>(null);
  const [open, setOpen] = useState(false);
  const list = customers.filter((c) => c.name.includes(q) || c.phone.includes(q) || String(c.memberNo ?? "").includes(q.replace("#", "")));
  const serviceNames = services.map((s) => s.name);
  return (
    <div>
      <PageHeader title="طالبو الخدمات" subtitle={`${customers.length} مستخدم مسجل`}
        action={<button onClick={() => { setEditing(null); setOpen(true); }} className="mohemah-btn-coral text-sm px-4 py-2 rounded-xl flex items-center gap-2"><Plus className="w-4 h-4" /> إضافة عميل</button>} />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الجوال" className="bg-card border border-border rounded-xl px-3 py-2 text-sm mb-4 w-full md:w-72" />
      <div className="bg-card border border-border rounded-2xl overflow-x-auto">
        <table className="w-full text-sm text-right min-w-[800px]">
          <thead className="bg-mohemah-light text-xs text-muted-foreground">
            <tr>{["#", "الاسم", "الجوال", "المنطقة", "الجنس", "الخدمة المفضّلة", "الطلبات", "آخر نشاط", ""].map((h) => <th key={h} className="p-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="border-t border-border hover:bg-mohemah-light/40">
                <td className="p-3 text-muted-foreground font-bold" dir="ltr">{c.memberNo ? `#${c.memberNo}` : "—"}</td>
                <td className="p-3 font-bold">{c.name}</td>
                <td className="p-3">{c.phone}</td>
                <td className="p-3">{c.region}</td>
                <td className="p-3">{c.gender}</td>
                <td className="p-3">{c.favoriteService || "—"}</td>
                <td className="p-3">{c.ordersCount}</td>
                <td className="p-3 text-muted-foreground">{c.lastActive}</td>
                <td className="p-3 flex gap-1">
                  <button onClick={() => { setEditing(c); setOpen(true); }} className="p-2 rounded-lg bg-mohemah-light"><Pencil className="w-3.5 h-3.5" /></button>
                  <button title="تعليق الحساب" onClick={() => setAct({ id: c.id, name: c.name, action: "suspend" })} className="p-2 rounded-lg bg-amber-50 text-amber-700"><Ban className="w-3.5 h-3.5" /></button>
                  <button title="إعادة التفعيل" onClick={() => setAct({ id: c.id, name: c.name, action: "reactivate" })} className="p-2 rounded-lg bg-emerald-50 text-emerald-700"><RotateCcw className="w-3.5 h-3.5" /></button>
                  <button title="حذف الحساب" onClick={() => setAct({ id: c.id, name: c.name, action: "delete" })} className="p-2 rounded-lg bg-red-50 text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {act && <AccountActionDialog userId={act.id} userName={act.name} action={act.action} onClose={() => setAct(null)} onDone={() => { setAct(null); refreshAll(); }} />}
      {open && <CustomerDialog initial={editing ?? undefined} serviceNames={serviceNames}
        onClose={() => { setOpen(false); setEditing(null); }}
        onSave={(d) => {
          if (editing) { updateCustomer(editing.id, d); toast.success("تم التحديث"); }
          else { addCustomer({ ...d, ordersCount: 0, lastActive: "الآن" }); toast.success("تم الإضافة"); }
          setOpen(false); setEditing(null);
        }} />}
    </div>
  );
}

function CustomerDialog({ initial, serviceNames, onClose, onSave }: { initial?: AdminCustomer; serviceNames: string[]; onClose: () => void; onSave: (d: Omit<AdminCustomer, "id">) => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [region, setRegion] = useState(initial?.region ?? REGIONS_LIST[0]);
  const [gender, setGender] = useState<"ذكر" | "أنثى">(initial?.gender ?? "ذكر");
  const [favoriteService, setFav] = useState(initial?.favoriteService ?? "");
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">{initial ? "تعديل عميل" : "إضافة عميل"}</h3>
        <div className="space-y-3 text-sm">
          <Field label="الاسم"><input value={name} onChange={(e) => setName(e.target.value)} className="admin-input" /></Field>
          <Field label="الجوال"><input value={phone} onChange={(e) => setPhone(e.target.value)} className="admin-input" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="المنطقة">
              <select value={region} onChange={(e) => setRegion(e.target.value)} className="admin-input">
                {REGIONS_LIST.map((r) => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="الجنس">
              <select value={gender} onChange={(e) => setGender(e.target.value as any)} className="admin-input">
                <option>ذكر</option><option>أنثى</option>
              </select>
            </Field>
          </div>
          <Field label="الخدمة المفضّلة">
            <select value={favoriteService} onChange={(e) => setFav(e.target.value)} className="admin-input">
              <option value="">—</option>
              {serviceNames.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-mohemah-light text-sm font-bold">إلغاء</button>
          <button onClick={() => name && phone && onSave({ name, phone, region, gender, favoriteService, ordersCount: initial?.ordersCount ?? 0, lastActive: initial?.lastActive ?? "الآن" })} className="flex-1 py-2.5 rounded-xl mohemah-btn-coral text-sm font-bold">حفظ</button>
        </div>
      </div>
    </div>
  );
}

/* ============ Providers ============ */
export function AdminProvidersPage() {
  const { providers, services, addProvider, updateProvider, removeProvider, refreshAll } = useAdmin();
  const [editing, setEditing] = useState<AdminProviderRow | null>(null);
  const [open, setOpen] = useState(false);
  const serviceNames = services.map((s) => s.name);
  const [pq, setPq] = useState("");
  const shown = providers.filter((p) => !pq.trim() || p.name.includes(pq.trim()) || p.phone.includes(pq.trim()) || String(p.memberNo ?? "").includes(pq.trim().replace("#", "")));
  return (
    <div>
      <PageHeader title="مقدمو الخدمات" subtitle={`${providers.length} مقدم خدمة`}
        action={<button onClick={() => { setEditing(null); setOpen(true); }} className="mohemah-btn-coral text-sm px-4 py-2 rounded-xl flex items-center gap-2"><Plus className="w-4 h-4" /> إضافة مقدم</button>} />
      <AdminProviderApplications onChanged={refreshAll} />
      <PendingServiceRequests />
      <input value={pq} onChange={(e) => setPq(e.target.value)} placeholder="ابحث بالاسم أو الجوال أو الرقم (#1001)، ثم اضغط الاسم لفتح ملفه وتحليل عمله" className="admin-input mb-3 max-w-xl" />
      <div className="bg-card border border-border rounded-2xl overflow-x-auto">
        <table className="w-full text-sm text-right min-w-[900px]">
          <thead className="bg-mohemah-light text-xs text-muted-foreground">
            <tr>{["#", "الاسم", "الجوال", "المنطقة", "الخدمات", "التقييم", "الرصيد", "الحالة", ""].map((h) => <th key={h} className="p-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id} className="border-t border-border hover:bg-mohemah-light/40">
                <td className="p-3 text-muted-foreground font-bold" dir="ltr">{p.memberNo ? `#${p.memberNo}` : "—"}</td>
                <td className="p-3 font-bold"><Link to="/admin/provider-profile/$id" params={{ id: p.id }} className="text-mohemah-blue hover:underline">{p.name}</Link></td>
                <td className="p-3">{p.phone}</td>
                <td className="p-3">{p.region}</td>
                <td className="p-3">{p.services.join("، ")}</td>
                <td className="p-3"><span className="inline-flex items-center gap-1">{p.rating} <Star className="w-3 h-3 text-mohemah-gold fill-mohemah-gold" /></span></td>
                <td className="p-3 font-bold text-mohemah-coral">{p.coinBalance}</td>
                <td className="p-3"><span className={`text-[11px] px-2 py-1 rounded-full ${p.status === "نشط" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{p.status}</span></td>
                <td className="p-3 flex gap-1">
                  <button onClick={() => updateProvider(p.id, { status: p.status === "نشط" ? "موقوف" : "نشط" })} className="p-2 rounded-lg bg-mohemah-blue/10 text-mohemah-blue text-xs">{p.status === "نشط" ? "إيقاف" : "تفعيل"}</button>
                  <button onClick={() => { setEditing(p); setOpen(true); }} className="p-2 rounded-lg bg-mohemah-light"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => { removeProvider(p.id); toast.success("تم الحذف"); }} className="p-2 rounded-lg bg-red-50 text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AdminProviderPerformance />
      {open && <ProviderDialog initial={editing ?? undefined} serviceNames={serviceNames}
        onClose={() => { setOpen(false); setEditing(null); }}
        onSave={(d) => {
          if (editing) { updateProvider(editing.id, d); toast.success("تم التحديث"); }
          else { addProvider(d); toast.success("تم الإضافة"); }
          setOpen(false); setEditing(null);
        }} />}
    </div>
  );
}

function ProviderDialog({ initial, serviceNames, onClose, onSave }: { initial?: AdminProviderRow; serviceNames: string[]; onClose: () => void; onSave: (d: Omit<AdminProviderRow, "id">) => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [region, setRegion] = useState(initial?.region ?? REGIONS_LIST[0]);
  const [gender, setGender] = useState<"ذكر" | "أنثى">(initial?.gender ?? "ذكر");
  const [svc, setSvc] = useState<string[]>(initial?.services ?? []);
  const [rating, setRating] = useState(initial?.rating ?? 4.5);
  const [coinBalance, setCoin] = useState(initial?.coinBalance ?? 0);
  const [status, setStatus] = useState<"نشط" | "موقوف">(initial?.status ?? "نشط");

  const toggle = (s: string) => setSvc((arr) => arr.includes(s) ? arr.filter((x) => x !== s) : [...arr, s]);
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">{initial ? "تعديل مقدم" : "إضافة مقدم"}</h3>
        <div className="space-y-3 text-sm">
          <Field label="الاسم"><input value={name} onChange={(e) => setName(e.target.value)} className="admin-input" /></Field>
          <Field label="الجوال"><input value={phone} onChange={(e) => setPhone(e.target.value)} className="admin-input" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="المنطقة">
              <select value={region} onChange={(e) => setRegion(e.target.value)} className="admin-input">
                {REGIONS_LIST.map((r) => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="الجنس">
              <select value={gender} onChange={(e) => setGender(e.target.value as any)} className="admin-input">
                <option>ذكر</option><option>أنثى</option>
              </select>
            </Field>
          </div>
          <Field label="الخدمات">
            <div className="flex flex-wrap gap-1">
              {serviceNames.map((s) => (
                <button type="button" key={s} onClick={() => toggle(s)} className={`text-xs px-3 py-1.5 rounded-full border ${svc.includes(s) ? "bg-mohemah-coral text-primary-foreground border-mohemah-coral" : "bg-mohemah-light border-border"}`}>{s}</button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="التقييم"><input type="number" step="0.1" min={0} max={5} value={rating} onChange={(e) => setRating(Number(e.target.value))} className="admin-input" /></Field>
            <Field label="الرصيد (كوينز)"><input type="number" min={0} value={coinBalance} onChange={(e) => setCoin(Number(e.target.value))} className="admin-input" /></Field>
            <Field label="الحالة">
              <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="admin-input">
                <option>نشط</option><option>موقوف</option>
              </select>
            </Field>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-mohemah-light text-sm font-bold">إلغاء</button>
          <button onClick={() => name && phone && onSave({ name, phone, region, gender, services: svc, rating, coinBalance, status })} className="flex-1 py-2.5 rounded-xl mohemah-btn-coral text-sm font-bold">حفظ</button>
        </div>
      </div>
    </div>
  );
}

export { AdminServicesPage, AdminServiceDetailPage } from "@/components/admin/AdminServices";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs text-muted-foreground">{label}</span><div className="mt-1">{children}</div></label>;
}

/* ============ Finance ============ */
export function AdminFinancePage() {
  const { transactions, providers } = useAdmin();
  const [tab, setTab] = useState<"all" | "deduct" | "topup">("all");

  const deductions = transactions.filter((t) => t.type === "خصم طلب");
  const topups = transactions.filter((t) => t.type === "شحن");
  const totalRevenue = deductions.reduce((s, t) => s + t.coins, 0);
  const totalTopup = topups.reduce((s, t) => s + t.coins, 0);
  const avgOrder = deductions.length ? (totalRevenue / deductions.length).toFixed(1) : "0";
  const net = totalTopup - totalRevenue;

  const list = tab === "deduct" ? deductions : tab === "topup" ? topups : transactions;

  // top providers by revenue
  const byProvider: Record<string, number> = {};
  deductions.forEach((t) => { byProvider[t.providerName] = (byProvider[t.providerName] || 0) + t.coins; });
  const topProviders = Object.entries(byProvider).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // by service
  const byService: Record<string, number> = {};
  deductions.forEach((t) => { byService[t.serviceName] = (byService[t.serviceName] || 0) + t.coins; });

  return (
    <div>
      <PageHeader title="المالية" subtitle="إحصائيات احترافية مع فصل واضح بين الشحن والخصومات"
        action={<button className="text-xs text-mohemah-blue hover:underline" onClick={() => toast.success("سيتم تصدير CSV (تجريبي)")}>تصدير CSV</button>} />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <StatCard label="إيراد التطبيق (خصومات)" value={totalRevenue} icon={ArrowDownCircle} tone="coral" />
        <StatCard label="إجمالي الشحن" value={totalTopup} icon={ArrowUpCircle} tone="green" />
        <StatCard label="صافي رصيد المقدمين" value={net} icon={TrendingDown} tone="blue" />
        <StatCard label="متوسط الخصم/طلب" value={avgOrder} icon={Coins} tone="gold" />
        <StatCard label="عدد العمليات" value={transactions.length} icon={Wrench} tone="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-bold mb-3">أعلى مقدمي الخدمات إيراداً للتطبيق</h3>
          <div className="space-y-2">
            {topProviders.map(([name, coins]) => (
              <div key={name} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
                <span className="font-bold">{name}</span>
                <span className="text-mohemah-coral font-bold">{coins} كوين</span>
              </div>
            ))}
            {topProviders.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">لا توجد بيانات</p>}
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-bold mb-3">إيراد الخصومات حسب الخدمة</h3>
          <div className="space-y-3">
            {Object.entries(byService).map(([name, coins]) => {
              const max = Math.max(...Object.values(byService), 1);
              return (
                <div key={name}>
                  <div className="flex justify-between text-xs mb-1"><span className="font-bold">{name}</span><span className="text-muted-foreground">{coins} كوين</span></div>
                  <div className="h-2 bg-mohemah-light rounded-full overflow-hidden"><div className="h-full bg-mohemah-coral" style={{ width: `${(coins / max) * 100}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex gap-1 bg-mohemah-light rounded-xl p-1">
            {[
              { k: "all", label: `الكل (${transactions.length})` },
              { k: "deduct", label: `خصومات (${deductions.length})` },
              { k: "topup", label: `شحن (${topups.length})` },
            ].map((t) => (
              <button key={t.k} onClick={() => setTab(t.k as any)} className={`text-xs px-3 py-1.5 rounded-lg ${tab === t.k ? "bg-card font-bold shadow-sm" : "text-muted-foreground"}`}>{t.label}</button>
            ))}
          </div>
          <h3 className="text-sm font-bold">سجل الحركات</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right min-w-[800px]">
            <thead className="bg-mohemah-light text-xs text-muted-foreground">
              <tr>{["#", "مقدم الخدمة", "الخدمة/الوسيلة", "النوع", "الكوينز", "التاريخ"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="p-3 text-muted-foreground">{t.id}</td>
                  <td className="p-3 font-bold">{t.providerName}</td>
                  <td className="p-3">{t.type === "شحن" ? (t.method || "شحن") : t.serviceName}</td>
                  <td className="p-3"><span className={`text-[11px] px-2 py-1 rounded-full ${t.type === "خصم طلب" ? "bg-mohemah-coral/15 text-mohemah-coral" : "bg-emerald-100 text-emerald-700"}`}>{t.type}</span></td>
                  <td className={`p-3 font-bold ${t.type === "خصم طلب" ? "text-mohemah-coral" : "text-emerald-600"}`}>{t.type === "خصم طلب" ? "-" : "+"}{t.coins}</td>
                  <td className="p-3 text-muted-foreground">{t.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ============ Pending "add a service" requests ============ */
function PendingServiceRequests() {
  const [list, setList] = useState<{ id: string; provider_id: string; provider_name: string | null; service_name: string; created_at: string }[]>([]);
  useEffect(() => { api<typeof list>("/api/admin/service-requests?status=pending", { app: "admin" }).then(setList).catch(() => {}); }, []);
  if (!list.length) return null;
  return (
    <section className="mb-4 border-2 border-sky-200 bg-sky-50 rounded-2xl p-4">
      <h2 className="font-bold text-sm mb-2">طلبات إضافة خدمة بانتظار المراجعة ({list.length})</h2>
      <ul className="space-y-1.5 text-xs">
        {list.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 bg-card rounded-lg px-3 py-2">
            <span><b>{r.provider_name ?? "—"}</b> يطلب إضافة «{r.service_name}»</span>
            <Link to="/admin/provider-profile/$id" params={{ id: r.provider_id }} className="text-mohemah-blue font-bold hover:underline">مراجعة الملف والشهادة</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ============ Staff ============ */
const LEVELS: { v: PermLevel; label: string }[] = [{ v: "none", label: "بدون" }, { v: "view", label: "عرض" }, { v: "edit", label: "تعديل" }];

/** Default page permissions for a new supervisor (everything except administration pages). */
function defaultAccess(): AdminPermissions {
  const p = Object.fromEntries(ADMIN_SECTIONS.map((x) => [x.key, "edit"])) as AdminPermissions;
  p.analytics = "view"; p.gateways = "view"; p.settings = "view"; p.integrations = "none"; p.staff = "none";
  return p;
}

/** Ticked actions of a page (a page without a list = all its actions). */
const ticked = (f: AdminFeatures, key: AdminSection) => f[key] ?? (ADMIN_FEATURES[key] ?? []).map((x) => x.key);

/** One row per page with none / view / edit, and under each editable page the actions it allows. */
function PermissionsMatrix({ value, onChange, features, onFeatures, max, maxFeatures }: {
  value: AdminPermissions; onChange: (v: AdminPermissions) => void;
  features: AdminFeatures; onFeatures: (f: AdminFeatures) => void;
  max?: AdminPermissions | null; maxFeatures?: AdminFeatures | null;
}) {
  const rank = { none: 0, view: 1, edit: 2 };
  const setAll = (lv: PermLevel) => onChange(Object.fromEntries(ADMIN_SECTIONS.map((x) => [x.key, max && rank[max[x.key]] < rank[lv] ? max[x.key] : lv])) as AdminPermissions);
  const toggle = (sec: AdminSection, key: string) => {
    const cur = ticked(features, sec);
    onFeatures({ ...features, [sec]: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] });
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2 text-[11px]">
        <span className="text-muted-foreground">تطبيق على الكل:</span>
        {LEVELS.map((l) => <button key={l.v} type="button" onClick={() => setAll(l.v)} className="px-2 py-0.5 rounded-full border border-border hover:bg-mohemah-light">{l.label}</button>)}
      </div>
      <div className="border border-border rounded-xl divide-y divide-border max-h-[55vh] overflow-y-auto">
        {ADMIN_SECTIONS.map((sec) => {
          const acts = ADMIN_FEATURES[sec.key];
          const on = ticked(features, sec.key);
          return (
            <div key={sec.key} className="px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold">{sec.label}</span>
                <div className="inline-flex rounded-lg border border-border overflow-hidden text-[11px]">
                  {LEVELS.map((l) => {
                    const disabled = !!max && rank[max[sec.key]] < rank[l.v];
                    const active = value[sec.key] === l.v;
                    return (
                      <button key={l.v} type="button" disabled={disabled} onClick={() => onChange({ ...value, [sec.key]: l.v })}
                        className={`px-2.5 py-1 ${active ? (l.v === "edit" ? "bg-emerald-600 text-white" : l.v === "view" ? "bg-mohemah-blue text-white" : "bg-muted-foreground text-white") : "bg-card"} disabled:opacity-30`}>
                        {l.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {acts && value[sec.key] === "edit" && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {acts.map((a) => {
                    const blocked = !!maxFeatures?.[sec.key] && !maxFeatures[sec.key]!.includes(a.key);
                    const checked = on.includes(a.key) && !blocked;
                    return (
                      <label key={a.key} className={`text-[11px] px-2 py-1 rounded-lg border cursor-pointer flex items-center gap-1 ${checked ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-border text-muted-foreground"} ${blocked ? "opacity-40 cursor-not-allowed" : ""}`}>
                        <input type="checkbox" className="accent-emerald-600" checked={checked} disabled={blocked} onChange={() => toggle(sec.key, a.key)} />{a.label}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground mt-2">عند اختيار «تعديل» تظهر إجراءات الصفحة؛ ألغِ تحديد أي إجراء لمنعه (مثلاً: يرد على الرسائل دون إنهائها).</p>
    </div>
  );
}

function accessSummary(a: AdminPermissions | null, f: AdminFeatures | null, owner: boolean) {
  if (owner) return "كل الصفحات (تعديل)";
  const p = a ?? defaultAccess();
  const edit = ADMIN_SECTIONS.filter((x) => p[x.key] === "edit").length;
  const view = ADMIN_SECTIONS.filter((x) => p[x.key] === "view").length;
  const limited = f ? ADMIN_SECTIONS.filter((x) => p[x.key] === "edit" && f[x.key] && f[x.key]!.length < (ADMIN_FEATURES[x.key]?.length ?? 0)).length : 0;
  return `تعديل ${edit} · عرض ${view} · بدون ${ADMIN_SECTIONS.length - edit - view}${limited ? ` · ${limited} بإجراءات محددة` : ""}`;
}

function Modal({ title, sub, children, onClose, wide = false }: { title: string; sub?: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className={`bg-card rounded-2xl p-6 w-full max-h-[92vh] overflow-y-auto ${wide ? "max-w-2xl" : "max-w-md"}`} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-1">{title}</h3>
        {sub && <p className="text-xs text-muted-foreground mb-4">{sub}</p>}
        {children}
      </div>
    </div>
  );
}

export function AdminStaffPage() {
  const { staff, addStaff, toggleStaff, removeStaff, resetPassword, setStaffPermissions, updateStaff, changeStaffRole } = useAdmin();
  const { isOwner, user, can, canDo, permissions, features } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [profileFor, setProfileFor] = useState<StaffMember | null>(null);
  const [passFor, setPassFor] = useState<StaffMember | null>(null);
  const [delFor, setDelFor] = useState<StaffMember | null>(null);
  const act = "text-[11px] px-2 py-1 rounded-lg border border-border hover:bg-mohemah-light flex items-center gap-1";
  return (
    <div>
      <PageHeader title="المستخدمون والصلاحيات" subtitle="حسابات لوحة التحكم، وصلاحية كل مستخدم على كل صفحة وإجراءاتها"
        action={canDo("staff", "add") ? <button onClick={() => setOpen(true)} className="mohemah-btn-coral text-sm px-4 py-2 rounded-xl flex items-center gap-2"><Plus className="w-4 h-4" /> إضافة مستخدم</button> : undefined} />
      <div className="bg-card border border-border rounded-2xl overflow-x-auto">
        <table className="w-full text-sm text-right min-w-[860px]">
          <thead className="bg-mohemah-light text-xs text-muted-foreground">
            <tr>{["#", "الاسم", "الدخول", "الدور", "الصلاحيات", "الحالة", "الإجراءات"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {staff.map((s, i) => {
              const owner = s.role === "مالك";
              const self = s.id === user?.id;
              const manage = isOwner || !owner;
              return (
                <tr key={s.id} className="border-t border-border align-top">
                  <td className="p-3 text-muted-foreground">{i + 1}</td>
                  <td className="p-3 font-bold">{s.name}{self && <span className="text-[10px] text-muted-foreground font-normal"> (أنت)</span>}</td>
                  <td className="p-3" dir="ltr">{s.email}</td>
                  <td className="p-3"><span className="text-[11px] px-2 py-1 rounded-full bg-mohemah-blue/15 text-mohemah-blue">{s.role}</span></td>
                  <td className="p-3 text-[11px] text-muted-foreground">{accessSummary(s.access, s.features, owner)}</td>
                  <td className="p-3"><span className={`text-[11px] px-2 py-1 rounded-full ${s.active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{s.active ? "نشط" : "موقوف"}</span></td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {canDo("staff", "permissions") && (isOwner || !owner) && <button onClick={() => setEditing(s)} disabled={self} title={self ? "لا يمكنك تعديل صلاحياتك بنفسك" : undefined} className={`${act} disabled:opacity-40 disabled:cursor-not-allowed`}><Shield className="size-3.5" />الصلاحيات</button>}
                      {canDo("staff", "edit") && manage && <button onClick={() => setProfileFor(s)} className={act}><Pencil className="size-3.5" />البيانات</button>}
                      {canDo("staff", "edit") && manage && <button onClick={() => setPassFor(s)} className={act}><KeyRound className="size-3.5" />كلمة المرور</button>}
                      {canDo("staff", "suspend") && manage && !self && <button onClick={() => toggleStaff(s.id)} className={act}>{s.active ? <><Ban className="size-3.5" />إيقاف</> : <><RotateCcw className="size-3.5" />تفعيل</>}</button>}
                      {canDo("staff", "suspend") && manage && !self && <button onClick={() => setDelFor(s)} className={`${act} text-red-600 hover:bg-red-50`}><Trash2 className="size-3.5" />حذف</button>}
                      {!can("staff", "edit") && <span className="text-[11px] text-muted-foreground">عرض فقط</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">«عرض» يفتح الصفحة للقراءة فقط، و«تعديل» يسمح بالإجراءات المحددة لها، و«بدون» يخفي الصفحة. الصلاحيات تُطبَّق في الخادم أيضاً.</p>
      {open && <NewStaffDialog canOwner={isOwner} max={isOwner ? null : permissions} maxFeatures={isOwner ? null : features} onClose={() => setOpen(false)}
        onSave={async (d) => { try { await addStaff(d); toast.success("تم إضافة المستخدم"); setOpen(false); } catch (e) { toast.error(errMsg(e)); } }} />}
      {editing && <PermissionsDialog member={editing} canOwner={isOwner} max={isOwner ? null : permissions} maxFeatures={isOwner ? null : features} onClose={() => setEditing(null)}
        onSave={async (role, p, f) => {
          try {
            if (role !== editing.role) await changeStaffRole(editing.id, role as "مالك" | "مشرف");
            if (role === "مشرف") await setStaffPermissions(editing.id, p, f);
            toast.success("تم حفظ الصلاحيات"); setEditing(null);
          } catch (e) { toast.error(errMsg(e)); }
        }} />}
      {profileFor && <StaffProfileDialog member={profileFor} onClose={() => setProfileFor(null)}
        onSave={async (d) => { try { await updateStaff(profileFor.id, d); toast.success("تم حفظ البيانات"); setProfileFor(null); } catch (e) { toast.error(errMsg(e)); } }} />}
      {passFor && <StaffPasswordDialog member={passFor} onClose={() => setPassFor(null)}
        onSave={async (pw) => { try { await resetPassword(passFor.id, pw); toast.success("تم تغيير كلمة المرور وتسجيل خروجه من أجهزته"); setPassFor(null); } catch (e) { toast.error(errMsg(e)); } }} />}
      {delFor && (
        <Modal title={`حذف ${delFor.name} من لوحة التحكم`} sub="يُزال دوره في اللوحة ويُسجَّل خروجه، ويبقى حسابه في التطبيق إن وُجد." onClose={() => setDelFor(null)}>
          <div className="flex gap-2 mt-2">
            <button onClick={() => setDelFor(null)} className="flex-1 py-2.5 rounded-xl bg-mohemah-light text-sm font-bold">إلغاء</button>
            <button onClick={async () => { await removeStaff(delFor.id); toast.success("تم الحذف من لوحة التحكم"); setDelFor(null); }} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold">حذف</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PermissionsDialog({ member, canOwner, max, maxFeatures, onClose, onSave }: { member: StaffMember; canOwner: boolean; max: AdminPermissions | null; maxFeatures: AdminFeatures | null; onClose: () => void; onSave: (role: StaffMember["role"], p: AdminPermissions, f: AdminFeatures) => void }) {
  const [role, setRole] = useState<StaffMember["role"]>(member.role);
  const [value, setValue] = useState<AdminPermissions>(member.access ?? defaultAccess());
  const [feats, setFeats] = useState<AdminFeatures>(member.features ?? {});
  return (
    <Modal wide title={`صلاحيات ${member.name}`} sub="حدد لكل صفحة: بدون، عرض، أو تعديل — ثم الإجراءات المسموحة داخلها. يسري التغيير فوراً." onClose={onClose}>
      {canOwner && (
        <div className="flex items-center gap-2 mb-3 text-sm">
          <span className="font-bold">الدور:</span>
          {(["مشرف", "مالك"] as const).map((r) => (
            <button key={r} type="button" onClick={() => setRole(r)} className={`px-3 py-1 rounded-lg border text-xs ${role === r ? "border-mohemah-blue bg-mohemah-blue text-white" : "border-border"}`}>{r === "مالك" ? "مالك (كل الصلاحيات)" : "مشرف (صلاحيات محددة)"}</button>
          ))}
        </div>
      )}
      {role === "مالك"
        ? <p className="text-xs text-muted-foreground border border-border rounded-xl p-4">المالك يملك كل الصلاحيات على كل الصفحات وإجراءاتها.</p>
        : <PermissionsMatrix value={value} onChange={setValue} features={feats} onFeatures={setFeats} max={max} maxFeatures={maxFeatures} />}
      <div className="flex gap-2 mt-5">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-mohemah-light text-sm font-bold">إلغاء</button>
        <button onClick={() => onSave(role, value, feats)} className="flex-1 py-2.5 rounded-xl mohemah-btn-coral text-sm font-bold">حفظ الصلاحيات</button>
      </div>
    </Modal>
  );
}

function StaffProfileDialog({ member, onClose, onSave }: { member: StaffMember; onClose: () => void; onSave: (d: { name: string; login?: string }) => void }) {
  const [name, setName] = useState(member.name);
  const [login, setLogin] = useState(member.email === "—" ? "" : member.email);
  return (
    <Modal title={`بيانات ${member.name}`} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <Field label="الاسم"><input value={name} onChange={(e) => setName(e.target.value)} className="admin-input" /></Field>
        <Field label="البريد أو اسم المستخدم (للدخول)"><input dir="ltr" value={login} onChange={(e) => setLogin(e.target.value)} className="admin-input" /></Field>
      </div>
      <div className="flex gap-2 mt-5">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-mohemah-light text-sm font-bold">إلغاء</button>
        <button onClick={() => name.trim() ? onSave({ name: name.trim(), login: login.trim() && login.trim() !== member.email ? login.trim() : undefined }) : toast.error("اكتب الاسم")} className="flex-1 py-2.5 rounded-xl mohemah-btn-coral text-sm font-bold">حفظ</button>
      </div>
    </Modal>
  );
}

function StaffPasswordDialog({ member, onClose, onSave }: { member: StaffMember; onClose: () => void; onSave: (pw: string) => void }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  return (
    <Modal title={`كلمة مرور ${member.name}`} sub="بعد الحفظ يُسجَّل خروجه من كل الأجهزة ويدخل بكلمة المرور الجديدة." onClose={onClose}>
      <div className="space-y-3 text-sm">
        <Field label="كلمة المرور الجديدة"><input dir="ltr" type="password" value={pw} onChange={(e) => setPw(e.target.value)} className="admin-input" autoComplete="new-password" /></Field>
        <Field label="تأكيد كلمة المرور"><input dir="ltr" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} className="admin-input" autoComplete="new-password" /></Field>
      </div>
      <div className="flex gap-2 mt-5">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-mohemah-light text-sm font-bold">إلغاء</button>
        <button onClick={() => pw.length < 8 ? toast.error("8 أحرف على الأقل") : pw !== pw2 ? toast.error("كلمتا المرور غير متطابقتين") : onSave(pw)} className="flex-1 py-2.5 rounded-xl mohemah-btn-coral text-sm font-bold">تغيير</button>
      </div>
    </Modal>
  );
}

function NewStaffDialog({ canOwner, max, maxFeatures, onClose, onSave }: { canOwner: boolean; max: AdminPermissions | null; maxFeatures: AdminFeatures | null; onClose: () => void; onSave: (s: { name: string; login: string; password: string; role: "مالك" | "مشرف"; permissions?: AdminPermissions; features?: AdminFeatures | null }) => void }) {
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"مالك" | "مشرف">("مشرف");
  const [feats, setFeats] = useState<AdminFeatures>(maxFeatures ?? {});
  const [access, setAccess] = useState<AdminPermissions>(() => {
    const d = defaultAccess();
    if (!max) return d;
    const rank = { none: 0, view: 1, edit: 2 };
    return Object.fromEntries(ADMIN_SECTIONS.map((x) => [x.key, rank[max[x.key]] < rank[d[x.key]] ? max[x.key] : d[x.key]])) as AdminPermissions;
  });
  return (
    <Modal wide title="إضافة مستخدم للوحة التحكم" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="الاسم"><input value={name} onChange={(e) => setName(e.target.value)} className="admin-input" /></Field>
          <Field label="البريد أو اسم المستخدم (للدخول)"><input dir="ltr" value={login} onChange={(e) => setLogin(e.target.value)} className="admin-input" placeholder="support1 أو name@mohemah.sa" /></Field>
          <Field label="كلمة المرور المؤقتة"><input dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} className="admin-input" placeholder="8 أحرف على الأقل" /></Field>
          {canOwner && (
            <Field label="الدور">
              <select value={role} onChange={(e) => setRole(e.target.value as "مالك" | "مشرف")} className="admin-input"><option>مشرف</option><option>مالك</option></select>
            </Field>
          )}
        </div>
        {role === "مشرف" ? <PermissionsMatrix value={access} onChange={setAccess} features={feats} onFeatures={setFeats} max={max} maxFeatures={maxFeatures} /> : <p className="text-[11px] text-muted-foreground">المالك يملك كل الصلاحيات على كل الصفحات.</p>}
      </div>
      <div className="flex gap-2 mt-5">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-mohemah-light text-sm font-bold">إلغاء</button>
        <button onClick={() => name && login && password.length >= 8 ? onSave({ name, login, password, role, permissions: role === "مشرف" ? access : undefined, features: role === "مشرف" ? feats : undefined }) : toast.error("أكمل الحقول (كلمة المرور 8 أحرف على الأقل)")} className="flex-1 py-2.5 rounded-xl mohemah-btn-coral text-sm font-bold">حفظ</button>
      </div>
    </Modal>
  );
}

/* ============ Settings ============ */
/** One logo slot: preview, upload, download, remove. */
function LogoSlot({ title, hint, url, onChange }: { title: string; hint: string; url: string; onChange: (url: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(f.type)) { toast.error("اختر صورة PNG أو JPG أو WEBP أو SVG"); return; }
    if (f.size > 2 * 1024 * 1024) { toast.error("الحد الأقصى 2MB"); return; }
    uploadAdminImage(f).then((u) => { onChange(u); toast.success("تم رفع الشعار، اضغط حفظ التغييرات"); }).catch((e) => toast.error(errMsg(e, "تعذر رفع الصورة")));
  };
  return (
    <div className="mb-5">
      <h3 className="font-bold text-sm mb-1">{title}</h3>
      <p className="text-[11px] text-muted-foreground mb-2">{hint}</p>
      <div className="h-32 bg-muted border border-dashed border-border rounded-lg grid place-items-center mb-3 overflow-hidden">
        {url ? <img src={url} alt={title} className="max-w-full h-28 object-contain p-2" /> : <span className="text-muted-foreground text-xs">لم يتم إضافة شعار</span>}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} className="hidden" aria-label={title} />
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => input.current?.click()}><Upload />{url ? "تغيير الشعار" : "إضافة شعار"}</Button>
        {url && <><Button variant="ghost" size="icon" title="تحميل الشعار" aria-label="تحميل الشعار" asChild><a href={url} download="mohemah-logo"><Download /></a></Button><Button variant="ghost" size="icon" title="إزالة الشعار" aria-label="إزالة الشعار" onClick={() => onChange("")}><Trash2 /></Button></>}
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">PNG / JPG / WEBP / SVG · حتى 2MB</p>
    </div>
  );
}

export function AdminSettingsPage() {
  const { settings, updateSettings } = useAdmin();
  const [local, setLocal] = useState(settings);
  const [saving, setSaving] = useState(false);
  const dirty = useRef(false);
  useEffect(() => { if (!dirty.current) setLocal(settings); }, [settings]);
  const set = (patch: Partial<typeof local>) => { dirty.current = true; setLocal((s) => ({ ...s, ...patch })); };

  const save = async () => {
    for (const u of [local.customerIosUrl, local.customerAndroidUrl, local.customerOtherUrl, local.providerIosUrl, local.providerAndroidUrl, local.providerOtherUrl]) if (u.trim() && !/^https?:\/\//.test(u.trim())) return toast.error("روابط التحميل يجب أن تبدأ بـ https://");
    setSaving(true);
    try { await updateSettings(local); dirty.current = false; toast.success("تم حفظ الإعدادات"); } catch (e) { toast.error(errMsg(e, "تعذر حفظ الإعدادات، حاول مجددًا")); } finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader title="الإعدادات العامة" subtitle="هوية التطبيق وبيانات التواصل والشعارات وروابط التحميل" />

      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-4" onChange={() => { dirty.current = true; }}>
        <section className="min-w-0 border-t border-border pt-4">
          <LogoSlot title="شعار لوحة التحكم" hint="يظهر في القائمة الجانبية وأيقونة تبويب المتصفح وخطابات الخبرة." url={local.logoUrl} onChange={(u) => set({ logoUrl: u })} />
          <LogoSlot title="شعار التطبيقات" hint="يظهر في تطبيقي طالب ومقدم الخدمة (شاشة البداية، الدخول، الرئيسية). يُفضّل مربع 512×512 بخلفية شفافة." url={local.appLogoUrl} onChange={(u) => set({ appLogoUrl: u })} />
        </section>

        {/* Settings form */}
        <div className="min-w-0 border-t border-border pt-4 space-y-3">
          <h3 className="font-bold mb-1">معلومات التطبيق</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="اسم التطبيق"><input value={local.appName} onChange={(e) => setLocal({ ...local, appName: e.target.value })} className="admin-input" /></Field>
            <Field label="مسمى العملة"><input value={local.currencyLabel} onChange={(e) => setLocal({ ...local, currencyLabel: e.target.value })} className="admin-input" /></Field>
            <Field label="بريد الدعم"><input value={local.supportEmail} onChange={(e) => setLocal({ ...local, supportEmail: e.target.value })} className="admin-input" /></Field>
            <Field label="رقم الدعم"><input value={local.supportPhone} onChange={(e) => setLocal({ ...local, supportPhone: e.target.value })} className="admin-input" dir="ltr" /></Field>
            <Field label="اللون الرئيسي"><input type="color" value={local.primaryColor} onChange={(e) => setLocal({ ...local, primaryColor: e.target.value })} className="admin-input h-10 p-1 cursor-pointer" /></Field>
          </div>
          <Field label="رسالة ترحيب لمقدمي الخدمة"><textarea value={local.welcomeProvider} onChange={(e) => setLocal({ ...local, welcomeProvider: e.target.value })} className="admin-input min-h-20" /></Field>
          <Field label="رسالة ترحيب لطالبي الخدمة"><textarea value={local.welcomeCustomer} onChange={(e) => setLocal({ ...local, welcomeCustomer: e.target.value })} className="admin-input min-h-20" /></Field>

          {([
            { title: "روابط تحميل تطبيق مقدم الخدمة «مهمة شريك»", hint: "تظهر في تطبيق طالب الخدمة ← حسابي ← «هل لديك مهارة أو خبرة؟» ليحمّل تطبيق مقدمي الخدمة.", keys: ["providerIosUrl", "providerAndroidUrl", "providerOtherUrl"] as const },
            { title: "روابط تحميل تطبيق طالب الخدمة «مهمة»", hint: "تظهر في تطبيق مقدم الخدمة ← حسابي ← «هل تحتاج خدمة؟».", keys: ["customerIosUrl", "customerAndroidUrl", "customerOtherUrl"] as const },
          ]).map((g) => (
            <div key={g.title} className="pt-3 border-t border-border">
              <h3 className="font-bold mb-1 flex items-center gap-2"><Smartphone className="size-4 text-mohemah-blue" />{g.title}</h3>
              <p className="text-[11px] text-muted-foreground mb-2">{g.hint} اترك الرابط فارغاً لإخفاء زره.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(["آيفون (App Store)", "أندرويد (Google Play)", "أخرى (هواوي / رابط مباشر)"] as const).map((label, i) => (
                  <Field key={label} label={label}><input dir="ltr" value={local[g.keys[i]]} onChange={(e) => set({ [g.keys[i]]: e.target.value })} className="admin-input" placeholder={i === 0 ? "https://apps.apple.com/…" : i === 1 ? "https://play.google.com/…" : "https://…"} /></Field>
                ))}
              </div>
            </div>
          ))}

          <Button onClick={save} disabled={saving}>{saving ? <LoaderCircle className="animate-spin" /> : <Save />}{saving ? "جاري الحفظ" : "حفظ التغييرات"}</Button>
        </div>
      </div>
    </div>
  );
}

