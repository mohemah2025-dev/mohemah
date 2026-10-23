import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { MapPin, Phone, PhoneOff, Award, Trophy, Medal, ShieldCheck, Bell, Clock, Wrench, Coins, CalendarClock, ClipboardList, Check } from "lucide-react";
import { useProvider, useProviderStats, INCOMING_TTL_MS, LOYALTY_TIERS, currentTierIndex, orderTitle } from "./ProviderContext";
import { ServiceIcon } from "@/components/ServiceAppearance";
import { AdSpace } from "@/components/AdSpace";
import { ProviderApplicationStatus } from "@/components/ProviderApplication";
import { useAuth } from "@/lib/AuthContext";
import { usePublicData } from "@/lib/publicData";
import { api, errMsg } from "@/lib/api";
import logo from "@/assets/mohemah-logo-new.png";

const TIER_ICONS = [ShieldCheck, Medal, Award, Trophy];
const TIER_TONES = ["text-mohemah-blue bg-mohemah-blue/10", "text-amber-700 bg-amber-100", "text-slate-500 bg-slate-200", "text-mohemah-gold bg-mohemah-gold/20"];

export function ProviderHomePage() {
  const { profile, isProvider } = useAuth();
  const { feed, online, setOnline, pendingIncoming, incomingMinimized, setIncomingMinimized } = useProvider();
  const stats = useProviderStats();
  const [panel, setPanel] = useState<"services" | "loyalty" | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (!pendingIncoming) return;
    const tick = () => setRemaining(Math.max(0, pendingIncoming.expiresAt - Date.now()));
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [pendingIncoming]);

  const tierIdx = currentTierIndex(stats?.completed ?? 0, stats?.rating ?? 0);
  const firstName = (profile?.full_name ?? "").split(/\s+/)[0] || "بك";
  const subActive = !!feed?.subscription_end;

  const toggleOnline = async () => {
    if (!isProvider) return toast.error("يتفعّل الاتصال بعد موافقة الإدارة على حسابك");
    if (!online && feed && feed.services_count === 0) { setPanel("services"); return toast.warning("اختر الخدمات التي تقدمها أولاً لتصلك طلباتها"); }
    setToggling(true);
    await setOnline(!online);
    setToggling(false);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="mohemah-header-gradient text-foreground px-4 pt-4 pb-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <img src={logo} alt="تطبيق مهمة" width={56} height={56} className="w-14 h-14 object-contain" />
          <div className="flex items-center gap-3">
            <div className="text-left">
              <p className="text-sm font-bold">أهلاً {firstName}</p>
              <div className="flex items-center gap-1 text-xs opacity-90">
                <MapPin className="w-3 h-3" />
                <span>{profile?.region ?? "حدد مدينتك من الملف الشخصي"}</span>
              </div>
            </div>
            <Link to="/provider/account" aria-label="حسابي" className="w-10 h-10 rounded-full bg-accent text-primary flex items-center justify-center">
              <UserIcon className="w-6 h-6" />
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 -mt-2">
        {pendingIncoming && incomingMinimized && (
          <Button variant="unstyled" size="unstyled" onClick={() => setIncomingMinimized(false)}
            className="w-full mt-4 rounded-2xl overflow-hidden shadow-lg bg-gradient-to-l from-mohemah-coral to-mohemah-blue text-primary-foreground active:scale-[0.99] transition-transform">
            <div className="px-4 py-3 flex items-center gap-3">
              <span className="relative flex w-9 h-9 rounded-full bg-white/25 items-center justify-center shrink-0">
                <Bell className="w-5 h-5" />
                <span className="absolute inset-0 rounded-full bg-white/30 animate-ping" />
              </span>
              <div className="flex-1 text-right min-w-0">
                <p className="text-sm font-bold truncate">طلب وارد جديد · {pendingIncoming.customer.name}</p>
                <p className="text-[11px] opacity-90 truncate">{orderTitle(pendingIncoming)} · {pendingIncoming.mode === "in_person" ? "حضوري" : "عن بُعد"}</p>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold bg-white/20 px-2 py-1 rounded-full">
                <Clock className="w-3.5 h-3.5" />{Math.ceil(remaining / 1000)}ث
              </div>
            </div>
            <div className="h-1 bg-white/20"><div className="h-full bg-white transition-all" style={{ width: `${(remaining / INCOMING_TTL_MS) * 100}%` }} /></div>
          </Button>
        )}

        <AdSpace className="mt-4" />

        {!isProvider && <div className="mt-4"><ProviderApplicationStatus /></div>}

        {/* Connection card: the circle in the middle, available services and loyalty as icons on both sides */}
        <section className="mohemah-card mt-4 overflow-hidden" aria-label="الاتصال واستقبال الطلبات">
          <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] sm:grid-cols-[5.5rem_minmax(0,1fr)_5.5rem] items-center gap-2 px-3 pt-8 pb-5">
            <SideIcon label="الخدمات المتاحة" sub={`${feed?.services_count ?? 0} مختارة`} active={panel === "services"} tone="bg-primary/10 text-primary"
              onClick={() => setPanel(panel === "services" ? null : "services")}><Wrench className="size-6" /></SideIcon>

            <div className="flex flex-col items-center gap-3">
              <Button variant="unstyled" size="unstyled" onClick={toggleOnline} disabled={toggling} aria-pressed={online}
                className={`relative size-40 sm:size-48 rounded-full flex flex-col items-center justify-center gap-1 transition-all duration-200 shadow-2xl disabled:opacity-70 ${
                  online ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground border border-border"}`}>
                {online && (
                  <>
                    <span className="absolute inset-0 rounded-full bg-primary animate-provider-pulse opacity-40" />
                    <span className="absolute inset-[-14px] rounded-full bg-primary animate-provider-pulse-outer opacity-20" />
                  </>
                )}
                <span className="relative z-10 flex flex-col items-center gap-2">
                  {online ? <Phone className="w-11 h-11" /> : <PhoneOff className="w-11 h-11" />}
                  <span className="text-lg font-bold">{online ? "متصل" : "غير متصل"}</span>
                </span>
              </Button>
            </div>

            <SideIcon label="برنامج الولاء" sub={LOYALTY_TIERS[tierIdx].name} active={panel === "loyalty"} tone="bg-mohemah-coral/10 text-mohemah-coral"
              onClick={() => setPanel(panel === "loyalty" ? null : "loyalty")}>{(() => { const I = TIER_ICONS[tierIdx]; return <I className="size-6" />; })()}</SideIcon>
          </div>

          <p className="px-4 text-xs text-muted-foreground text-center">
            {!isProvider ? "يتفعّل استقبال الطلبات بعد موافقة الإدارة" : online ? "أنت متاح لاستقبال الطلبات الآن" : "اضغط على الدائرة لبدء استقبال الطلبات"}
          </p>

          <div className="mt-4 grid grid-cols-3 border-t border-border text-center">
            <MiniStat icon={ClipboardList} value={String(feed?.available.length ?? 0)} label="طلبات متاحة" to="/provider/orders" />
            <MiniStat icon={Wrench} value={String(feed?.active.length ?? 0)} label="طلبات جارية" to="/provider/orders" />
            {subActive
              ? <MiniStat icon={CalendarClock} value={`${Math.max(0, Math.ceil((new Date(feed!.subscription_end!).getTime() - Date.now()) / 86400000))}`} label="يوم اشتراك" to="/provider/billing" />
              : <MiniStat icon={Coins} value={String(feed?.balance ?? profile?.coin_balance ?? 0)} label="كوينز" to="/provider/coins" />}
          </div>

          {panel === "services" && <ServicesPanel />}
          {panel === "loyalty" && <LoyaltyPanel current={tierIdx} completed={stats?.completed ?? 0} rating={stats?.rating ?? 0} />}
        </section>

        <DemandChart data={stats?.demand_by_hour ?? []} />
      </div>
    </div>
  );
}

