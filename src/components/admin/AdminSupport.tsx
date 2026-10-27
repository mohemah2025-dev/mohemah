import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Ban, CheckCircle2, Clock, Inbox, Languages, MessageSquarePlus, Send, Star, UserCheck, XCircle } from "lucide-react";
import { api, errMsg, fileUrl } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

const adm = <T,>(path: string, opts: { method?: string; body?: unknown } = {}) => api<T>(path, { ...opts, app: "admin" });

type Status = "unanswered" | "ongoing" | "closed";
interface Thread {
  id: string; user_id: string; subject: string | null; status: string; last_from: string; last_message_at: string; closed_at: string | null; closed_by: string | null;
  rating: number | null; rating_note: string | null; user_name: string | null; user_phone: string | null; member_no: number | null; user_kind: "customer" | "provider";
  assigned_to: string | null; assigned_name: string | null; last_body: string | null; count: number;
}
interface Msg {
  id: string; body: string; subject?: string | null; created_at: string; sender_id: string; sender_name: string | null; from_user?: number; from_customer?: number;
  kind?: string; translated?: string | null; original_lang?: string | null; audio_url?: string | null;
}
const LANG_NAMES: Record<string, string> = { ar: "العربية", en: "الإنجليزية", ur: "الأردو" };

/** Message content: Arabic translation (original kept below), voice player, price events. */
function MsgBody({ m }: { m: Msg }) {
  const kind = m.kind ?? "text";
  if (kind === "price") return <p className="font-bold">💰 عرض مبلغ الخدمة: {m.body} ريال</p>;
  if (kind === "price_negotiable") return <p className="font-bold">💬 المبلغ بالتفاوض في المحادثة</p>;
  if (kind === "price_agreed") return <p className="font-bold">✅ وافق العميل على مبلغ {m.body} ريال</p>;
  return (
    <>
      {m.audio_url && <audio controls preload="none" src={fileUrl(m.audio_url)} className="h-9 max-w-full my-1" />}
      {m.translated ? (
        <>
          <p className="whitespace-pre-line">{m.translated}</p>
          <p className="text-[11px] opacity-75 mt-1 border-t border-current/20 pt-1 flex items-start gap-1"><Languages className="w-3 h-3 mt-0.5 shrink-0" />الأصل ({LANG_NAMES[m.original_lang ?? ""] ?? m.original_lang}): {m.body}</p>
        </>
      ) : m.body ? <p className="whitespace-pre-line">{m.body}</p> : m.audio_url ? <p className="text-[11px] opacity-75">رسالة صوتية</p> : null}
    </>
  );
}
interface Person { id: string; full_name: string | null; phone: string | null; member_no: number | null }

const TABS: { k: Status; label: string; icon: typeof Inbox }[] = [
  { k: "unanswered", label: "لم يتم الرد", icon: Inbox },
  { k: "ongoing", label: "جارية", icon: Clock },
  { k: "closed", label: "منتهية", icon: CheckCircle2 },
];
const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `قبل ${m} د`;
  if (m < 1440) return `قبل ${Math.round(m / 60)} س`;
  return `قبل ${Math.round(m / 1440)} يوم`;
};
const closedBy = (v: string | null) => (v === "user" ? "أنهاها المستخدم" : v === "auto" ? "أُغلقت تلقائياً لعدم الرد" : "أنهتها الإدارة");

