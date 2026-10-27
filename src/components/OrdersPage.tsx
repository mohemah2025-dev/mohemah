import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { MessageCircle, AlertTriangle, Star, ChevronDown, ChevronUp, Clock, MapPin, CheckCircle2, Truck, DoorOpen, Wrench, CircleDot, User, Calendar, Search, Phone, Inbox } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { AdSpace } from "@/components/AdSpace";
import { ServiceIcon } from "@/components/ServiceAppearance";
import { useAuth } from "@/lib/AuthContext";
import { usePublicData } from "@/lib/publicData";
import { api, errMsg } from "@/lib/api";
import { useMyOrders, OrderChat, RateOrder, statusLabel, modeLabel, fmtDate, fmtTime, timeAgo, type CustomerOrder } from "@/lib/liveData";

const timelineSteps = [
  { key: "pending", label: "بانتظار قبول مقدم خدمة", icon: Search },
  { key: "accepted", label: "تم القبول — الفني في طريقه إليك", icon: Truck },
  { key: "arrived", label: "الفني عند الباب", icon: DoorOpen },
  { key: "in_progress", label: "جاري تنفيذ المهمة", icon: Wrench },
  { key: "completed", label: "تم تنفيذ المهمة", icon: CircleDot },
];
const remoteSteps = [
  { key: "pending", label: "بانتظار قبول مقدم خدمة", icon: Search },
  { key: "accepted", label: "تم قبول الطلب", icon: CheckCircle2 },
  { key: "in_progress", label: "جاري تنفيذ المهمة", icon: Wrench },
  { key: "completed", label: "تم تنفيذ المهمة", icon: CircleDot },
];

function RatingStars({ rating, size = "w-3.5 h-3.5" }: { rating: number; size?: string }) {
  return (
    <div className="flex gap-0.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`${size} ${i <= rating ? "text-mohemah-gold fill-mohemah-gold" : "text-muted-foreground/30"}`} />)}
    </div>
  );
}

export function OrdersPage() {
  const { user, loading } = useAuth();
  const { orders, reload } = useMyOrders();
  const [activeTab, setActiveTab] = useState<"active" | "past">("active");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [chatFor, setChatFor] = useState<CustomerOrder | null>(null);

  const active = (orders ?? []).filter((o) => !["completed", "cancelled"].includes(o.status));
  const past = (orders ?? []).filter((o) => ["completed", "cancelled"].includes(o.status));
  const list = activeTab === "active" ? active : past;

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader />
      <div className="max-w-lg mx-auto px-4 mt-4">
        <AdSpace className="mb-6" />

        {!loading && !user ? (
          <div className="mohemah-card p-6 text-center text-sm space-y-3">
            <p>سجّل دخولك لعرض طلباتك ومتابعتها</p>
            <Link to="/auth" className="mohemah-btn-primary inline-block px-6 py-2">تسجيل الدخول</Link>
          </div>
        ) : (
          <>
            <div className="flex border-b border-border mb-4" role="tablist">
              {([["active", "طلبات جارية", active.length], ["past", "طلبات سابقة", past.length]] as const).map(([k, label, n]) => (
                <button key={k} role="tab" aria-selected={activeTab === k} onClick={() => setActiveTab(k)}
                  className={`flex-1 py-3 text-sm font-bold text-center transition-colors ${activeTab === k ? "text-mohemah-blue border-b-3 border-mohemah-coral" : "text-muted-foreground"}`}>
                  {label}
                  {k === "active" && n > 0 && <span className="mr-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-mohemah-coral text-primary-foreground text-xs font-bold">{n}</span>}
                </button>
              ))}
            </div>

            {orders === null ? <p className="text-center text-sm text-muted-foreground py-10">جارٍ تحميل طلباتك…</p>
              : !list.length ? (
                <div className="text-center py-14 text-muted-foreground space-y-3">
                  <Inbox className="size-10 mx-auto opacity-40" />
                  <p className="text-sm">{activeTab === "active" ? "لا توجد طلبات جارية" : "لا توجد طلبات سابقة"}</p>
                  <Link to="/services" search={{ category: "", subService: "" }} className="mohemah-btn-primary inline-block px-6 py-2 text-sm">اطلب مهمة جديدة</Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {list.map((o) => (
                    <OrderCard key={o.id} order={o} open={expanded === o.id} onToggle={() => setExpanded(expanded === o.id ? null : o.id)} onChat={() => setChatFor(o)} onChanged={reload} />
                  ))}
                </div>
              )}
          </>
        )}
      </div>

      {chatFor && <OrderChat orderId={chatFor.id} title={`مراسلة ${chatFor.provider?.name ?? "مقدم الخدمة"}`} readOnly={chatFor.status === "cancelled"} onClose={() => { setChatFor(null); reload(); }} />}
    </div>
  );
}

