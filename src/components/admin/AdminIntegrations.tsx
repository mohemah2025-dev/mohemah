import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

const adm = <T,>(path: string, opts: { method?: string; body?: unknown } = {}) => api<T>(path, { ...opts, app: "admin" });
const input = "border border-border rounded-lg px-3 py-2 text-sm bg-background w-full";

interface Cfg {
  sms_enabled: number | boolean; sms_provider: string | null; sms_sender: string | null; sms_username: string | null;
  email_enabled: number | boolean; email_provider: string | null; email_from: string | null; email_from_name: string | null;
}
interface Status { sms: { secret: boolean }; email: { secret: boolean } }
interface Log { id: string; channel: "sms" | "email"; recipient: string; subject: string | null; status: string; error: string | null; created_at: string }

const SMS = [
  { v: "unifonic", label: "يونيفونك Unifonic", key: "AppSid" },
  { v: "taqnyat", label: "تقنيات Taqnyat", key: "Bearer Token" },
  { v: "msegat", label: "مسجات Msegat", key: "API Key" },
];
const EMAIL = [
  { v: "resend", label: "Resend" },
  { v: "sendgrid", label: "SendGrid" },
];

function Pill({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return <span className={`text-[11px] px-2 py-0.5 rounded-full ${ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{ok ? yes : no}</span>;
}

export function AdminIntegrationsPage() {
  const { can } = useAuth();
  const canEdit = can("integrations", "edit");
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [log, setLog] = useState<Log[]>([]);
  const [testPhone, setTestPhone] = useState("");
  const [testMail, setTestMail] = useState("");
  const [busy, setBusy] = useState("");

  const load = () => {
    adm<Cfg>("/api/admin/settings").then(setCfg).catch((e) => toast.error(errMsg(e)));
    adm<Status>("/api/admin/integrations/status").then(setStatus).catch(() => {});
    adm<Log[]>("/api/admin/integrations/log").then(setLog).catch(() => {});
  };
  useEffect(load, []);

  if (!cfg) return <p className="text-sm text-muted-foreground">جاري التحميل…</p>;
  const set = (p: Partial<Cfg>) => setCfg({ ...cfg, ...p });

  const save = async () => {
    setBusy("save");
    try {
      setCfg(await adm<Cfg>("/api/admin/integrations", { method: "PUT", body: {
        sms_enabled: !!cfg.sms_enabled, sms_provider: cfg.sms_provider || null, sms_sender: cfg.sms_sender || null, sms_username: cfg.sms_username || null,
        email_enabled: !!cfg.email_enabled, email_provider: cfg.email_provider || null, email_from: cfg.email_from || null, email_from_name: cfg.email_from_name || null,
      } }));
      toast.success("تم الحفظ");
    } catch (e) { toast.error(errMsg(e)); }
    setBusy("");
  };
  const test = async (kind: "sms" | "email") => {
    setBusy(kind);
    try {
      await adm(`/api/admin/integrations/test-${kind}`, { body: { to: kind === "sms" ? testPhone : testMail } });
      toast.success(kind === "sms" ? "تم إرسال الرسالة التجريبية" : "تم إرسال البريد التجريبي");
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(""); load();
  };
  const smsKey = SMS.find((x) => x.v === cfg.sms_provider)?.key ?? "مفتاح API";

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-xl font-bold">الرسائل النصية والبريد</h1>
      <p className="text-xs text-muted-foreground leading-6">
        تُرسل تلقائياً عند: قبول أو رفض طلب تسجيل مقدم الخدمة (رسالة + بريد)، قبول طلب العميل (رسالة)، ونجاح الدفع الإلكتروني (بريد).
        مفاتيح المزودين لا تُحفظ هنا؛ تُضاف كأسرار في Cloudflare: <code dir="ltr">SMS_API_KEY</code> و<code dir="ltr">EMAIL_API_KEY</code>.
      </p>

      {/* SMS */}
      <section className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold text-sm">الرسائل النصية SMS</h2>
          {status && <Pill ok={status.sms.secret} yes="المفتاح مضاف" no="SMS_API_KEY غير مضاف" />}
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!canEdit} checked={!!cfg.sms_enabled} onChange={(e) => set({ sms_enabled: e.target.checked })} />تفعيل إرسال الرسائل النصية</label>
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-bold block mb-1">المزود</label>
            <select className={input} disabled={!canEdit} value={cfg.sms_provider ?? ""} onChange={(e) => set({ sms_provider: e.target.value || null })}>
              <option value="">اختر المزود</option>{SMS.map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold block mb-1">اسم المرسل المعتمد</label>
            <input className={input} disabled={!canEdit} dir="ltr" maxLength={11} placeholder="Mohemah" value={cfg.sms_sender ?? ""} onChange={(e) => set({ sms_sender: e.target.value })} />
          </div>
          {cfg.sms_provider === "msegat" && (
            <div>
              <label className="text-xs font-bold block mb-1">اسم المستخدم في مسجات</label>
              <input className={input} disabled={!canEdit} dir="ltr" value={cfg.sms_username ?? ""} onChange={(e) => set({ sms_username: e.target.value })} />
            </div>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">قيمة السرّ <code dir="ltr">SMS_API_KEY</code> = {smsKey} من لوحة المزود. اسم المرسل يجب أن يكون مسجلاً ومعتمداً لدى المزود (متطلبات هيئة الاتصالات).</p>
        {canEdit && (
          <div className="flex flex-wrap gap-2 items-center">
            <input className={`${input} max-w-56`} dir="ltr" placeholder="05XXXXXXXX" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
            <button onClick={() => test("sms")} disabled={busy !== "" || !testPhone} className="px-4 py-2 rounded-lg border border-border text-sm font-bold disabled:opacity-50">{busy === "sms" ? "جارٍ الإرسال…" : "إرسال رسالة تجريبية"}</button>
          </div>
        )}
      </section>

      {/* E-mail */}
      <section className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold text-sm">البريد الإلكتروني</h2>
          {status && <Pill ok={status.email.secret} yes="المفتاح مضاف" no="EMAIL_API_KEY غير مضاف" />}
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!canEdit} checked={!!cfg.email_enabled} onChange={(e) => set({ email_enabled: e.target.checked })} />تفعيل إرسال البريد</label>
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-bold block mb-1">المزود</label>
            <select className={input} disabled={!canEdit} value={cfg.email_provider ?? ""} onChange={(e) => set({ email_provider: e.target.value || null })}>
              <option value="">اختر المزود</option>{EMAIL.map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold block mb-1">بريد المرسل</label>
            <input className={input} disabled={!canEdit} dir="ltr" placeholder="no-reply@mohemah.sa" value={cfg.email_from ?? ""} onChange={(e) => set({ email_from: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-bold block mb-1">اسم المرسل</label>
            <input className={input} disabled={!canEdit} placeholder="مهمة" value={cfg.email_from_name ?? ""} onChange={(e) => set({ email_from_name: e.target.value })} />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">يجب توثيق نطاق بريد المرسل لدى المزود (سجلات DNS: SPF وDKIM) وإلا ستُرفض الرسائل أو تصل للبريد المزعج.</p>
        {canEdit && (
          <div className="flex flex-wrap gap-2 items-center">
            <input className={`${input} max-w-64`} dir="ltr" placeholder="you@example.com" value={testMail} onChange={(e) => setTestMail(e.target.value)} />
            <button onClick={() => test("email")} disabled={busy !== "" || !testMail} className="px-4 py-2 rounded-lg border border-border text-sm font-bold disabled:opacity-50">{busy === "email" ? "جارٍ الإرسال…" : "إرسال بريد تجريبي"}</button>
          </div>
        )}
      </section>

      {canEdit && <button onClick={save} disabled={busy !== ""} className="mohemah-btn-coral rounded-xl px-6 py-2.5 text-sm font-bold disabled:opacity-50">{busy === "save" ? "جارٍ الحفظ…" : "حفظ الإعدادات"}</button>}

      <section className="bg-card border border-border rounded-2xl overflow-x-auto">
        <h2 className="font-bold text-sm p-4 pb-2">سجل الإرسال</h2>
        <table className="w-full text-xs text-right min-w-[560px]">
          <thead className="bg-mohemah-light text-muted-foreground"><tr>{["التاريخ", "القناة", "المستلم", "الموضوع", "الحالة"].map((h) => <th key={h} className="p-2">{h}</th>)}</tr></thead>
          <tbody>
            {log.map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className="p-2" dir="ltr">{l.created_at.slice(0, 16).replace("T", " ")}</td>
                <td className="p-2">{l.channel === "sms" ? "رسالة" : "بريد"}</td>
                <td className="p-2" dir="ltr">{l.recipient}</td>
                <td className="p-2">{l.subject ?? "—"}</td>
                <td className={`p-2 ${l.status === "sent" ? "text-emerald-700" : "text-destructive"}`} title={l.error ?? ""}>{l.status === "sent" ? "أُرسلت" : `فشل: ${l.error ?? ""}`}</td>
              </tr>
            ))}
            {log.length === 0 && <tr><td colSpan={5} className="p-4 text-muted-foreground">لا يوجد إرسال بعد.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
