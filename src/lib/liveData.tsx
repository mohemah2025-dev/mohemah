import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Send, Star, X } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { usePublicData } from "@/lib/publicData";

export type { LiveService, LiveSub } from "@/lib/publicData";

export function useLiveServices() {
  const { services, loading } = usePublicData();
  return { services, loading };
}

export type OrderStatus = "pending" | "accepted" | "arrived" | "in_progress" | "completed" | "cancelled";

export const statusLabel: Record<OrderStatus, string> = {
  pending: "بانتظار مقدم خدمة",
  accepted: "تم القبول",
  arrived: "مقدم الخدمة عند الباب",
  in_progress: "قيد التنفيذ",
  completed: "مكتملة",
  cancelled: "ملغاة",
};

export const modeLabel = (m: string) => (m === "remote" ? "عن بُعد" : "حضوري");

export interface CustomerOrder {
  id: string; order_no: number; service_id: string | null; sub_service_id: string | null; service_name: string; sub_service_name: string | null;
  mode: "in_person" | "remote"; description: string | null; address: string | null; region: string | null; scheduled_at: string | null;
  status: OrderStatus; rating: number | null; review: string | null; cancelled_by: string | null; cancel_reason: string | null;
  created_at: string; accepted_at: string | null; arrived_at: string | null; started_at: string | null; completed_at: string | null; cancelled_at: string | null;
  unread: number;
  provider: { id: string; name: string | null; rating: number | null; rating_count: number | null; nationality: string | null; phone: string | null } | null;
}

/** Customer's orders, refreshed every 10 seconds while mounted. */
export function useMyOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const load = useCallback(async () => {
    if (!user) { setOrders([]); return; }
    try { setOrders(await api<CustomerOrder[]>("/api/orders/mine")); } catch { /* keep last */ }
  }, [user?.id]);
  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);
  return { orders, reload: load };
}

export const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { year: "numeric", month: "long", day: "numeric" }) : "—";
export const fmtTime = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleTimeString("ar-SA-u-nu-latn", { hour: "numeric", minute: "2-digit" }) : "—";
export const fmtDateTime = (d: string | null | undefined) => (d ? `${fmtDate(d)} · ${fmtTime(d)}` : "—");

export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "الآن";
  if (s < 3600) return `منذ ${Math.floor(s / 60)} دقيقة`;
  if (s < 86400) return `منذ ${Math.floor(s / 3600)} ساعة`;
  if (s < 172800) return "أمس";
  if (s < 604800) return `منذ ${Math.floor(s / 86400)} أيام`;
  return fmtDate(iso);
}

/** Google Maps directions link from coordinates, or a search by address text. */
export function mapsUrl(o: { lat?: number | null; lng?: number | null; address?: string | null; region?: string | null }) {
  if (o.lat != null && o.lng != null) return `https://www.google.com/maps/dir/?api=1&destination=${o.lat},${o.lng}&travelmode=driving`;
  const q = [o.address, o.region].filter(Boolean).join("، ");
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}

/** Customer rates a completed order; low ratings require a reason. */
export function RateOrder({ id, onDone }: { id: string; onDone?: () => void }) {
  const [stars, setStars] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!stars) return toast.error("اختر عدد النجوم");
    if (stars <= 2 && !note.trim()) return toast.error("اكتب سبب التقييم المنخفض");
    setBusy(true);
    try {
      await api(`/api/orders/${id}/rate`, { body: { rating: stars, review: note.trim() || null } });
      toast.success("شكرًا لتقييمك");
      onDone?.();
    } catch (e) { toast.error(errMsg(e, "تعذّر إرسال التقييم")); }
    setBusy(false);
  };
  return (
    <div className="space-y-2 text-right">
      <div className="flex items-center justify-between">
        <div className="flex gap-1" dir="ltr">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" aria-label={`${n} نجوم`} onClick={() => setStars(n)}>
              <Star className={`w-7 h-7 ${n <= stars ? "text-mohemah-gold fill-mohemah-gold" : "text-muted-foreground/30"}`} />
            </button>
          ))}
        </div>
        <span className="text-xs font-bold">قيّم الخدمة</span>
      </div>
      {stars > 0 && (
        <>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500}
            placeholder={stars <= 2 ? "ما سبب التقييم المنخفض؟" : "ملاحظة (اختياري)"}
            className="w-full rounded-xl border border-border bg-background p-2 text-xs" />
          <button disabled={busy} onClick={send} className="w-full mohemah-btn-primary py-2 text-sm disabled:opacity-50">إرسال التقييم</button>
        </>
      )}
    </div>
  );
}

type ChatMsg = { id: string; sender_id: string; body: string; created_at: string };

/** Order chat between the customer and the provider (polls every 5 seconds while open). */
export function OrderChat({ orderId, title, onClose, readOnly }: { orderId: string; title: string; onClose: () => void; readOnly?: boolean }) {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    try { setMsgs(await api<ChatMsg[]>(`/api/orders/${orderId}/messages`)); } catch { /* ignore */ }
  }, [orderId]);
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);
  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      const m = await api<ChatMsg>(`/api/orders/${orderId}/messages`, { body: { body } });
      setMsgs((p) => [...p, m]);
      setText("");
    } catch (e) { toast.error(errMsg(e, "تعذّر إرسال الرسالة")); }
    setBusy(false);
  };
  return (
    <div className="fixed inset-0 bg-foreground/40 z-[90] flex flex-col">
      <div className="flex-1" onClick={onClose} />
      <div className="bg-card rounded-t-3xl flex flex-col max-h-[85dvh] mx-auto w-full max-w-lg">
        <div className="mohemah-btn-coral rounded-t-3xl p-4 flex items-center justify-between">
          <button onClick={onClose} aria-label="إغلاق"><X className="w-5 h-5 text-primary-foreground" /></button>
          <p className="font-bold text-primary-foreground">{title}</p>
          <span className="w-5" />
        </div>
        <div className="flex-1 p-4 overflow-y-auto min-h-[260px] space-y-3">
          {!msgs.length && <p className="text-center text-xs text-muted-foreground py-10">لا توجد رسائل بعد، ابدأ المحادثة</p>}
          {msgs.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
                <div className={`rounded-2xl p-3 max-w-[80%] text-sm text-right ${mine ? "bg-primary text-primary-foreground rounded-tl-sm" : "bg-muted text-foreground rounded-tr-sm"}`}>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`mt-1 text-[10px] ${mine ? "opacity-80" : "text-muted-foreground"}`}>{fmtTime(m.created_at)}</p>
                </div>
              </div>
            );
          })}
          <div ref={end} />
        </div>
        {readOnly ? (
          <p className="p-3 border-t border-border text-center text-xs text-muted-foreground">المحادثة مغلقة لهذا الطلب</p>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="p-3 border-t border-border flex items-center gap-2" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="اكتب رسالة..." aria-label="نص الرسالة"
              className="flex-1 min-w-0 bg-muted rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            <button type="submit" disabled={busy || !text.trim()} className="mohemah-btn-primary px-4 py-2.5 text-sm rounded-xl flex items-center gap-1 disabled:opacity-50">
              <Send className="w-4 h-4" />ارسل
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
