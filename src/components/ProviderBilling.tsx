import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Coins, CalendarClock, Check, ShieldCheck } from "lucide-react";
import { PaymentMethodPicker, sortGateways, type PayGateway } from "@/components/PaymentMethods";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";

type Billing = { billing_coins_enabled: boolean; billing_subscription_enabled: boolean; sub_price_1m: number; sub_price_3m: number; sub_price_6m: number; sub_price_12m: number; test_payments_enabled?: boolean };
type ProviderBillingInfo = Billing & { balance: number; billing_mode: string; subscription_end: string | null; latest_end: string | null; gateways: PayGateway[] };
const PLANS = [
  { months: 1, key: "sub_price_1m", label: "شهري" },
  { months: 3, key: "sub_price_3m", label: "3 أشهر" },
  { months: 6, key: "sub_price_6m", label: "6 أشهر" },
  { months: 12, key: "sub_price_12m", label: "سنوي" },
] as const;

const fetchBillingInfo = () => api<ProviderBillingInfo>("/api/provider/billing");
const daysLeft = (d: Date) => Math.ceil((d.getTime() - Date.now()) / 86400000);

/** Remaining days of the provider's active subscription, or null when none is active. */
export function useSubscriptionDaysLeft() {
  const { subscriptionEnd } = useAuth();
  const end = subscriptionEnd ? new Date(subscriptionEnd) : null;
  return end && end > new Date() ? daysLeft(end) : null;
}
const fmt = (d: Date) => d.toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { year: "numeric", month: "long", day: "numeric" });

/** Compact status shown above provider's incoming orders */
export function ProviderBillingStatus({ subscriptionOnly = false }: { subscriptionOnly?: boolean } = {}) {
  const { profile, subscriptionEnd } = useAuth();
  const end = subscriptionEnd ? new Date(subscriptionEnd) : null;
  if (profile?.billing_mode === "subscription" || (end && end > new Date())) {
    const active = end && end > new Date();
    const left = end ? daysLeft(end) : 0;
    return <div className={`mohemah-card p-3 text-xs text-right ${active && left > 5 ? "" : "border border-destructive/50"}`}>
      {active && end ? <>اشتراكك فعّال حتى {fmt(end)} ({left} يوم متبقٍ){left <= 5 && <span className="text-destructive font-bold"> — قارب على الانتهاء</span>}</> : <span className="text-destructive font-bold">اشتراكك غير فعّال، راجع مواعيد الاشتراك لقبول الطلبات</span>}
      {" "}<Link to="/provider/billing" className="text-primary underline">إدارة الاشتراك</Link>
    </div>;
  }
  if (subscriptionOnly) return null;
  return <p className="text-xs text-muted-foreground text-right">رصيدك: {profile?.coin_balance ?? 0} كوين — يُخصم من رصيدك عند قبول كل طلب</p>;
}

