import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { MapPin, MessageCircle, X, Star, Navigation, Check, Phone, Clock, Inbox, CircleCheck, CircleX } from "lucide-react";
import { toast } from "sonner";
import { useProvider, orderTitle, type ActiveJob, type AvailableOrder } from "./ProviderContext";
import { ProviderBillingStatus } from "./ProviderBilling";
import { ProviderApplicationStatus } from "./ProviderApplication";
import { EnableOrderAlerts } from "./OrderAlerts";
import { useAuth } from "@/lib/AuthContext";
import { api, errMsg } from "@/lib/api";
import { OrderChat, fmtDate, fmtDateTime, mapsUrl, timeAgo, modeLabel } from "@/lib/liveData";

type HistoryRow = {
  id: string; order_no: number; service_name: string; sub_service_name: string | null; mode: string; status: "completed" | "cancelled";
  description: string | null; region: string | null; address: string | null; rating: number | null; review: string | null; customer_rating: number | null;
  charged_coins: number; billing_mode: string | null; completed_at: string | null; cancelled_at: string | null; created_at: string; customer: { name: string | null };
};

function stepsFor(mode: string) {
  const s = [
    { key: "accepted", label: "أنت في طريقك إليه" },
    { key: "arrived", label: "وصلت عند الباب" },
    { key: "in_progress", label: "جاري تنفيذ المهمة" },
    { key: "completed", label: "تم تنفيذ المهمة" },
  ];
  return mode === "remote" ? [{ key: "accepted", label: "تم قبول الطلب" }, ...s.slice(2)] : s;
}
const advanceLabel = (j: ActiveJob) =>
  j.status === "accepted" ? (j.mode === "in_person" ? "وصلت للموقع" : "بدء تنفيذ المهمة") : j.status === "arrived" ? "بدء تنفيذ المهمة" : "تم تنفيذ المهمة";