function OrderCard({ order: o, open, onToggle, onChat, onChanged }: { order: CustomerOrder; open: boolean; onToggle: () => void; onChat: () => void; onChanged: () => void }) {
  const { subs, services } = usePublicData();
  const navigate = useNavigate();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [complaint, setComplaint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sub = subs.find((s) => s.id === o.sub_service_id);
  const svc = services.find((s) => s.id === o.service_id);
  const steps = o.mode === "remote" ? remoteSteps : timelineSteps;
  const current = Math.max(0, steps.findIndex((s) => s.key === o.status));
  const isPast = ["completed", "cancelled"].includes(o.status);

  const cancel = async () => {
    setBusy(true);
    // After a provider accepted, a reason is required (it is reviewed by the administration).
    const reason = o.status === "accepted" ? window.prompt("سبب الإلغاء (مثال: عدم الموافقة على المبلغ)")?.trim() : "";
    if (o.status === "accepted" && !reason) { setBusy(false); return toast.error("اكتب سبب الإلغاء"); }
    try { await api(`/api/orders/${o.id}/cancel`, { body: reason ? { reason } : {} }); toast.success("تم إلغاء الطلب"); onChanged(); }
    catch (e) { toast.error(errMsg(e)); }
    setBusy(false); setConfirmCancel(false);
  };
  const sendComplaint = async () => {
    if (!complaint?.trim()) return toast.error("اكتب تفاصيل الشكوى");
    try { await api("/api/me/messages", { body: { subject: `شكوى على الطلب #${o.order_no}`, body: complaint.trim() } }); toast.success("وصلت شكواك للإدارة وسنتواصل معك"); setComplaint(null); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const reorder = () => navigate({ to: "/services", search: { category: svc?.name ?? o.service_name, subService: sub?.name ?? "" } });

  return (
    <div className="mohemah-card overflow-hidden">
      <button onClick={onToggle} className="w-full p-4 flex items-center gap-3 text-right active:bg-mohemah-light/50 transition-colors">
        <ServiceIcon icon={sub?.icon ?? svc?.icon} color={sub?.color ?? svc?.color} className="size-12 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold text-sm truncate">{o.sub_service_name ?? o.service_name}</p>
            <span className="flex items-center gap-1 shrink-0 text-xs text-muted-foreground">#{o.order_no}{open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
          </div>
          <p className="flex items-center gap-1 mt-1 text-xs text-muted-foreground"><MapPin className="w-3 h-3" />{o.mode === "remote" ? "عن بُعد" : o.region}{o.unread > 0 && <span className="mr-2 font-bold text-mohemah-coral">· {o.unread} رسالة جديدة</span>}</p>
          <p className={`flex items-center gap-1 mt-0.5 text-xs font-semibold ${o.status === "cancelled" ? "text-muted-foreground" : o.status === "completed" ? "text-success" : "text-mohemah-blue"}`}>
            <Clock className="w-3 h-3" />{o.status === "pending" ? `${statusLabel.pending} · ${timeAgo(o.created_at)}` : o.status === "cancelled" ? `ملغى${o.cancelled_by === "customer" ? " بواسطتك" : ""}` : steps[current]?.label ?? statusLabel[o.status]}
          </p>
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Info label="التاريخ" icon={Calendar} value={fmtDate(o.created_at)} />
            <Info label="الوقت" icon={Clock} value={fmtTime(o.created_at)} />
            <Info label="نوع الخدمة" value={modeLabel(o.mode)} />
            <Info label="الموعد" value={o.scheduled_at ? `${fmtDate(o.scheduled_at)} ${fmtTime(o.scheduled_at)}` : "في أقرب وقت"} />
          </div>
          {o.description && (
            <div className="mt-3 p-3 bg-mohemah-light rounded-xl">
              <p className="text-xs font-bold mb-1 text-mohemah-blue">تفاصيل الطلب</p>
              <p className="text-sm leading-relaxed">{o.description}</p>
              {o.address && <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><MapPin className="size-3" />{o.address}</p>}
            </div>
          )}

          {o.provider ? (
            <div className="mt-3 flex items-center gap-3 p-3 bg-mohemah-blue/5 rounded-xl border border-mohemah-blue/10">
              <div className="w-10 h-10 rounded-full bg-mohemah-blue/10 flex items-center justify-center shrink-0"><User className="w-5 h-5 text-mohemah-blue" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{o.provider.name ?? "مقدم الخدمة"}</p>
                <p className="text-xs text-muted-foreground">{o.provider.rating_count ? `⭐ ${Number(o.provider.rating).toFixed(1)} · ` : ""}{o.provider.nationality ?? "مقدم الخدمة"}</p>
              </div>
              {o.provider.phone && <a href={`tel:${o.provider.phone}`} aria-label="اتصال بمقدم الخدمة" className="grid size-9 place-items-center rounded-full bg-success/10 text-success"><Phone className="size-4" /></a>}
            </div>
          ) : o.status === "pending" && <p className="mt-3 rounded-xl bg-mohemah-light p-3 text-xs text-muted-foreground">طلبك ظاهر لمقدمي الخدمة في مدينتك، وسنُشعرك فور قبوله.</p>}

          {o.status !== "cancelled" && (
            <div className="mt-4 px-1">
              {steps.map((step, i) => {
                const done = i < current || o.status === "completed";
                const cur = i === current && o.status !== "completed";
                const Icon = step.icon;
                return (
                  <div key={step.key} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${done ? "bg-mohemah-blue text-primary-foreground" : cur ? "bg-mohemah-coral text-primary-foreground ring-4 ring-mohemah-coral/20" : "bg-mohemah-gray text-muted-foreground"}`}><Icon className="w-4 h-4" /></div>
                      {i < steps.length - 1 && <div className={`w-0.5 h-6 my-1 rounded-full ${done ? "bg-mohemah-blue" : "bg-border"}`} />}
                    </div>
                    <p className={`pt-2 text-sm font-semibold ${done ? "text-mohemah-blue" : cur ? "text-mohemah-coral" : "text-muted-foreground"}`}>{step.label}</p>
                  </div>
                );
              })}
            </div>
          )}
          {o.status === "cancelled" && o.cancel_reason && <p className="mt-3 text-xs text-muted-foreground">سبب الإلغاء: {o.cancel_reason}</p>}

          {o.status === "completed" && (
            o.rating ? (
              <div className="mt-3 p-3 bg-mohemah-gold/5 rounded-xl border border-mohemah-gold/20"><p className="text-xs font-bold mb-1.5">تقييمك للخدمة</p><RatingStars rating={o.rating} size="w-5 h-5" />{o.review && <p className="text-xs text-muted-foreground mt-1">{o.review}</p>}</div>
            ) : <div className="mt-3 p-3 rounded-xl border border-border"><RateOrder id={o.id} onDone={onChanged} /></div>
          )}

          <div className="flex gap-2 mt-4">
            {o.provider && o.status !== "cancelled" && (
              <button onClick={onChat} className="flex-1 mohemah-btn-primary py-2.5 flex items-center justify-center gap-2 text-sm"><MessageCircle className="w-4 h-4" />مراسلة{o.unread ? ` (${o.unread})` : ""}</button>
            )}
            {isPast && sub && <button onClick={reorder} className="flex-1 mohemah-btn-coral py-2.5 text-sm">إعادة طلب</button>}
            <button onClick={() => setComplaint(complaint === null ? "" : null)} className="flex-1 bg-muted-foreground/20 text-foreground py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"><AlertTriangle className="w-4 h-4" />شكوى</button>
          </div>
          {complaint !== null && (
            <div className="mt-2 space-y-2">
              <textarea value={complaint} onChange={(e) => setComplaint(e.target.value)} maxLength={2000} rows={3} placeholder="اكتب تفاصيل الشكوى وستصل للإدارة" className="w-full rounded-xl border border-border bg-background p-3 text-sm" />
              <button onClick={sendComplaint} className="w-full rounded-xl bg-foreground text-background py-2 text-sm font-bold">إرسال الشكوى</button>
            </div>
          )}
          {["pending", "accepted"].includes(o.status) && (
            confirmCancel ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button disabled={busy} onClick={cancel} className="rounded-xl bg-destructive text-destructive-foreground py-2.5 text-sm font-semibold disabled:opacity-50">تأكيد الإلغاء</button>
                <button onClick={() => setConfirmCancel(false)} className="rounded-xl bg-muted py-2.5 text-sm font-semibold">تراجع</button>
              </div>
            ) : <button onClick={() => setConfirmCancel(true)} className="w-full bg-muted-foreground/60 text-primary-foreground py-2.5 mt-2 rounded-xl font-semibold text-sm">إلغاء الطلب</button>
          )}
        </div>
      )}
    </div>
  );
}

function Info({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="p-3 bg-mohemah-light rounded-xl">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="flex items-center gap-1.5 text-sm font-semibold">{Icon && <Icon className="w-3.5 h-3.5 text-mohemah-blue" />}{value}</p>
    </div>
  );
}