/** Support center: conversations with customers and providers, by status, with reply, assignment, closing and rating. */
export function AdminSupportPage() {
  const { user, isOwner, features } = useAuth();
  // Every admin account sees and answers messages; per-page actions can still restrict some of them.
  const allow = (a: string) => isOwner || !features?.messages || features.messages.includes(a);
  const canEdit = allow("start");
  const [tab, setTab] = useState<Status>("unanswered");
  const [data, setData] = useState<{ threads: Thread[]; counts: Record<Status, number>; staff: { id: string; full_name: string | null }[]; auto_close_hours: number } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [q, setQ] = useState("");
  const [view, setView] = useState<"threads" | "cancels">("threads");

  const load = () => adm<typeof data>(`/api/admin/support?status=${tab}`).then(setData).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [tab]);

  const list = (data?.threads ?? []).filter((t) => !q.trim() || (t.user_name ?? "").includes(q) || (t.user_phone ?? "").includes(q) || String(t.member_no ?? "").includes(q.replace("#", "")));

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">الرسائل والدعم</h1>
          <p className="text-xs text-muted-foreground">تُغلق المحادثة عند إنهائها من الإدارة أو من المستخدم، أو تلقائياً بعد {data?.auto_close_hours ?? 48} ساعة من آخر رد للإدارة دون تجاوب، ثم يقيّمها المستخدم.</p>
        </div>
        {canEdit && <button onClick={() => setNewOpen(true)} className="mohemah-btn-coral text-sm px-4 py-2 rounded-xl flex items-center gap-2"><MessageSquarePlus className="w-4 h-4" />محادثة جديدة</button>}
      </div>

      <div className="flex gap-2">
        <button onClick={() => setView("threads")} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${view === "threads" ? "bg-foreground text-background" : "bg-card border-border"}`}>المحادثات مع الإدارة</button>
        <button onClick={() => setView("cancels")} className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1 ${view === "cancels" ? "bg-foreground text-background" : "bg-card border-border"}`}><Ban className="w-3.5 h-3.5" />أسباب إلغاء الطلبات</button>
      </div>
      {view === "cancels" ? <Cancellations /> : <>
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const n = data?.counts?.[t.k] ?? 0;
          return (
            <button key={t.k} onClick={() => setTab(t.k)} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 border ${tab === t.k ? "bg-primary text-primary-foreground border-transparent" : "bg-card border-border"}`}>
              <Icon className="w-4 h-4" />{t.label}<span className={`text-[11px] px-2 rounded-full ${tab === t.k ? "bg-white/25" : t.k === "unanswered" && n ? "bg-red-100 text-red-700" : "bg-muted"}`}>{n}</span>
            </button>
          );
        })}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الجوال أو الرقم #" className="admin-input max-w-xs mr-auto" />
      </div>

      <div className="bg-card border border-border rounded-2xl divide-y divide-border">
        {list.map((t) => (
          <button key={t.id} onClick={() => setOpenId(t.id)} className="w-full text-right p-3 hover:bg-mohemah-light/50 flex items-start gap-3">
            <div className={`w-10 h-10 rounded-full grid place-items-center text-sm font-bold shrink-0 ${t.user_kind === "provider" ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"}`}>{(t.user_name ?? "؟").slice(0, 1)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <b className="text-sm">{t.user_name ?? "—"}</b>
                {t.member_no && <span className="text-[11px] text-muted-foreground" dir="ltr">#{t.member_no}</span>}
                <span className="text-[10px] px-2 rounded-full bg-muted">{t.user_kind === "provider" ? "مقدم خدمة" : "طالب خدمة"}</span>
                {t.assigned_name && <span className="text-[10px] px-2 rounded-full bg-violet-50 text-violet-700 flex items-center gap-1"><UserCheck className="w-3 h-3" />{t.assigned_name}</span>}
                {t.rating && <span className="text-[11px] text-amber-600">{"★".repeat(t.rating)}</span>}
                <span className="text-[11px] text-muted-foreground mr-auto">{ago(t.last_message_at)}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{t.last_from === "admin" ? "أنت: " : ""}{t.last_body ?? ""}</p>
              {t.status === "closed" && <p className="text-[11px] text-muted-foreground">{closedBy(t.closed_by)}</p>}
            </div>
          </button>
        ))}
        {!list.length && <p className="p-6 text-center text-sm text-muted-foreground">لا توجد محادثات هنا.</p>}
      </div>
      </>}

      {openId && <ThreadDialog id={openId} meId={user?.id ?? ""} isOwner={isOwner} allow={allow} staff={data?.staff ?? []} onClose={() => { setOpenId(null); load(); }} />}
      {newOpen && <NewThreadDialog onClose={() => setNewOpen(false)} onStarted={(id) => { setNewOpen(false); setTab("ongoing"); setOpenId(id); }} />}
    </div>
  );
}