function SideIcon({ label, sub, active, tone, onClick, children }: { label: string; sub: string; active: boolean; tone: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-expanded={active}
      className={`flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2 text-center transition-colors ${active ? "bg-accent" : "hover:bg-muted/60"}`}>
      <span className={`grid size-12 sm:size-14 place-items-center rounded-2xl ${tone} ${active ? "ring-2 ring-primary" : ""}`}>{children}</span>
      <span className="flex min-h-[2.6em] items-center text-[11px] sm:text-xs font-bold leading-tight">{label}</span>
      <span className="text-[10px] text-muted-foreground leading-tight">{sub}</span>
    </button>
  );
}

function MiniStat({ icon: Icon, value, label, to }: { icon: React.ComponentType<{ className?: string }>; value: string; label: string; to: "/provider/orders" | "/provider/billing" | "/provider/coins" }) {
  return (
    <Link to={to} className="flex flex-col items-center gap-0.5 py-3 border-l last:border-l-0 border-border">
      <Icon className="size-4 text-primary" />
      <span className="text-base font-bold tabular-nums">{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </Link>
  );
}

function ServicesPanel() {
  const { services } = usePublicData();
  const { isProvider } = useAuth();
  const { reload } = useProvider();
  const [mine, setMine] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { api<string[]>("/api/provider/services").then(setMine).catch(() => setMine([])); }, []);
  const toggle = async (id: string) => {
    if (!isProvider || !mine) return toast.error("تعديل الخدمات متاح بعد تفعيل حسابك");
    const next = mine.includes(id) ? mine.filter((x) => x !== id) : [...mine, id];
    setMine(next);
    setSaving(true);
    try { setMine(await api<string[]>("/api/provider/services", { method: "PUT", body: { ids: next } })); reload(); }
    catch (e) { toast.error(errMsg(e)); setMine(mine); }
    setSaving(false);
  };
  return (
    <div className="border-t border-border p-4 animate-in fade-in slide-in-from-top-1 duration-200">
      <p className="text-xs text-muted-foreground mb-3">اختر الخدمات التي تكون متاحاً لأداء مهامها، وستصلك طلباتها فقط{saving ? " — جارٍ الحفظ…" : ""}</p>
      <div className="grid grid-cols-2 gap-2">
        {services.map((s) => {
          const on = !!mine?.includes(s.id);
          return (
            <button key={s.id} type="button" onClick={() => toggle(s.id)} aria-pressed={on}
              className={`relative flex items-center gap-2 rounded-xl p-2.5 text-right transition-colors ${on ? "bg-mohemah-blue/10 ring-1 ring-mohemah-blue/40" : "bg-mohemah-light hover:bg-mohemah-gray"}`}>
              <ServiceIcon icon={s.icon} color={s.color} className="size-9 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold">{s.name}</span>
                <span className="block text-[10px] text-muted-foreground">{s.coin_price} كوين/طلب</span>
              </span>
              {on && <Check className="size-4 text-mohemah-blue shrink-0" />}
            </button>
          );
        })}
        {!services.length && <p className="col-span-2 text-xs text-muted-foreground">لا توجد خدمات بعد.</p>}
      </div>
    </div>
  );
}

