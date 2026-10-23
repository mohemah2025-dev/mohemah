import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

interface Gateway { id: string; name: string; provider_key: string; merchant_id: string | null; public_key: string | null; fee_percent: number; test_mode: boolean | number; active: boolean | number }
const adm = <T,>(path: string, opts: { method?: string; body?: unknown } = {}) => api<T>(path, { ...opts, app: "admin" });

const input = "border border-border rounded-lg px-3 py-2 text-sm bg-background w-full";

export function AdminGatewaysPage() {
  const [list, setList] = useState<Gateway[]>([]);
  const [f, setF] = useState({ name: "", provider_key: "moyasar", merchant_id: "", public_key: "", fee_percent: 0 });

  const { isOwner } = useAuth();
  const load = async () => { try { setList(await adm<Gateway[]>("/api/admin/gateways")); } catch (e) { toast.error(errMsg(e)); } };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!f.name.trim()) return toast.error("أدخل اسم البوابة");
    try { await adm("/api/admin/gateways", { body: { ...f, merchant_id: f.merchant_id || null, public_key: f.public_key || null } }); }
    catch (e) { return toast.error(errMsg(e)); }
    toast.success("تمت إضافة بوابة الدفع");
    setF({ name: "", provider_key: "moyasar", merchant_id: "", public_key: "", fee_percent: 0 });
    load();
  };
  const patch = async (id: string, v: Partial<Gateway>) => { try { await adm(`/api/admin/gateways/${id}`, { method: "PATCH", body: v }); } catch (e) { toast.error(errMsg(e)); } load(); };
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const del = async (id: string) => {
    if (confirmDel !== id) { setConfirmDel(id); toast.info("اضغط الحذف مرة أخرى للتأكيد"); return; }
    try { await adm(`/api/admin/gateways/${id}`, { method: "DELETE" }); } catch (e) { toast.error(errMsg(e)); }
    setConfirmDel(null); load();
  };

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-xl font-bold">بوابات الدفع</h1>
      <div className="bg-card border border-border rounded-2xl p-4 grid md:grid-cols-3 gap-3">
        <input className={input} placeholder="اسم البوابة (مثال: ميسر)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <select className={input} value={f.provider_key} onChange={(e) => setF({ ...f, provider_key: e.target.value })}>
          <option value="moyasar">Moyasar</option><option value="tap">Tap</option><option value="hyperpay">HyperPay</option>
          <option value="paytabs">PayTabs</option><option value="stripe">Stripe</option><option value="custom">أخرى</option>
        </select>
        <input className={input} type="number" placeholder="نسبة العمولة %" value={f.fee_percent} onChange={(e) => setF({ ...f, fee_percent: Number(e.target.value) })} />
        <input className={input} placeholder="رقم التاجر (Merchant ID)" value={f.merchant_id} onChange={(e) => setF({ ...f, merchant_id: e.target.value })} />
        <input className={input} placeholder="المفتاح العام (Publishable key)" value={f.public_key} onChange={(e) => setF({ ...f, public_key: e.target.value })} />
        <button onClick={add} className="mohemah-btn-coral rounded-lg py-2 text-sm font-bold">إضافة بوابة</button>
      </div>
      <p className="text-xs text-muted-foreground">البوابات في "الوضع التجريبي" تضيف الرصيد مباشرة دون خصم فعلي، ما دام «الدفع التجريبي» مفعّلاً في الاشتراكات والتحصيل. الربط الفعلي مع البوابة (المفتاح السري وتأكيد الدفع) يتم في مرحلة الإطلاق ولا يُحفظ هنا.</p>
      {!isOwner && <p className="text-xs text-destructive">تعديل بوابات الدفع متاح للمالك فقط.</p>}
      <div className="bg-card border border-border rounded-2xl divide-y divide-border">
        {list.map((g) => (
          <div key={g.id} className="p-3 flex flex-wrap items-center gap-3 justify-between">
            <div>
              <p className="font-bold text-sm">{g.name}</p>
              <p className="text-xs text-muted-foreground">{g.provider_key} · عمولة {g.fee_percent}%</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <label className="flex items-center gap-1"><input type="checkbox" checked={!!g.test_mode} onChange={(e) => patch(g.id, { test_mode: e.target.checked })} />تجريبي</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={!!g.active} onChange={(e) => patch(g.id, { active: e.target.checked })} />مفعّلة</label>
              <button onClick={() => del(g.id)} aria-label="حذف البوابة" className={confirmDel === g.id ? "text-destructive animate-pulse" : "text-destructive"}><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {list.length === 0 && <p className="p-4 text-sm text-muted-foreground">لا توجد بوابات.</p>}
      </div>
    </div>
  );
}

interface Msg { id: string; sender_id: string | null; recipient_id: string | null; subject: string | null; body: string; created_at: string; sender_name: string | null; recipient_name: string | null }
interface P { id: string; full_name: string | null; phone: string | null }

export function AdminMessagesPage() {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [people, setPeople] = useState<P[]>([]);
  const [f, setF] = useState({ recipient_id: "", subject: "", body: "" });

  const load = async () => {
    try {
      const [m, p] = await Promise.all([adm<Msg[]>("/api/admin/messages"), adm<P[]>("/api/admin/people")]);
      setMsgs(m); setPeople(p);
    } catch (e) { toast.error(errMsg(e)); }
  };
  useEffect(() => { load(); }, []);
  const nameOf = (id: string | null, fallback?: string | null) => { const p = people.find((x) => x.id === id); return fallback || p?.full_name || p?.phone || id?.slice(0, 8) || "—"; };

  const send = async () => {
    if (!user || !f.recipient_id || !f.body.trim()) return toast.error("اختر المستلم واكتب الرسالة");
    try { await adm("/api/admin/messages", { body: { recipient_id: f.recipient_id, subject: f.subject || null, body: f.body } }); }
    catch (e) { return toast.error(errMsg(e)); }
    toast.success("تم إرسال الرسالة");
    setF({ recipient_id: "", subject: "", body: "" });
    load();
  };

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-xl font-bold">الرسائل</h1>
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <select className={input} value={f.recipient_id} onChange={(e) => setF({ ...f, recipient_id: e.target.value })}>
          <option value="">اختر المستخدم</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.phone || p.id.slice(0, 8)}</option>)}
        </select>
        <input className={input} placeholder="العنوان" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
        <textarea className={input} rows={3} placeholder="نص الرسالة" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
        <button onClick={send} className="mohemah-btn-coral rounded-lg px-6 py-2 text-sm font-bold">إرسال</button>
      </div>
      <div className="bg-card border border-border rounded-2xl divide-y divide-border">
        {msgs.map((m) => (
          <div key={m.id} className="p-3">
            <p className="text-xs text-muted-foreground">من {nameOf(m.sender_id, m.sender_name)} ← إلى {nameOf(m.recipient_id, m.recipient_name)} · {new Date(m.created_at).toLocaleString("ar-u-nu-latn")}</p>
            {m.subject && <p className="font-bold text-sm">{m.subject}</p>}
            <p className="text-sm">{m.body}</p>
          </div>
        ))}
        {msgs.length === 0 && <p className="p-4 text-sm text-muted-foreground">لا توجد رسائل.</p>}
      </div>
    </div>
  );
}
