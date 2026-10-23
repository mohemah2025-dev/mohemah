import { useState } from "react";
import { toast } from "sonner";
import { Upload, FileCheck2, Eye, EyeOff } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useAuth, type MePayload } from "@/lib/AuthContext";
import { usePublicData } from "@/lib/publicData";
import { DOC_ACCEPT, validateDoc } from "@/lib/providerDocs";
import { compressImage } from "@/lib/imageCompress";

export const inputCls = "w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring";
const NATIONALITIES = ["سعودي", "مصري", "يمني", "سوداني", "أردني", "سوري", "باكستاني", "هندي", "بنغلاديشي", "فلبيني", "أخرى"];

export const normalizePhone = (raw: string) => {
  let p = raw.replace(/[\s-]+/g, "").replace(/^00/, "+");
  if (p.startsWith("05")) p = "+966" + p.slice(1);
  else if (p.startsWith("5") && p.length === 9) p = "+966" + p;
  return p;
};
export const validPhone = (p: string) => /^\+9665\d{8}$/.test(normalizePhone(p));
export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-semibold text-muted-foreground mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function PasswordInput({ value, onChange, placeholder, autoComplete }: { value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input type={show ? "text" : "password"} dir="ltr" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} className={`${inputCls} pl-11`} />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function PasswordPair({ password, confirm, setPassword, setConfirm }: { password: string; confirm: string; setPassword: (v: string) => void; setConfirm: (v: string) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <Field label="كلمة المرور"><PasswordInput value={password} onChange={setPassword} placeholder="8 أحرف على الأقل" autoComplete="new-password" /></Field>
      <Field label="تأكيد كلمة المرور"><PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" /></Field>
    </div>
  );
}

function RegionSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { regions } = usePublicData();
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      <option value="">اختر المدينة</option>
      {regions.map((r) => <option key={r}>{r}</option>)}
    </select>
  );
}

function Tabs({ tab, setTab, signupLabel }: { tab: "login" | "signup"; setTab: (t: "login" | "signup") => void; signupLabel: string }) {
  return (
    <div className="grid grid-cols-2 gap-2" role="tablist">
      {(["login", "signup"] as const).map((t) => (
        <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`py-2.5 rounded-xl text-sm font-semibold border border-border ${tab === t ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}>
          {t === "login" ? "تسجيل الدخول" : signupLabel}
        </button>
      ))}
    </div>
  );
}

export function LoginForm({ onDone }: { onDone?: (p: MePayload) => void }) {
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!identifier.trim() || !password) return toast.error("أدخل البريد وكلمة المرور");
    setBusy(true);
    try {
      const p = await signIn(identifier, password);
      toast.success("تم تسجيل الدخول");
      onDone?.(p);
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <Field label="البريد الإلكتروني"><input type="text" inputMode="email" dir="ltr" autoComplete="username" placeholder="email@example.com" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className={inputCls} /></Field>
      <Field label="كلمة المرور"><PasswordInput value={password} onChange={setPassword} autoComplete="current-password" /></Field>
      <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-50">{busy ? "جارٍ..." : "دخول"}</button>
      <p className="text-[11px] text-muted-foreground text-center">نسيت كلمة المرور؟ تواصل مع الدعم لإعادة تعيينها.</p>
    </form>
  );
}

/** Customer app: sign in or create a customer account. */
export function CustomerAuth({ onDone }: { onDone: () => void }) {
  const [tab, setTab] = useState<"login" | "signup">("login");
  return (
    <div className="space-y-4">
      <Tabs tab={tab} setTab={setTab} signupLabel="حساب جديد" />
      {tab === "login" ? <LoginForm onDone={onDone} /> : <CustomerSignup onDone={onDone} />}
    </div>
  );
}

function CustomerSignup({ onDone }: { onDone: () => void }) {
  const { acceptSession } = useAuth();
  const [f, setF] = useState({ name: "", phone: "", email: "", region: "", password: "", confirm: "" });
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (f.name.trim().length < 2) return toast.error("أدخل الاسم");
    if (!validPhone(f.phone)) return toast.error("رقم الجوال غير صحيح (05XXXXXXXX)");
    if (!validEmail(f.email)) return toast.error("البريد الإلكتروني غير صحيح");
    if (!f.region) return toast.error("اختر المدينة");
    if (f.password.length < 8) return toast.error("كلمة المرور 8 أحرف على الأقل");
    if (f.password !== f.confirm) return toast.error("كلمتا المرور غير متطابقتين");
    if (!agree) return toast.error("وافق على الشروط وسياسة الخصوصية");
    setBusy(true);
    try {
      const p = await api<MePayload>("/api/auth/register/customer", { app: "customer", body: { full_name: f.name.trim(), phone: f.phone, email: f.email.trim(), region: f.region, password: f.password } });
      acceptSession(p);
      toast.success("تم إنشاء حسابك، أهلاً بك في مهمة");
      onDone();
    } catch (e) { toast.error(errMsg(e, "تعذّر التسجيل")); }
    setBusy(false);
  };

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <Field label="الاسم"><input value={f.name} onChange={(e) => set("name")(e.target.value)} className={inputCls} maxLength={150} autoComplete="name" /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Field label="رقم الجوال"><input type="tel" dir="ltr" placeholder="05XXXXXXXX" value={f.phone} onChange={(e) => set("phone")(e.target.value)} className={inputCls} autoComplete="tel" /></Field>
        <Field label="المدينة"><RegionSelect value={f.region} onChange={set("region")} /></Field>
      </div>
      <Field label="البريد الإلكتروني"><input type="email" dir="ltr" placeholder="email@example.com" value={f.email} onChange={(e) => set("email")(e.target.value)} className={inputCls} autoComplete="email" /></Field>
      <PasswordPair password={f.password} confirm={f.confirm} setPassword={set("password")} setConfirm={set("confirm")} />
      <label className="flex items-start gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />أوافق على شروط الاستخدام وسياسة الخصوصية</label>
      <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-50">{busy ? "جارٍ..." : "إنشاء حساب طالب خدمة"}</button>
    </form>
  );
}

function FilePick({ label, file, onPick }: { label: string; file: File | null; onPick: (f: File | null) => void }) {
  return (
    <label className="flex items-center gap-2 min-w-0 rounded-xl border border-dashed border-border bg-muted px-3 py-3 cursor-pointer text-sm">
      {file ? <FileCheck2 className="w-4 h-4 text-success shrink-0" /> : <Upload className="w-4 h-4 text-primary shrink-0" />}
      <span className="truncate flex-1">{file ? file.name : label}</span>
      <input type="file" accept={DOC_ACCEPT} className="hidden" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
    </label>
  );
}

function ServicePicker({ picked, toggle }: { picked: string[]; toggle: (id: string) => void }) {
  const { services } = usePublicData();
  return (
    <div>
      <span className="text-xs font-semibold text-muted-foreground mb-1 block">الخدمات التي تقدمها</span>
      <div className="flex flex-wrap gap-1.5">
        {services.map((s) => (
          <button key={s.id} type="button" aria-pressed={picked.includes(s.id)} onClick={() => toggle(s.id)} className={`px-3 py-1.5 rounded-full text-xs border ${picked.includes(s.id) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}>{s.name}</button>
        ))}
        {!services.length && <span className="text-xs text-muted-foreground">لا توجد خدمات متاحة حالياً</span>}
      </div>
    </div>
  );
}