function LoyaltyPanel({ current, completed, rating }: { current: number; completed: number; rating: number }) {
  const next = LOYALTY_TIERS[current + 1];
  return (
    <div className="border-t border-border p-4 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
      <p className="text-xs text-muted-foreground">أنجزت {completed} طلب بتقييم {rating.toFixed(1)}{next ? ` — المستوى التالي «${next.name}» بعد ${Math.max(0, next.min - completed)} طلب` : " — وصلت لأعلى مستوى"}</p>
      {LOYALTY_TIERS.map((tier, i) => {
        const Icon = TIER_ICONS[i];
        const isCurrent = i === current;
        return (
          <div key={tier.name} className={`rounded-xl p-3 ${isCurrent ? "ring-2 ring-mohemah-coral bg-mohemah-coral/5" : "bg-mohemah-light"}`}>
            <div className="flex items-center gap-3">
              <span className={`grid size-11 shrink-0 place-items-center rounded-full ${TIER_TONES[i]}`}><Icon className="size-5" /></span>
              <div className="flex-1 min-w-0 text-right">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold">{tier.name}</p>
                  <span className="text-xs font-bold text-mohemah-coral">{tier.reward}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">{tier.requirement}</p>
                <p className="text-[11px] text-muted-foreground">{tier.perks.join(" · ")}</p>
                {isCurrent && <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-mohemah-coral/10 text-mohemah-coral font-bold">مستواك الحالي</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DemandChart({ data }: { data: { hour: number; count: number }[] }) {
  const hours = useMemo(() => Array.from({ length: 24 }, (_, h) => ({ h, n: data.find((d) => d.hour === h)?.count ?? 0 })), [data]);
  const max = Math.max(1, ...hours.map((x) => x.n));
  const total = hours.reduce((s, x) => s + x.n, 0);
  return (
    <div className="mohemah-card mt-4 p-4">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-sm font-bold">أوقات الطلب الأكثر حركة</h3>
        <span className="text-[10px] text-muted-foreground">خدماتك · آخر 30 يوماً</span>
      </div>
      {total === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">ستظهر هنا أوقات الذروة بعد وصول أول الطلبات في خدماتك</p>
      ) : (
        <div className="provider-chart grid grid-flow-col auto-cols-fr items-end gap-0.5 h-32" role="img" aria-label="عدد الطلبات حسب ساعة اليوم" dir="ltr">
          {hours.map(({ h, n }) => (
            <div key={h} className="flex h-full min-w-0 flex-col items-center justify-end gap-1">
              <div className={`w-full rounded-t-sm ${n / max >= 0.66 ? "bg-primary" : n / max >= 0.33 ? "bg-bronze/60" : "bg-mohemah-gray"}`} title={`${h}:00 — ${n} طلب`} style={{ height: `${Math.max((n / max) * 85, 4)}%` }} />
              <span className="text-[8px] text-muted-foreground h-3 leading-none">{h % 3 === 0 ? h : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UserIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
