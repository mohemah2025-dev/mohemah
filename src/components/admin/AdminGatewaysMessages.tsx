import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

interface Gateway { id: string; name: string; provider_key: string; merchant_id: string | null; public_key: string | null; fee_percent: number; test_mode: boolean | number; active: boolean | number }
interface KeyStatus { moyasar: { secret: boolean; webhook_secret: boolean; mode: "live" | "test" | null; webhook_url: string }; tap: { secret: boolean; mode: "live" | "test" | null; webhook_url: string } }
interface Payment { id: string; purpose: string; coins: number | null; months: number | null; amount: number; status: string; provider_key: string; error: string | null; created_at: string; user_name: string | null }
const adm = <T,>(path: string, opts: { method?: string; body?: unknown } = {}) => api<T>(path, { ...opts, app: "admin" });

const input = "border border-border rounded-lg px-3 py-2 text-sm bg-background w-full";
const LIVE = ["moyasar", "tap"];
const statusAr: Record<string, string> = { initiated: "بانتظار الدفع", processing: "قيد التأكيد", paid: "مدفوع", failed: "فشل" };

function Badge({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return <span className={`text-[11px] px-2 py-0.5 rounded-full ${ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{children}</span>;
}

function Copy({ text }: { text: string }) {
  return (
    <button type="button" onClick={() => { navigator.clipboard?.writeText(text); toast.success("تم النسخ"); }}
      className="w-full text-left font-mono text-[11px] bg-muted rounded-lg px-2 py-1.5 truncate hover:bg-mohemah-light" dir="ltr" title="نسخ">{text}</button>
  );
}

export function AdminGatewaysPage() {
  const [list, setList] = useState<Gateway[]>([]);
  const [keys, setKeys] = useState<KeyStatus | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [coinPrice, setCoinPrice] = useState<number>(1);
  const [f, setF] = useState({ name: "", provider_key: "moyasar", merchant_id: "", public_key: "", fee_percent: 0 });
  const { can } = useAuth();
  const canEdit = can("gateways", "edit");

  const load = async () => {
    try { setList(await adm<Gateway[]>("/api/admin/gateways")); } catch (e) { toast.error(errMsg(e)); }
    adm<KeyStatus>("/api/admin/integrations/status").then(setKeys).catch(() => {});
    adm<Payment[]>("/api/admin/payments").then(setPayments).catch(() => {});
    adm<{ coin_price: number }>("/api/admin/settings").then((s) => setCoinPrice(Number(s.coin_price ?? 1))).catch(() => {});
  };
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
  const saveCoinPrice = async () => { try { await adm("/api/admin/settings", { method: "PUT", body: { coin_price: coinPrice } }); toast.success("تم حفظ سعر الكوين"); } catch (e) { toast.error(errMsg(e)); } };
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const del = async (id: string) => {
    if (confirmDel !== id) { setConfirmDel(id); toast.info("اضغط الحذف مرة أخرى للتأكيد"); return; }
    try { await adm(`/api/admin/gateways/${id}`, { method: "DELETE" }); } catch (e) { toast.error(errMsg(e)); }
    setConfirmDel(null); load();
  };

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-xl font-bold">بوابات الدفع</h1>

      {/* How the real connection works */}
      <section className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <h2 className="font-bold text-sm">الربط الفعلي مع مزود الدفع</h2>
        <p className="text-xs text-muted-foreground leading-6">
          البوابات المدعومة للدفع الحقيقي: <b>ميسّر Moyasar</b> و<b>تاب Tap</b> (مدى، فيزا/ماستركارد، Apple Pay، STC Pay حسب تفعيلها في حسابك لدى المزود).
          المفتاح السري لا يُكتب هنا أبداً؛ يُضاف كسرّ في Cloudflare، ويؤكد الخادم كل عملية من المزود مباشرة قبل إضافة الرصيد أو الاشتراك.
        </p>
        <div className="grid md:grid-cols-2 gap-3">
          {keys && (["moyasar", "tap"] as const).map((k) => (
            <div key={k} className="border border-border rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">{k === "moyasar" ? "ميسّر Moyasar" : "تاب Tap"}</span>
                <Badge ok={keys[k].secret}>{keys[k].secret ? (keys[k].mode === "live" ? "مربوط (حقيقي)" : "مربوط (اختبار)") : "غير مربوط"}</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">اسم السرّ في Cloudflare: <code dir="ltr">{k === "moyasar" ? "MOYASAR_SECRET_KEY" : "TAP_SECRET_KEY"}</code>{k === "moyasar" && <> · اختياري: <code dir="ltr">MOYASAR_WEBHOOK_SECRET</code> {keys.moyasar.webhook_secret ? "✓" : ""}</>}</p>
              <p className="text-[11px] text-muted-foreground">رابط الإشعار (Webhook) الذي تضعه في لوحة المزود:</p>
              <Copy text={keys[k].webhook_url} />
            </div>
          ))}
        </div>
      </section>

      <section className="bg-card border border-border rounded-2xl p-4 flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label className="text-xs font-bold block mb-1">سعر الكوين الواحد (ريال، قبل الضريبة)</label>
          <input className={input} type="number" min={0} step="0.01" value={coinPrice} onChange={(e) => setCoinPrice(Number(e.target.value))} disabled={!canEdit} />
        </div>
        {canEdit && <button onClick={saveCoinPrice} className="mohemah-btn-coral rounded-lg px-4 py-2 text-sm font-bold">حفظ</button>}
        <p className="text-[11px] text-muted-foreground w-full">مبلغ الشحن = عدد الكوينز × السعر + ضريبة القيمة المضافة المحددة في الاشتراكات والتحصيل.</p>
      </section>

      {canEdit && (
        <div className="bg-card border border-border rounded-2xl p-4 grid md:grid-cols-3 gap-3">
          <input className={input} placeholder="الاسم الظاهر للمستخدم (مثال: مدى / Apple Pay)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <select className={input} value={f.provider_key} onChange={(e) => setF({ ...f, provider_key: e.target.value })}>
            <option value="moyasar">Moyasar — دفع حقيقي</option><option value="tap">Tap — دفع حقيقي</option><option value="custom">تجريبي (بدون خصم)</option>
          </select>
          <input className={input} type="number" placeholder="نسبة العمولة %" value={f.fee_percent} onChange={(e) => setF({ ...f, fee_percent: Number(e.target.value) })} />
          <input className={input} placeholder="رقم التاجر (اختياري، للمرجع)" value={f.merchant_id} onChange={(e) => setF({ ...f, merchant_id: e.target.value })} />
          <input className={input} placeholder="المفتاح العام pk_ (اختياري، للمرجع)" dir="ltr" value={f.public_key} onChange={(e) => setF({ ...f, public_key: e.target.value })} />
          <button onClick={add} className="mohemah-btn-coral rounded-lg py-2 text-sm font-bold">إضافة بوابة</button>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl divide-y divide-border">
        {list.map((g) => {
          const live = LIVE.includes(g.provider_key);
          const connected = live && !!keys?.[g.provider_key as "moyasar" | "tap"]?.secret;
          return (
            <div key={g.id} className="p-3 flex flex-wrap items-center gap-3 justify-between">
              <div>
                <p className="font-bold text-sm flex items-center gap-2">{g.name} {live ? <Badge ok={connected}>{connected ? "دفع حقيقي" : "ينقصه المفتاح السري"}</Badge> : <Badge ok={false}>تجريبي</Badge>}</p>
                <p className="text-xs text-muted-foreground">{g.provider_key} · عمولة {g.fee_percent}%</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                {!live && <label className="flex items-center gap-1"><input type="checkbox" disabled={!canEdit} checked={!!g.test_mode} onChange={(e) => patch(g.id, { test_mode: e.target.checked })} />تجريبي</label>}
                <label className="flex items-center gap-1"><input type="checkbox" disabled={!canEdit} checked={!!g.active} onChange={(e) => patch(g.id, { active: e.target.checked })} />مفعّلة</label>
                {canEdit && <button onClick={() => del(g.id)} aria-label="حذف البوابة" className={confirmDel === g.id ? "text-destructive animate-pulse" : "text-destructive"}><Trash2 className="w-4 h-4" /></button>}
              </div>
            </div>
          );
        })}
        {list.length === 0 && <p className="p-4 text-sm text-muted-foreground">لا توجد بوابات.</p>}
      </div>
      <p className="text-xs text-muted-foreground">البوابات التجريبية تضيف الرصيد دون خصم فعلي وتعمل فقط ما دام «الدفع التجريبي» مفعّلاً في الاشتراكات والتحصيل. عند الإطلاق: عطّلها وأبقِ بوابة ميسّر أو تاب.</p>

      <section className="bg-card border border-border rounded-2xl overflow-x-auto">
        <h2 className="font-bold text-sm p-4 pb-2">آخر عمليات الدفع الإلكتروني</h2>
        <table className="w-full text-xs text-right min-w-[600px]">
          <thead className="bg-mohemah-light text-muted-foreground"><tr>{["التاريخ", "مقدم الخدمة", "العملية", "المبلغ", "البوابة", "الحالة"].map((h) => <th key={h} className="p-2">{h}</th>)}</tr></thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="p-2" dir="ltr">{p.created_at.slice(0, 16).replace("T", " ")}</td>
                <td className="p-2">{p.user_name ?? "—"}</td>
                <td className="p-2">{p.purpose === "topup" ? `شحن ${p.coins} كوين` : `اشتراك ${p.months} شهر`}</td>
                <td className="p-2">{p.amount} ر.س</td>
                <td className="p-2">{p.provider_key}</td>
                <td className="p-2" title={p.error ?? ""}>{statusAr[p.status] ?? p.status}</td>
              </tr>
            ))}
            {payments.length === 0 && <tr><td colSpan={6} className="p-4 text-muted-foreground">لا توجد عمليات بعد.</td></tr>}
          </tbody>
        </table>
      </section>
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