export function ProviderOrdersPage() {
  const { user, isProvider, loading } = useAuth();
  const { feed, reload, acceptOrder, rejectOrder } = useProvider();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"available" | "active" | "past">("available");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);

  const loadHistory = useCallback(async () => {
    try { setHistory(await api<HistoryRow[]>("/api/provider/history")); } catch { setHistory([]); }
  }, []);
  useEffect(() => { if (tab === "past" && isProvider) loadHistory(); }, [tab, isProvider, loadHistory]);
  useEffect(() => { if (feed?.active.length && tab === "available" && !feed.available.length) setTab("active"); }, [feed?.active.length]);

  if (!loading && !user) return <SignedOut />;

  const job = feed?.active.find((j) => j.id === selected) ?? null;
  if (job) return <JobDetail job={job} onBack={() => setSelected(null)} onChanged={() => { reload(); loadHistory(); }} />;

  const accept = async (o: AvailableOrder) => {
    setBusy(o.id);
    const r = await acceptOrder(o.id);
    setBusy(null);
    if (r.ok) { toast.success(r.reason ?? "تم قبول الطلب"); setTab("active"); setSelected(o.id); }
    else {
      toast.error(r.reason ?? "تعذّر قبول الطلب");
      if (r.error === "insufficient_balance") navigate({ to: "/provider/coins" });
      if (r.error === "subscription_required") navigate({ to: "/provider/billing" });
    }
  };

  const available = feed?.available ?? [];
  const active = feed?.active ?? [];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mohemah-header-gradient text-primary-foreground px-4 pt-8 pb-5">
        <h1 className="max-w-lg mx-auto text-xl font-bold text-center">الطلبات</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 mt-4 space-y-3">
        {!isProvider ? <ProviderApplicationStatus /> : (
          <>
            <EnableOrderAlerts />
            <ProviderBillingStatus />
            {feed && !feed.online && <Link to="/provider" className="mohemah-card block p-3 text-xs text-center text-muted-foreground">أنت غير متصل — <span className="font-bold text-primary">فعّل الاتصال من الرئيسية</span> لتصلك الطلبات الجديدة فوراً</Link>}
            {feed && feed.services_count === 0 && <Link to="/provider" className="mohemah-card block p-3 text-xs text-center text-destructive">لم تختر أي خدمة بعد، اخترها من الرئيسية لتظهر لك الطلبات</Link>}

            <div className="flex border-b border-border" role="tablist">
              {([["available", "متاحة", available.length], ["active", "جارية", active.length], ["past", "سابقة", null]] as const).map(([k, label, n]) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                  className={`flex-1 py-3 text-sm font-bold text-center transition-colors ${tab === k ? "text-mohemah-blue border-b-3 border-mohemah-coral" : "text-muted-foreground"}`}>
                  {label}
                  {n !== null && n > 0 && <span className="mr-1 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-mohemah-coral text-primary-foreground text-xs font-bold">{n}</span>}
                </button>
              ))}
            </div>

            {tab === "available" && (
              !available.length ? <Empty text="لا توجد طلبات متاحة في خدماتك حالياً" /> : available.map((o) => (
                <div key={o.id} className="mohemah-card p-4 space-y-2 border-r-4 border-mohemah-coral">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold">{orderTitle(o)}</p>
                      <p className="text-[11px] text-muted-foreground">#{o.order_no} · {timeAgo(o.created_at)}</p>
                    </div>
                    <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-bold ${o.mode === "in_person" ? "bg-mohemah-coral/10 text-mohemah-coral" : "bg-mohemah-blue/10 text-mohemah-blue"}`}>{modeLabel(o.mode)}</span>
                  </div>
                  {o.description && <p className="text-xs text-muted-foreground leading-relaxed">{o.description}</p>}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="size-3" />{o.mode === "remote" ? "عن بُعد" : o.region ?? "—"}</span>
                    <span className="flex items-center gap-1"><Clock className="size-3" />{o.scheduled_at ? fmtDateTime(o.scheduled_at) : "في أقرب وقت"}</span>
                    <span className="flex items-center gap-1"><Star className="size-3 text-mohemah-gold fill-mohemah-gold" />{o.customer.name}{o.customer.rating_count ? ` ${o.customer.rating.toFixed(1)}` : ""}</span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => rejectOrder(o.id)} className="flex-1 py-2 rounded-xl bg-mohemah-light text-sm font-bold text-muted-foreground">تجاهل</button>
                    <button disabled={busy === o.id} onClick={() => accept(o)} className="flex-[2] py-2 rounded-xl mohemah-btn-coral text-sm font-bold flex items-center justify-center gap-1 disabled:opacity-50">
                      <Check className="w-4 h-4" />{feed?.subscription_end ? "قبول ضمن اشتراكك" : `قبول (${o.coin_cost} كوين)`}
                    </button>
                  </div>
                </div>
              ))
            )}

            {tab === "active" && (
              !active.length ? <Empty text="لا توجد طلبات جارية" /> : active.map((j) => (
                <button key={j.id} onClick={() => setSelected(j.id)} className="w-full mohemah-card p-4 text-right">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-mohemah-coral/15 flex items-center justify-center shrink-0"><UserIcon className="w-6 h-6 text-mohemah-coral" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold truncate">{j.customer.name ?? "عميل"}</p>
                        <span className="text-[11px] text-muted-foreground shrink-0">#{j.order_no}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{orderTitle(j)} · {j.mode === "remote" ? "عن بُعد" : j.region}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-mohemah-blue/10 text-mohemah-blue">{stepsFor(j.mode).find((s) => s.key === j.status)?.label}</span>
                        {j.unread > 0 && <span className="text-[10px] font-bold text-mohemah-coral flex items-center gap-1"><MessageCircle className="size-3" />{j.unread} رسالة</span>}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}

            {tab === "past" && (
              history === null ? <p className="text-xs text-muted-foreground text-center py-6">جارٍ التحميل…</p>
                : !history.length ? <Empty text="لا توجد طلبات سابقة بعد" />
                : history.map((h) => <HistoryCard key={h.id} h={h} onRated={loadHistory} />)
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SignedOut() {
  return (
    <div className="min-h-screen bg-background pb-24 grid place-items-center px-6 text-center">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">سجّل دخولك لعرض الطلبات</p>
        <Link to="/provider/auth" className="mohemah-btn-primary inline-block px-6 py-2">تسجيل الدخول</Link>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-center py-14 text-muted-foreground"><Inbox className="size-10 mx-auto mb-2 opacity-40" /><p className="text-sm">{text}</p></div>;
}

function HistoryCard({ h, onRated }: { h: HistoryRow; onRated: () => void }) {
  const [open, setOpen] = useState(false);
  const [stars, setStars] = useState(0);
  const done = h.status === "completed";
  const rateCustomer = async () => {
    if (!stars) return toast.error("اختر عدد النجوم");
    try { await api(`/api/orders/${h.id}/rate-customer`, { body: { rating: stars } }); toast.success("تم حفظ تقييم العميل"); onRated(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="mohemah-card overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full p-4 flex items-center gap-3 text-right">
        <span className={`grid size-10 place-items-center rounded-full shrink-0 ${done ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>{done ? <CircleCheck className="size-5" /> : <CircleX className="size-5" />}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{orderTitle(h)}</p>
          <p className="text-[11px] text-muted-foreground">#{h.order_no} · {fmtDate(h.completed_at ?? h.cancelled_at)} · {h.customer.name ?? "عميل"}</p>
        </div>
        {h.rating ? <span className="flex items-center gap-0.5 text-xs font-bold shrink-0">{h.rating}<Star className="size-3.5 text-mohemah-gold fill-mohemah-gold" /></span> : <span className="text-[10px] text-muted-foreground shrink-0">{done ? "بدون تقييم" : "ملغى"}</span>}
      </button>
      {open && (
        <div className="border-t border-border p-4 space-y-2 text-xs">
          {h.description && <p className="text-muted-foreground">{h.description}</p>}
          <p>الرسوم: {h.billing_mode === "subscription" ? "ضمن الاشتراك" : `${h.charged_coins} كوين`}</p>
          {h.review && <p className="rounded-lg bg-mohemah-light p-2">ملاحظة العميل: {h.review}</p>}
          {done && !h.customer_rating && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex gap-1" dir="ltr">{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => setStars(n)} aria-label={`${n} نجوم`}><Star className={`size-6 ${n <= stars ? "text-mohemah-gold fill-mohemah-gold" : "text-muted-foreground/30"}`} /></button>)}</div>
              <button onClick={rateCustomer} className="mohemah-btn-primary px-3 py-1.5 text-xs">قيّم العميل</button>
            </div>
          )}
          {h.customer_rating && <p className="text-muted-foreground">تقييمك للعميل: {h.customer_rating} من 5</p>}
        </div>
      )}
    </div>
  );
}

function JobDetail({ job, onBack, onChanged }: { job: ActiveJob; onBack: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [chat, setChat] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [reason, setReason] = useState("");
  const steps = stepsFor(job.mode);
  const cur = steps.findIndex((s) => s.key === job.status);
  const maps = mapsUrl(job);

  const advance = async () => {
    setBusy(true);
    try {
      const r = await api<{ status: string }>(`/api/orders/${job.id}/advance`, { method: "POST" });
      toast.success(r.status === "completed" ? "أحسنت! تم إنهاء الطلب" : "تم تحديث حالة الطلب");
      onChanged();
      if (r.status === "completed") onBack();
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };
  const release = async () => {
    setBusy(true);
    try { await api(`/api/orders/${job.id}/release`, { body: { reason: reason.trim() || null } }); toast.success("تم الاعتذار عن الطلب وإعادته لمقدمي الخدمة"); onChanged(); onBack(); }
    catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mohemah-header-gradient text-primary-foreground px-4 pt-8 pb-5">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <button onClick={onBack} aria-label="رجوع"><X className="w-6 h-6" /></button>
          <h1 className="text-lg font-bold">رقم الطلب ({job.order_no})</h1>
          <div className="w-6" />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 mt-4 space-y-3">
        <div className="mohemah-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-mohemah-coral/20 flex items-center justify-center shrink-0"><UserIcon className="w-7 h-7 text-mohemah-coral" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-mohemah-coral truncate">{job.customer.name ?? "عميل"}</p>
              <p className="text-sm text-muted-foreground truncate">{orderTitle(job)} · {modeLabel(job.mode)}</p>
            </div>
            {job.customer.phone && <a href={`tel:${job.customer.phone}`} aria-label="اتصال بالعميل" className="grid size-10 place-items-center rounded-full bg-success/10 text-success"><Phone className="size-5" /></a>}
          </div>
          {job.description && <p className="mt-3 rounded-xl bg-mohemah-light p-3 text-sm leading-relaxed">{job.description}</p>}
          <div className="grid grid-cols-2 gap-2 mt-3 text-center">
            <div className="bg-mohemah-light rounded-xl p-2"><p className="text-xs text-muted-foreground">الموعد</p><p className="text-xs font-bold mt-0.5">{job.scheduled_at ? fmtDateTime(job.scheduled_at) : "في أقرب وقت"}</p></div>
            <div className="bg-mohemah-light rounded-xl p-2"><p className="text-xs text-muted-foreground">الرسوم</p><p className="text-xs font-bold mt-0.5">{job.billing_mode === "subscription" ? "ضمن الاشتراك" : `${job.charged_coins} كوين`}</p></div>
          </div>
          {job.mode === "in_person" && (
            <div className="flex items-start gap-2 mt-3">
              <MapPin className="w-4 h-4 text-mohemah-coral shrink-0 mt-0.5" />
              <span className="text-sm font-semibold">{[job.region, job.address].filter(Boolean).join(" - ") || "—"}</span>
            </div>
          )}
        </div>

        {job.mode === "in_person" && maps && (
          <a href={maps} target="_blank" rel="noopener noreferrer" className="w-full mohemah-card p-4 flex items-center justify-center gap-3 !bg-accent">
            <Navigation className="w-6 h-6 text-mohemah-blue" />
            <div className="text-right"><p className="text-sm font-bold text-mohemah-blue">فتح في خرائط قوقل</p><p className="text-[11px] text-muted-foreground">انتقل إلى موقع طالب الخدمة</p></div>
          </a>
        )}

        <div className="mohemah-card p-4">
          {steps.map((step, i) => {
            const isDone = i <= cur;
            return (
              <div key={step.key} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isDone ? "bg-mohemah-blue border-mohemah-blue" : "bg-card border-muted-foreground/30"}`}>
                    {isDone && <Check className="size-3 text-primary-foreground" />}
                  </div>
                  {i < steps.length - 1 && <div className={`w-0.5 h-8 ${i < cur ? "bg-mohemah-blue" : "bg-muted-foreground/20"}`} />}
                </div>
                <p className={`text-sm pt-0.5 ${i === cur ? "font-bold text-mohemah-blue" : isDone ? "font-semibold" : "text-muted-foreground"}`}>{step.label}</p>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          {["accepted", "arrived"].includes(job.status) && <button onClick={() => setReleasing(!releasing)} className="flex-1 mohemah-card p-3 text-center text-sm font-bold text-destructive">اعتذار عن الطلب</button>}
          <button onClick={() => setChat(true)} className="flex-1 mohemah-card p-3 text-center text-sm font-bold text-mohemah-blue flex items-center justify-center gap-2">
            <MessageCircle className="w-4 h-4" />مراسلة{job.unread > 0 ? ` (${job.unread})` : ""}
          </button>
        </div>
        {releasing && (
          <div className="mohemah-card p-3 space-y-2 border border-destructive/30">
            <p className="text-xs text-muted-foreground">سيعود الطلب لمقدمي الخدمة الآخرين ولن تُسترجع الكوينز المخصومة.</p>
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="سبب الاعتذار (اختياري)" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            <button disabled={busy} onClick={release} className="w-full py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold disabled:opacity-50">تأكيد الاعتذار</button>
          </div>
        )}

        <button disabled={busy} onClick={advance} className="w-full mohemah-btn-coral py-4 text-base font-bold rounded-2xl shadow-lg active:scale-[0.98] transition-transform disabled:opacity-50">
          {busy ? "جارٍ التحديث…" : advanceLabel(job)}
        </button>
      </div>
      {chat && <OrderChat orderId={job.id} title={`مراسلة ${job.customer.name ?? "العميل"}`} onClose={() => { setChat(false); onChanged(); }} />}
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