/** Provider app: sign in or apply as a new service provider. */
export function ProviderAuth({ onDone }: { onDone: () => void }) {
  const [tab, setTab] = useState<"login" | "signup">("login");
  return (
    <div className="space-y-4">
      <Tabs tab={tab} setTab={setTab} signupLabel="التسجيل كمقدم خدمة" />
      {tab === "login" ? <LoginForm onDone={onDone} /> : <ProviderSignup onDone={onDone} />}
    </div>
  );
}

function ProviderSignup({ onDone }: { onDone: () => void }) {
  const { acceptSession } = useAuth();
  const [f, setF] = useState({ name: "", nationalId: "", phone: "", nationality: "سعودي", gender: "male", region: "", email: "", password: "", confirm: "" });
  const [picked, setPicked] = useState<string[]>([]);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const submit = async () => {
    if (f.name.trim().split(/\s+/).length < 3) return toast.error("أدخل الاسم الثلاثي");
    if (!/^[12]\d{9}$/.test(f.nationalId)) return toast.error("رقم الهوية/الإقامة 10 أرقام يبدأ بـ 1 أو 2");
    if (!validPhone(f.phone)) return toast.error("رقم الجوال غير صحيح (05XXXXXXXX)");
    if (!f.region) return toast.error("اختر المدينة التي تعمل بها");
    if (!validEmail(f.email)) return toast.error("البريد الإلكتروني غير صحيح");
    if (f.password.length < 8) return toast.error("كلمة المرور 8 أحرف على الأقل");
    if (f.password !== f.confirm) return toast.error("كلمتا المرور غير متطابقتين");
    if (!picked.length) return toast.error("اختر خدمة واحدة على الأقل");
    const docError = validateDoc(idFile, "صورة الهوية") ?? validateDoc(certFile, "الشهادة");
    if (docError) return toast.error(docError);
    if (!agree) return toast.error("وافق على الشروط وسياسة الخصوصية");
    const form = new FormData();
    form.set("full_name", f.name.trim()); form.set("national_id", f.nationalId); form.set("phone", f.phone);
    form.set("nationality", f.nationality); form.set("gender", f.gender); form.set("region", f.region);
    form.set("email", f.email.trim()); form.set("password", f.password); form.set("services", JSON.stringify(picked));
    setBusy(true);
    form.set("id_file", await compressImage(idFile!)); form.set("cert_file", await compressImage(certFile!));
    try {
      const p = await api<MePayload>("/api/auth/register/provider", { app: "provider", form });
      acceptSession(p);
      toast.success("تم استلام طلب تسجيلك، وسيتم إشعارك بعد مراجعة الإدارة");
      onDone();
    } catch (e) { toast.error(errMsg(e, "تعذّر التسجيل")); }
    setBusy(false);
  };

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <Field label="الاسم الثلاثي"><input value={f.name} onChange={(e) => set("name")(e.target.value)} className={inputCls} maxLength={150} autoComplete="name" /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Field label="رقم الهوية / الإقامة"><input inputMode="numeric" dir="ltr" maxLength={10} value={f.nationalId} onChange={(e) => set("nationalId")(e.target.value.replace(/\D/g, ""))} className={inputCls} /></Field>
        <Field label="رقم الجوال"><input type="tel" dir="ltr" placeholder="05XXXXXXXX" value={f.phone} onChange={(e) => set("phone")(e.target.value)} className={inputCls} autoComplete="tel" /></Field>
        <Field label="الجنسية">
          <select value={f.nationality} onChange={(e) => set("nationality")(e.target.value)} className={inputCls}>
            {NATIONALITIES.map((n) => <option key={n}>{n}</option>)}
          </select>
        </Field>
        <Field label="الجنس">
          <select value={f.gender} onChange={(e) => set("gender")(e.target.value)} className={inputCls}>
            <option value="male">ذكر</option>
            <option value="female">أنثى</option>
          </select>
        </Field>
      </div>
      <Field label="المدينة التي تعمل بها"><RegionSelect value={f.region} onChange={set("region")} /></Field>
      <Field label="البريد الإلكتروني"><input type="email" dir="ltr" placeholder="email@example.com" value={f.email} onChange={(e) => set("email")(e.target.value)} className={inputCls} autoComplete="email" /></Field>
      <PasswordPair password={f.password} confirm={f.confirm} setPassword={set("password")} setConfirm={set("confirm")} />
      <ServicePicker picked={picked} toggle={toggle} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <FilePick label="إرفاق صورة الهوية / الإقامة" file={idFile} onPick={setIdFile} />
        <FilePick label="إرفاق الشهادة" file={certFile} onPick={setCertFile} />
      </div>
      <p className="text-[11px] text-muted-foreground">صورة أو PDF بحد أقصى 5MB. يُراجع الطلب من الإدارة قبل التفعيل.</p>
      <label className="flex items-start gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />أوافق على شروط الاستخدام وسياسة الخصوصية لمقدمي الخدمة</label>
      <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-50">{busy ? "جارٍ الإرسال..." : "إرسال طلب التسجيل"}</button>
    </form>
  );
}

