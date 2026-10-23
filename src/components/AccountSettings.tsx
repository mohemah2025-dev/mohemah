import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { KeyRound, Trash2, Save } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { usePublicData } from "@/lib/publicData";
import { Field, inputCls, validEmail, validPhone } from "@/components/RegistrationForms";

const localPhone = (p: string | null | undefined) => (p ? p.replace(/^\+966/, "0") : "");

/** Editable personal data shared by the customer and provider apps. */
export function ProfileEditor() {
  const { profile, refreshProfile, app } = useAuth();
  const { regions } = usePublicData();
  const [f, setF] = useState({ full_name: profile?.full_name ?? "", phone: localPhone(profile?.phone), email: profile?.email ?? "", region: profile?.region ?? "", bio: profile?.bio ?? "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    if (f.full_name.trim().length < 2) return toast.error("أدخل الاسم");
    if (f.phone && !validPhone(f.phone)) return toast.error("رقم الجوال غير صحيح (05XXXXXXXX)");
    if (f.email && !validEmail(f.email)) return toast.error("البريد الإلكتروني غير صحيح");
    setBusy(true);
    try {
      await api("/api/me", { method: "PATCH", body: { full_name: f.full_name.trim(), phone: f.phone || undefined, email: f.email.trim() || undefined, region: f.region || undefined, bio: app === "provider" ? f.bio : undefined } });
      await refreshProfile();
      toast.success("تم حفظ بياناتك");
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };
  return (
    <div className="space-y-3">
      <Field label="الاسم"><input value={f.full_name} onChange={(e) => set("full_name")(e.target.value)} maxLength={150} className={inputCls} /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Field label="رقم الجوال"><input type="tel" dir="ltr" value={f.phone} onChange={(e) => set("phone")(e.target.value)} placeholder="05XXXXXXXX" className={inputCls} /></Field>
        <Field label="المدينة"><select value={f.region} onChange={(e) => set("region")(e.target.value)} className={inputCls}><option value="">اختر المدينة</option>{regions.map((r) => <option key={r}>{r}</option>)}</select></Field>
      </div>
      <Field label="البريد الإلكتروني"><input type="email" dir="ltr" value={f.email} onChange={(e) => set("email")(e.target.value)} className={inputCls} /></Field>
      {app === "provider" && <Field label="نبذة عنك (تظهر للعميل)"><textarea value={f.bio} onChange={(e) => set("bio")(e.target.value)} maxLength={500} rows={3} className={inputCls} /></Field>}
      <button onClick={save} disabled={busy} className="w-full mohemah-btn-primary py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"><Save className="size-4" />{busy ? "جارٍ الحفظ…" : "حفظ البيانات"}</button>
    </div>
  );
}

export function PasswordChange() {
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (f.next.length < 8) return toast.error("كلمة المرور الجديدة 8 أحرف على الأقل");
    if (f.next !== f.confirm) return toast.error("كلمتا المرور غير متطابقتين");
    setBusy(true);
    try { await api("/api/me/password", { body: { current: f.current, next: f.next } }); toast.success("تم تغيير كلمة المرور"); setF({ current: "", next: "", confirm: "" }); }
    catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };
  return (
    <div className="space-y-2">
      <p className="text-sm font-bold flex items-center gap-2"><KeyRound className="size-4 text-primary" />تغيير كلمة المرور</p>
      <input type="password" dir="ltr" placeholder="كلمة المرور الحالية" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} className={inputCls} autoComplete="current-password" />
      <div className="grid grid-cols-2 gap-2">
        <input type="password" dir="ltr" placeholder="الجديدة" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} className={inputCls} autoComplete="new-password" />
        <input type="password" dir="ltr" placeholder="تأكيدها" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} className={inputCls} autoComplete="new-password" />
      </div>
      <button onClick={save} disabled={busy || !f.current} className="w-full rounded-xl bg-muted py-2.5 text-sm font-bold disabled:opacity-50">تحديث كلمة المرور</button>
    </div>
  );
}

/** Permanent deletion of the signed-in account (required by both app stores). */
export function DeleteAccount() {
  const { signOut, app } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    setBusy(true);
    try {
      await api("/api/me/delete", { body: { password } });
      await signOut();
      toast.success("تم حذف حسابك وبياناتك");
      navigate({ to: app === "provider" ? "/provider/auth" : "/auth" });
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };
  return (
    <div className="space-y-2">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-center gap-2 rounded-xl border border-destructive/40 py-2.5 text-sm font-bold text-destructive"><Trash2 className="size-4" />حذف الحساب نهائياً</button>
      {open && (
        <div className="rounded-xl bg-destructive/5 p-3 space-y-2">
          <p className="text-xs text-muted-foreground leading-relaxed">سيتم حذف حسابك وبياناتك الشخصية ومستنداتك نهائياً، وتُلغى طلباتك المعلّقة. لا يمكن التراجع عن هذه الخطوة.</p>
          <input type="password" dir="ltr" placeholder="أدخل كلمة المرور للتأكيد" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
          <button onClick={remove} disabled={busy || !password} className="w-full rounded-xl bg-destructive py-2.5 text-sm font-bold text-destructive-foreground disabled:opacity-50">{busy ? "جارٍ الحذف…" : "تأكيد حذف الحساب"}</button>
        </div>
      )}
    </div>
  );
}
