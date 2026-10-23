import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Send } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { usePublicData } from "@/lib/publicData";
import { ProviderApplicationStatus } from "@/components/ProviderApplication";
import { useProvider } from "@/components/ProviderContext";
import { fmtDateTime } from "@/lib/liveData";

interface Msg { id: string; subject: string | null; body: string; created_at: string; sender_id: string | null; recipient_id: string | null; sender_name: string | null; read_at: string | null }

/** Messages with administration (inbox + new message). Used in both apps. */
export function AdminInbox() {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [compose, setCompose] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const load = useCallback(async () => { try { setMsgs(await api<Msg[]>("/api/me/messages")); } catch { /* ignore */ } }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    msgs.filter((m) => m.recipient_id === user?.id && !m.read_at).forEach((m) => api(`/api/me/messages/${m.id}/read`, { method: "POST" }).catch(() => {}));
  }, [msgs, user?.id]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      await api("/api/me/messages", { body: { body, subject: replyTo ? `رد: ${replyTo.subject ?? "رسالة"}` : "رسالة للإدارة", recipient_id: replyTo?.sender_id ?? undefined } });
      toast.success("تم إرسال رسالتك");
      setText(""); setReplyTo(null); setCompose(false); load();
    } catch (e) { toast.error(errMsg(e, "تعذّر الإرسال")); }
    setSending(false);
  };

  const form = (
    <form onSubmit={(e) => { e.preventDefault(); send(); }} className="mt-2 flex items-center gap-2">
      <input autoFocus value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="اكتب رسالتك..." aria-label="نص الرسالة"
        className="flex-1 min-w-0 rounded-xl bg-muted px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      <button type="submit" disabled={sending || !text.trim()} className="mohemah-btn-primary flex items-center gap-1 px-3 py-2 text-xs disabled:opacity-50"><Send className="size-3.5" />ارسل</button>
      <button type="button" onClick={() => { setReplyTo(null); setCompose(false); }} className="text-xs text-muted-foreground">إلغاء</button>
    </form>
  );

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold">الرسائل مع الإدارة</h2>
        {!compose && <button onClick={() => { setCompose(true); setReplyTo(null); setText(""); }} className="text-xs font-bold text-primary">رسالة جديدة</button>}
      </div>
      {compose && <div className="mohemah-card p-3 mb-2">{form}</div>}
      <div className="space-y-2">
        {msgs.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`mohemah-card p-3 ${mine ? "bg-accent/40" : ""}`}>
              <p className="text-[10px] text-muted-foreground">{mine ? "أنت ← الإدارة" : `${m.sender_name ?? "الإدارة"}`}</p>
              {m.subject && <p className="text-sm font-bold">{m.subject}</p>}
              <p className="text-sm whitespace-pre-wrap">{m.body}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="text-[10px] text-muted-foreground">{fmtDateTime(m.created_at)}</p>
                {!mine && replyTo?.id !== m.id && <button onClick={() => { setReplyTo(m); setCompose(false); setText(""); }} className="text-xs font-bold text-primary">رد</button>}
              </div>
              {replyTo?.id === m.id && form}
            </div>
          );
        })}
        {msgs.length === 0 && <p className="text-xs text-muted-foreground">لا توجد رسائل.</p>}
      </div>
    </section>
  );
}

export function ProviderServicesSetup() {
  const { user, isProvider } = useAuth();
  const { services } = usePublicData();
  const { reload } = useProvider();
  const [mine, setMine] = useState<Set<string>>(new Set());

  useEffect(() => { if (user) api<string[]>("/api/provider/services").then((ids) => setMine(new Set(ids))).catch(() => {}); }, [user?.id]);

  const toggle = async (id: string) => {
    if (!isProvider) return toast.error("تعديل الخدمات متاح بعد تفعيل حسابك");
    const next = new Set(mine);
    if (next.has(id)) next.delete(id); else next.add(id);
    setMine(next);
    try { setMine(new Set(await api<string[]>("/api/provider/services", { method: "PUT", body: { ids: [...next] } }))); reload(); }
    catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="min-h-screen bg-background pb-24" dir="rtl">
      <header className="mohemah-header-gradient text-primary-foreground px-4 pt-8 pb-5">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link to="/provider/account" className="opacity-90" aria-label="رجوع"><ChevronRight className="w-6 h-6" /></Link>
          <h1 className="text-lg font-bold">خدماتي والرسائل</h1>
          <div className="w-6" />
        </div>
      </header>
      <div className="max-w-lg mx-auto px-4 mt-4 space-y-4">
        {!user ? <Link to="/provider/auth" className="mohemah-btn-coral block text-center py-2">سجّل الدخول أولاً</Link> : (
          <>
            {!isProvider && <ProviderApplicationStatus />}
            <section>
              <h2 className="text-sm font-bold mb-2">اختر الخدمات التي تقدمها</h2>
              <p className="text-xs text-muted-foreground mb-2">ستصلك الطلبات الجديدة الخاصة بهذه الخدمات فقط.</p>
              <div className="space-y-2">
                {services.map((s) => (
                  <label key={s.id} className="mohemah-card p-3 flex items-center justify-between cursor-pointer">
                    <span className="text-sm font-bold">{s.name}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {s.coin_price} كوين/طلب
                      <input type="checkbox" checked={mine.has(s.id)} onChange={() => toggle(s.id)} disabled={!isProvider} className="w-4 h-4" />
                    </span>
                  </label>
                ))}
                {services.length === 0 && <p className="text-xs text-muted-foreground">لا توجد خدمات بعد.</p>}
              </div>
            </section>
            <AdminInbox />
          </>
        )}
      </div>
    </div>
  );
}