function ThreadDialog({ id, meId, isOwner, allow, staff, onClose }: { id: string; meId: string; isOwner: boolean; allow: (a: string) => boolean; staff: { id: string; full_name: string | null }[]; onClose: () => void }) {
  const [transferTo, setTransferTo] = useState("");
  const [d, setD] = useState<{ thread: Thread; messages: Msg[] } | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const load = () => adm<{ thread: Thread; messages: Msg[] }>(`/api/admin/support/${id}`).then(setD).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [id]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [d?.messages.length]);

  const reply = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try { await adm(`/api/admin/support/${id}/reply`, { body: { body: text.trim() } }); setText(""); await load(); } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };
  const close = async () => {
    try { await adm(`/api/admin/support/${id}/close`, { body: {} }); toast.success("تم إنهاء المحادثة وطُلب من المستخدم تقييمها"); await load(); } catch (e) { toast.error(errMsg(e)); }
  };
  const assign = async (adminId: string) => {
    if (!adminId) return;
    try { await adm(`/api/admin/support/${id}/assign`, { body: { admin_id: adminId } }); toast.success("تم تحويل المحادثة"); setTransferTo(""); await load(); } catch (e) { toast.error(errMsg(e)); }
  };
  const t = d?.thread;
  // The first person to reply owns the conversation; only they (or the owner) reply, close or transfer it.
  const mine = !!t && (!t.assigned_to || t.assigned_to === meId || isOwner);
  const canTransfer = !!t && !!t.assigned_to && (t.assigned_to === meId || isOwner) && allow("assign");

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-2xl h-[88vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()} dir="rtl">
        <div className="p-4 border-b border-border space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-bold">{t?.user_name ?? "…"} {t?.member_no && <span className="text-xs text-muted-foreground font-normal" dir="ltr">#{t.member_no}</span>}</h3>
              <p className="text-xs text-muted-foreground" dir="ltr" style={{ textAlign: "right" }}>{t?.user_phone ?? ""}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted" aria-label="إغلاق"><XCircle className="w-5 h-5" /></button>
          </div>
          {t && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`px-2 py-0.5 rounded-full ${t.status === "closed" ? "bg-muted" : t.last_from === "user" ? "bg-red-100 text-red-700" : "bg-sky-100 text-sky-700"}`}>{t.status === "closed" ? closedBy(t.closed_by) : t.last_from === "user" ? "بانتظار الرد" : "جارية"}</span>
              <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">{t.assigned_to ? `المسؤول: ${t.assigned_to === meId ? "أنت" : t.assigned_name ?? "—"}` : "غير مسندة — تُسند لأول من يرد"}</span>
              {canTransfer && (
                <span className="flex items-center gap-1">
                  <select value={transferTo} onChange={(e) => setTransferTo(e.target.value)} className="admin-input w-auto py-1 text-xs">
                    <option value="">تحويل إلى موظف…</option>
                    {staff.filter((s) => s.id !== t.assigned_to).map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                  <button onClick={() => assign(transferTo)} disabled={!transferTo} className="px-2 py-1 rounded-lg border border-border disabled:opacity-40">تحويل</button>
                </span>
              )}
              {t.rating && <span className="text-amber-600 flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />{t.rating}/5 {t.rating_note ? `— ${t.rating_note}` : ""}</span>}
              {mine && allow("close") && t.status === "open" && <button onClick={close} className="mr-auto px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />إنهاء المحادثة</button>}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-mohemah-light/30">
          {d?.messages.map((m) => (
            <div key={m.id} className={`flex ${m.from_user ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${m.from_user ? "bg-card border border-border" : "bg-primary text-primary-foreground"}`}>
                {!m.from_user && <p className="text-[10px] opacity-80 mb-0.5">{m.sender_name ?? "الإدارة"}</p>}
                {m.subject && <p className="font-bold">{m.subject}</p>}
                <MsgBody m={m} />
                <p className="text-[10px] opacity-70 mt-1" dir="ltr">{new Date(m.created_at).toLocaleString("ar-SA-u-ca-gregory-nu-latn", { dateStyle: "short", timeStyle: "short" })}</p>
              </div>
            </div>
          ))}
          <div ref={end} />
        </div>
        {t && !mine && (
          <p className="p-3 border-t border-border text-xs text-center text-muted-foreground bg-muted/40">المحادثة مسندة إلى {t.assigned_name ?? "موظف آخر"}، ولا يمكن الرد عليها إلا إذا حوّلها إليك.</p>
        )}
        {mine && allow("reply") && (
          <div className="p-3 border-t border-border flex gap-2">
            <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); reply(); } }}
              rows={2} placeholder={t?.status === "closed" ? "الرد يعيد فتح المحادثة…" : "اكتب ردك… (Enter للإرسال)"} className="admin-input flex-1 resize-none" />
            <button onClick={reply} disabled={busy || !text.trim()} className="mohemah-btn-coral rounded-xl px-4 disabled:opacity-50" aria-label="إرسال"><Send className="w-4 h-4" /></button>
          </div>
        )}
      </div>
    </div>
  );
}

