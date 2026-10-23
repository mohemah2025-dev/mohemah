import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { MapPin, Clock, Star, X, Check, Minimize2 } from "lucide-react";
import { toast } from "sonner";
import { useProvider, INCOMING_TTL_MS, orderTitle } from "./ProviderContext";
import { fmtDateTime } from "@/lib/liveData";

export function ProviderIncomingModal() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { pendingIncoming, acceptOrder, rejectOrder, incomingMinimized, setIncomingMinimized, feed } = useProvider();
  const [remaining, setRemaining] = useState(INCOMING_TTL_MS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pendingIncoming) return;
    const tick = () => setRemaining(Math.max(0, pendingIncoming.expiresAt - Date.now()));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [pendingIncoming]);

  if (!path.startsWith("/provider") || path.startsWith("/provider/auth")) return null;
  if (!pendingIncoming || incomingMinimized) return null;

  const r = pendingIncoming;
  const covered = !!feed?.subscription_end;

  const onAccept = async () => {
    setBusy(true);
    const res = await acceptOrder(r.id);
    setBusy(false);
    if (res.ok) { toast.success(res.reason ?? "تم قبول الطلب"); navigate({ to: "/provider/orders" }); }
    else {
      toast.error(res.reason ?? "تعذر قبول الطلب");
      if (res.error === "insufficient_balance") navigate({ to: "/provider/coins" });
      if (res.error === "subscription_required") navigate({ to: "/provider/billing" });
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" role="dialog" aria-modal="true" aria-label="طلب وارد جديد">
      <div className="bg-card w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="h-1.5 bg-mohemah-light"><div className="h-full bg-mohemah-coral transition-all duration-200" style={{ width: `${(remaining / INCOMING_TTL_MS) * 100}%` }} /></div>
        <div className="bg-gradient-to-l from-mohemah-coral to-mohemah-blue text-primary-foreground px-5 py-4 flex items-center justify-between">
          <button onClick={() => setIncomingMinimized(true)} aria-label="تصغير" className="p-1.5 rounded-full bg-white/20 active:scale-95"><Minimize2 className="w-4 h-4" /></button>
          <div className="text-center">
            <p className="text-xs opacity-90">طلب وارد جديد #{r.order_no}</p>
            <p className="text-lg font-bold">يبقى {Math.ceil(remaining / 1000)} ثانية</p>
          </div>
          <span className={`text-[10px] px-2 py-1 rounded-full font-bold bg-white ${r.mode === "in_person" ? "text-mohemah-coral" : "text-mohemah-blue"}`}>{r.mode === "in_person" ? "حضوري" : "عن بُعد"}</span>
        </div>

        <div className="p-5 space-y-4 text-right">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-mohemah-coral/15 flex items-center justify-center shrink-0"><UserIcon className="w-8 h-8 text-mohemah-coral" /></div>
            <div className="flex-1">
              <p className="text-base font-bold">{r.customer.name}</p>
              <div className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground">
                <Star className="w-3.5 h-3.5 text-mohemah-gold fill-mohemah-gold" />
                {r.customer.rating_count ? <span className="font-bold text-foreground">{r.customer.rating.toFixed(1)}</span> : null}
                <span>{r.customer.rating_count ? "تقييم العميل" : "عميل جديد"}</span>
              </div>
            </div>
          </div>

          <div className="bg-mohemah-light rounded-2xl p-3">
            <p className="text-xs text-muted-foreground">الخدمة المطلوبة</p>
            <p className="text-sm font-bold text-mohemah-coral mt-0.5">{orderTitle(r)}</p>
            {r.description && <p className="text-xs text-foreground mt-1.5 leading-relaxed">{r.description}</p>}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-mohemah-light rounded-xl p-2.5">
              <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-mohemah-coral" /><span className="text-[11px] text-muted-foreground">المكان</span></div>
              <p className="text-xs font-bold mt-1">{r.mode === "remote" ? "عن بُعد" : r.region ?? "—"}</p>
              {r.mode === "in_person" && <p className="text-[10px] text-muted-foreground">يظهر العنوان بعد القبول</p>}
            </div>
            <div className="bg-mohemah-light rounded-xl p-2.5">
              <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-mohemah-blue" /><span className="text-[11px] text-muted-foreground">الموعد</span></div>
              <p className="text-xs font-bold mt-1">{r.scheduled_at ? fmtDateTime(r.scheduled_at) : "في أقرب وقت"}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button onClick={() => rejectOrder(r.id)} disabled={busy} className="py-3 rounded-2xl bg-mohemah-light text-sm font-bold text-destructive flex items-center justify-center gap-2 disabled:opacity-50">
              <X className="w-4 h-4" />رفض
            </button>
            <button onClick={onAccept} disabled={busy} className="py-3 rounded-2xl mohemah-btn-coral text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
              <Check className="w-4 h-4" />{covered ? "قبول (ضمن اشتراكك)" : `قبول (${r.coin_cost} كوين)`}
            </button>
          </div>
        </div>
      </div>
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