export function ProviderBillingPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [b, setB] = useState<Billing | null>(null);
  const [end, setEnd] = useState<Date | null>(null);
  const [gateways, setGateways] = useState<PayGateway[]>([]);
  const [gw, setGw] = useState("");
  const [plan, setPlan] = useState<number>(1);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    if (!user) return;
    try {
      const info = await fetchBillingInfo();
      setB(info);
      const list = sortGateways(info.gateways ?? []);
      setGateways(list); if (list[0] && !gw) setGw(list[0].id);
      setEnd(info.subscription_end ? new Date(info.subscription_end) : null);
    } catch { toast.error("تعذّر تحميل إعدادات التحصيل"); }
  };
  useEffect(() => { load(); }, [user?.id]);

  const setMode = async (mode: "coins" | "subscription") => {
    try { await api("/api/provider/billing-mode", { body: { mode } }); toast.success("تم الحفظ"); refreshProfile(); }
    catch (e) { toast.error(errMsg(e, "تعذّر تغيير الطريقة")); }
  };
  const subscribe = async (months: number) => {
    if (!gw) return toast.error("اختر وسيلة الدفع");
    setBusy(true);
    try {
      const r = await api<{ ends_at: string }>("/api/provider/subscribe", { body: { months, gateway_id: gw } });
      toast.success(`تم تفعيل الاشتراك حتى ${fmt(new Date(r.ends_at))}`);
      refreshProfile(); load();
    } catch (e) { toast.error(errMsg(e, "تعذّر الاشتراك")); }
    setBusy(false);
  };

  const mode = profile?.billing_mode ?? "coins";
  const active = end && end > new Date();
  const chosen = PLANS.find((p) => p.months === plan) ?? PLANS[0];
  const price = b ? Number(b[chosen.key]) || 0 : 0;
  const monthly = b ? Number(b.sub_price_1m) || 0 : 0;
  return (
    <div className="min-h-screen bg-background pb-24" dir="rtl">
      <header className="mohemah-header-gradient text-primary-foreground px-4 pt-8 pb-5">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link to="/provider/account" className="opacity-90" aria-label="رجوع"><ChevronRight className="w-6 h-6" /></Link>
          <h1 className="text-lg font-bold">طريقة الدفع والاشتراك</h1>
          <div className="w-6" />
        </div>
      </header>
      <div className="max-w-lg mx-auto px-4 mt-4 space-y-4">
        {!user ? <Link to="/provider/auth" className="mohemah-btn-coral block text-center py-2">سجّل الدخول أولاً</Link> : !b ? <p className="text-sm text-muted-foreground">جارٍ التحميل…</p> : <>
          <section>
            <h2 className="text-sm font-bold mb-2">كيف تدفع رسوم الطلبات؟</h2>
            <div role="radiogroup" className="grid grid-cols-2 gap-2">
              {([
                { id: "coins", icon: Coins, title: "كوينز لكل طلب", sub: b.billing_coins_enabled ? `رصيدك ${profile?.coin_balance ?? 0} كوين` : "غير متاح", on: b.billing_coins_enabled },
                { id: "subscription", icon: CalendarClock, title: "اشتراك مفتوح", sub: !b.billing_subscription_enabled ? "غير متاح" : active && end ? `فعّال حتى ${fmt(end)}` : "طلبات بلا خصم", on: b.billing_subscription_enabled },
              ] as const).map((m) => (
                <button key={m.id} role="radio" aria-checked={mode === m.id} disabled={!m.on} onClick={() => setMode(m.id)}
                  className={`relative rounded-xl border bg-card p-3 text-right transition-all disabled:opacity-40 ${mode === m.id ? "border-primary ring-2 ring-primary/30" : "border-border"}`}>
                  {mode === m.id && <span className="absolute left-2 top-2 grid size-4 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-3" /></span>}
                  <span className="mb-2 grid size-9 place-items-center rounded-lg bg-accent"><m.icon className="size-5 text-primary" /></span>
                  <p className="text-sm font-bold">{m.title}</p>
                  <p className="text-[11px] text-muted-foreground">{m.sub}</p>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">مع الاشتراك الفعّال لا يُخصم أي كوينز. طالب الخدمة لا يدفع أي مبلغ للتطبيق.</p>
          </section>

          {mode === "coins" && b.billing_coins_enabled && <Link to="/provider/coins" className="mohemah-card flex items-center justify-between p-3 text-sm font-bold"><span className="flex items-center gap-2"><Coins className="size-4 text-primary" />شحن الكوينز</span><ChevronRight className="size-4 rotate-180 text-muted-foreground" /></Link>}

          {b.billing_subscription_enabled && <>
            {active && end && <div className={`mohemah-card p-3 text-xs ${daysLeft(end) <= 5 ? "border border-destructive/50" : ""}`}>اشتراكك ينتهي في {fmt(end)} — متبقٍ {daysLeft(end)} يوم. التجديد يُضاف بعد تاريخ الانتهاء.</div>}
            <section>
              <h2 className="text-sm font-bold mb-2">اختر الباقة</h2>
              <div role="radiogroup" className="grid grid-cols-2 gap-2">
                {PLANS.map((p) => {
                  const v = Number(b[p.key]) || 0; const save = p.months > 1 && monthly > 0 ? Math.round((1 - v / (monthly * p.months)) * 100) : 0;
                  return (
                    <button key={p.months} role="radio" aria-checked={plan === p.months} onClick={() => setPlan(p.months)}
                      className={`relative rounded-xl border bg-card p-3 text-right transition-all active:scale-[0.98] ${plan === p.months ? "border-primary ring-2 ring-primary/30" : "border-border"}`}>
                      {save > 0 && <span className="absolute left-2 top-2 rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-bold text-success">وفّر {save}%</span>}
                      <p className="text-xs text-muted-foreground">{p.label}</p>
                      <p className="mt-1 text-lg font-bold">{v} <span className="text-xs font-semibold text-muted-foreground">ر.س</span></p>
                    </button>
                  );
                })}
              </div>
            </section>
            <section>
              <h2 className="text-sm font-bold mb-2">وسيلة الدفع</h2>
              <PaymentMethodPicker gateways={gateways} value={gw} onChange={setGw} />
            </section>
            <div className="mohemah-card p-4 space-y-3">
              <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">باقة {chosen.label}</span><span className="text-lg font-bold">{price} ر.س</span></div>
              <Button className="w-full" disabled={busy || !gw} onClick={() => subscribe(plan)}><Check />{busy ? "جارٍ الدفع…" : active ? `جدّد الآن — ${price} ر.س` : `اشترك الآن — ${price} ر.س`}</Button>
              <p className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground"><ShieldCheck className="size-3.5" />{b.test_payments_enabled ? "الدفع حالياً تجريبي للاختبار — لا يُخصم أي مبلغ" : "دفع آمن"}</p>
            </div>
          </>}
        </>}
      </div>
    </div>
  );
}

/** Admin card: enable billing methods and set subscription prices */
export function AdminBillingSettings() {
  const [b, setB] = useState<Billing | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const load = () => { setLoadError(false); api<Billing & Record<string, unknown>>("/api/admin/settings", { app: "admin" }).then((s) => setB({ billing_coins_enabled: !!s.billing_coins_enabled, billing_subscription_enabled: !!s.billing_subscription_enabled, sub_price_1m: Number(s.sub_price_1m), sub_price_3m: Number(s.sub_price_3m), sub_price_6m: Number(s.sub_price_6m), sub_price_12m: Number(s.sub_price_12m), test_payments_enabled: !!s.test_payments_enabled })).catch(() => setLoadError(true)); };
  useEffect(load, []);
  if (!b) return <section className="my-6 space-y-2"><h2 className="font-bold">طريقة تحصيل الرسوم من مقدمي الخدمة</h2><p className="text-sm text-muted-foreground">{loadError ? "تعذّر تحميل إعدادات التحصيل" : "جارٍ تحميل إعدادات التحصيل…"}</p>{loadError && <Button variant="outline" onClick={load}>إعادة المحاولة</Button>}</section>;
  const save = async () => {
    if (!b.billing_coins_enabled && !b.billing_subscription_enabled) return toast.error("فعّل طريقة واحدة على الأقل");
    if (PLANS.some(p => !Number.isFinite(Number(b[p.key])) || Number(b[p.key]) < 0)) return toast.error("أدخل أسعاراً صحيحة وغير سالبة");
    setBusy(true);
    try { await api("/api/admin/settings", { app: "admin", method: "PUT", body: b }); toast.success("تم حفظ إعدادات التحصيل"); }
    catch (e) { toast.error(errMsg(e, "تعذّر الحفظ")); }
    setBusy(false);
  };
  return (
    <section className="bg-card border border-border rounded-lg p-5 my-6 space-y-4">
      <div><h2 className="font-bold">طريقة تحصيل الرسوم من مقدمي الخدمة</h2><p className="text-xs text-muted-foreground mt-1">طالب الخدمة لا يدفع شيئاً. عند تفعيل الطريقتين يختار مقدم الخدمة ما يناسبه.</p></div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={b.billing_coins_enabled} onChange={e => setB({ ...b, billing_coins_enabled: e.target.checked })} />كوينز مع كل خدمة</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={b.billing_subscription_enabled} onChange={e => setB({ ...b, billing_subscription_enabled: e.target.checked })} />اشتراك دوري</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!b.test_payments_enabled} onChange={e => setB({ ...b, test_payments_enabled: e.target.checked })} />السماح بالدفع التجريبي (فترة الاختبار)</label>
      </div>
      {b.billing_subscription_enabled && <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{PLANS.map(p => <label key={p.key} className="text-sm"><span className="text-xs text-muted-foreground">{p.label} (ر.س)</span><input type="number" min={0} value={b[p.key]} onChange={e => setB({ ...b, [p.key]: Number(e.target.value) })} className="admin-input mt-1" /></label>)}</div>}
      <Button disabled={busy} onClick={save}>{busy ? "جارٍ الحفظ…" : "حفظ"}</Button>
    </section>
  );
}