/** For an account that is signed in to the provider app without a provider application yet. */
export function ProviderApplyForm() {
  const { acceptSession, profile } = useAuth();
  const [f, setF] = useState({ nationalId: profile?.national_id ?? "", nationality: profile?.nationality ?? "سعودي", gender: profile?.gender ?? "male", region: profile?.region ?? "" });
  const [picked, setPicked] = useState<string[]>([]);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const submit = async () => {
    if (!/^[12]\d{9}$/.test(f.nationalId)) return toast.error("رقم الهوية/الإقامة 10 أرقام يبدأ بـ 1 أو 2");
    if (!f.region) return toast.error("اختر المدينة التي تعمل بها");
    if (!picked.length) return toast.error("اختر خدمة واحدة على الأقل");
    const docError = validateDoc(idFile, "صورة الهوية") ?? validateDoc(certFile, "الشهادة");
    if (docError) return toast.error(docError);
    const form = new FormData();
    form.set("national_id", f.nationalId); form.set("nationality", f.nationality); form.set("gender", f.gender); form.set("region", f.region);
    setBusy(true);
    form.set("services", JSON.stringify(picked)); form.set("id_file", await compressImage(idFile!)); form.set("cert_file", await compressImage(certFile!));
    try {
      acceptSession(await api<MePayload>("/api/provider/apply", { form }));
      toast.success("تم إرسال طلب التسجيل للمراجعة");
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };
  return (
    <div className="mohemah-card p-4 space-y-3">
      <p className="text-sm font-bold">أكمل طلب التسجيل كمقدم خدمة</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Field label="رقم الهوية / الإقامة"><input inputMode="numeric" dir="ltr" maxLength={10} value={f.nationalId} onChange={(e) => set("nationalId")(e.target.value.replace(/\D/g, ""))} className={inputCls} /></Field>
        <Field label="الجنسية"><select value={f.nationality} onChange={(e) => set("nationality")(e.target.value)} className={inputCls}>{NATIONALITIES.map((n) => <option key={n}>{n}</option>)}</select></Field>
        <Field label="الجنس"><select value={f.gender} onChange={(e) => set("gender")(e.target.value)} className={inputCls}><option value="male">ذكر</option><option value="female">أنثى</option></select></Field>
        <Field label="المدينة"><RegionSelect value={f.region} onChange={set("region")} /></Field>
      </div>
      <ServicePicker picked={picked} toggle={(id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <FilePick label="إرفاق صورة الهوية / الإقامة" file={idFile} onPick={setIdFile} />
        <FilePick label="إرفاق الشهادة" file={certFile} onPick={setCertFile} />
      </div>
      <button onClick={submit} disabled={busy} className="w-full mohemah-btn-primary py-3 text-sm disabled:opacity-50">{busy ? "جارٍ الإرسال..." : "إرسال الطلب"}</button>
    </div>
  );
}