function NewThreadDialog({ onClose, onStarted }: { onClose: () => void; onStarted: (id: string) => void }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [q, setQ] = useState("");
  const [userId, setUserId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  useEffect(() => { adm<Person[]>("/api/admin/people").then(setPeople).catch(() => {}); }, []);
  const matches = useMemo(() => people.filter((p) => !q.trim() || (p.full_name ?? "").includes(q) || (p.phone ?? "").includes(q) || String(p.member_no ?? "").includes(q.replace("#", ""))).slice(0, 50), [people, q]);
  const start = async () => {
    if (!userId || !body.trim()) return toast.error("اختر المستخدم واكتب الرسالة");
    try { const r = await adm<{ id: string }>("/api/admin/support/start", { body: { user_id: userId, subject: subject || null, body } }); toast.success("تم إرسال الرسالة"); onStarted(r.id); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl p-5 max-w-lg w-full space-y-3 text-sm" onClick={(e) => e.stopPropagation()} dir="rtl">
        <h3 className="text-lg font-bold">محادثة جديدة</h3>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم أو الجوال أو الرقم #" className="admin-input" />
        <select value={userId} onChange={(e) => setUserId(e.target.value)} className="admin-input" size={6}>
          {matches.map((p) => <option key={p.id} value={p.id}>{p.member_no ? `#${p.member_no} — ` : ""}{p.full_name || p.phone}</option>)}
        </select>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="العنوان (اختياري)" className="admin-input" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="نص الرسالة" className="admin-input" />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-mohemah-light font-bold">إلغاء</button>
          <button onClick={start} className="flex-1 py-2.5 rounded-xl mohemah-btn-coral font-bold">إرسال</button>
        </div>
      </div>
    </div>
  );
}

interface Cancel {
  id: string; order_no: number; service_name: string; sub_service_name: string | null; cancel_reason: string | null; cancel_code: string | null; cancelled_at: string;
  price_amount: number | null; price_status: string; customer_name: string | null; customer_no: number | null; provider_name: string | null; provider_no: number | null;
  messages: number; cancel_reviewed_at: string | null; reviewed_by_name: string | null;
}

/** Orders cancelled by customers with the reason; the conversation can be read to check the reason. */
function Cancellations() {
  const [status, setStatus] = useState<"new" | "reviewed">("new");
  const [d, setD] = useState<{ rows: Cancel[]; new_count: number } | null>(null);
  const [chat, setChat] = useState<Cancel | null>(null);
  const load = () => adm<{ rows: Cancel[]; new_count: number }>(`/api/admin/cancellations?status=${status}`).then(setD).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, [status]);
  const reviewed = async (id: string) => { try { await adm(`/api/admin/cancellations/${id}/reviewed`, { body: {} }); toast.success("تمت المراجعة"); setChat(null); load(); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        {(["new", "reviewed"] as const).map((k) => (
          <button key={k} onClick={() => setStatus(k)} className={`px-4 py-2 rounded-xl text-sm font-bold border ${status === k ? "bg-primary text-primary-foreground border-transparent" : "bg-card border-border"}`}>
            {k === "new" ? "بانتظار المراجعة" : "تمت مراجعتها"}{k === "new" && <span className="text-[11px] px-2 rounded-full bg-black/10 mr-1">{d?.new_count ?? 0}</span>}
          </button>
        ))}
        <p className="text-[11px] text-muted-foreground mr-auto">يُطلب من العميل سبب الإلغاء بعد قبول الطلب، ومنها «عدم الموافقة على المبلغ». افتح المحادثة للتحقق.</p>
      </div>
      <div className="bg-card border border-border rounded-2xl divide-y divide-border">
        {(d?.rows ?? []).map((r) => (
          <div key={r.id} className="p-3 flex flex-wrap items-center gap-3 text-sm">
            <div className="flex-1 min-w-[220px]">
              <p className="font-bold">#{r.order_no} — {r.sub_service_name ?? r.service_name}</p>
              <p className="text-xs text-muted-foreground">العميل: {r.customer_name ?? "—"}{r.customer_no ? ` #${r.customer_no}` : ""} · مقدم الخدمة: {r.provider_name ?? "—"}{r.provider_no ? ` #${r.provider_no}` : ""}</p>
              <p className="text-xs mt-1"><span className={`px-2 py-0.5 rounded-full ${r.cancel_code === "price_disagreement" ? "bg-amber-100 text-amber-800" : "bg-red-50 text-red-700"}`}>{r.cancel_reason}</span>
                {r.price_amount !== null && <span className="text-muted-foreground mr-2">المبلغ المعروض: {r.price_amount} ريال</span>}</p>
            </div>
            <span className="text-[11px] text-muted-foreground">{ago(r.cancelled_at)}{r.reviewed_by_name ? ` · راجعها ${r.reviewed_by_name}` : ""}</span>
            <button onClick={() => setChat(r)} className="px-3 py-1.5 rounded-lg border border-border text-xs font-bold">المحادثة ({r.messages})</button>
            {!r.cancel_reviewed_at && <button onClick={() => reviewed(r.id)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold">تمت المراجعة</button>}
          </div>
        ))}
        {d && !d.rows.length && <p className="p-6 text-center text-sm text-muted-foreground">لا توجد طلبات هنا.</p>}
      </div>
      {chat && <OrderChatDialog c={chat} onClose={() => setChat(null)} onReviewed={() => reviewed(chat.id)} />}
    </div>
  );
}

function OrderChatDialog({ c, onClose, onReviewed }: { c: Cancel; onClose: () => void; onReviewed: () => void }) {
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  useEffect(() => { adm<Msg[]>(`/api/admin/orders/${c.id}/chat`).then(setMsgs).catch((e) => toast.error(errMsg(e))); }, [c.id]);
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-2xl h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()} dir="rtl">
        <div className="p-4 border-b border-border flex items-center justify-between gap-2">
          <div>
            <h3 className="font-bold">محادثة الطلب #{c.order_no}</h3>
            <p className="text-xs text-muted-foreground">سبب الإلغاء: {c.cancel_reason}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted" aria-label="إغلاق"><XCircle className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-mohemah-light/30">
          {msgs?.map((m) => (
            <div key={m.id} className={`flex ${m.from_customer ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${m.from_customer ? "bg-card border border-border" : "bg-emerald-600 text-white"}`}>
                <p className="text-[10px] opacity-80 mb-0.5">{m.sender_name ?? ""} · {m.from_customer ? "العميل" : "مقدم الخدمة"}</p>
                <MsgBody m={m} />
                <p className="text-[10px] opacity-70 mt-1" dir="ltr">{new Date(m.created_at).toLocaleString("ar-SA-u-ca-gregory-nu-latn", { dateStyle: "short", timeStyle: "short" })}</p>
              </div>
            </div>
          ))}
          {msgs && !msgs.length && <p className="text-center text-sm text-muted-foreground py-8">لا توجد رسائل في هذا الطلب.</p>}
        </div>
        {!c.cancel_reviewed_at && <div className="p-3 border-t border-border"><button onClick={onReviewed} className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold">تمت مراجعة سبب الإلغاء</button></div>}
      </div>
    </div>
  );
}
