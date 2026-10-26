import { useRef, useState } from "react";
import { useAdmin, AdminAd, AdminNotification, AdminPolicy, NOTIFICATION_PRESETS, NotifCategory, POLICY_PLACEMENTS, type PolicyPlacement } from "@/lib/adminStore";
import { Bell, Megaphone, Plus, Trash2, Send, Image as ImageIcon, FileText, Sparkles, Calendar, Pencil, Eye, Upload } from "lucide-react";
import { toast } from "sonner";
import { uploadAdminImage } from "@/lib/adminStore";
import { errMsg } from "@/lib/api";
import { NOTIF_ICONS, NotifIcon } from "@/lib/notifIcons";
import { Volume2, VolumeX } from "lucide-react";

function Header({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
    </label>
  );
}

function Stat({ label, value, icon: Icon, tone = "coral" }: { label: string; value: number | string; icon: any; tone?: "coral" | "blue" | "green" | "gold" }) {
  const c = { coral: "bg-mohemah-coral/10 text-mohemah-coral", blue: "bg-mohemah-blue/10 text-mohemah-blue", green: "bg-emerald-100 text-emerald-600", gold: "bg-amber-100 text-amber-600" }[tone];
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between">
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c}`}><Icon className="w-4 h-4" /></div>
    </div>
  );
}

const CATEGORY_STYLES: Record<NotifCategory, { bg: string; label: string }> = {
  "عام": { bg: "bg-slate-100 text-slate-700", label: "عام" },
  "وطني": { bg: "bg-emerald-100 text-emerald-700", label: "🇸🇦 وطني" },
  "ديني": { bg: "bg-violet-100 text-violet-700", label: "🌙 ديني" },
  "ترويجي": { bg: "bg-pink-100 text-pink-700", label: "🎁 ترويجي" },
  "تنبيه": { bg: "bg-amber-100 text-amber-700", label: "⚠️ تنبيه" },
  "صيانة": { bg: "bg-slate-200 text-slate-700", label: "🛠️ صيانة" },
};

function audienceLabel(a: AdminNotification["audience"] | AdminPolicy["audience"]) {
  return a === "all" ? "الجميع" : a === "customers" ? "طالبو الخدمات" : a === "providers" ? "مقدمو الخدمات" : "محدّدون";
}

/* =========================== Notifications =========================== */
export function AdminNotificationsPage() {
  const { notifications, sendNotification, removeNotification, customers, providers } = useAdmin();
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<typeof NOTIFICATION_PRESETS[number] | null>(null);

  return (
    <div>
      <Header
        title="مركز الإشعارات"
        subtitle="أرسل إشعارات احترافية لمناسبات وطنية ودينية وعروض ترويجية وتنبيهات"
        action={
          <div className="flex gap-2">
            <button onClick={() => { setPreset(null); setOpen(true); }} className="mohemah-btn-coral text-sm px-4 py-2 rounded-xl flex items-center gap-2">
              <Plus className="w-4 h-4" /> إشعار جديد
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="إجمالي الإشعارات" value={notifications.length} icon={Bell} />
        <Stat label="إشعارات عامة" value={notifications.filter((n) => n.scope === "عامة").length} icon={Megaphone} tone="blue" />
        <Stat label="مناسبات دينية" value={notifications.filter((n) => n.category === "ديني").length} icon={Sparkles} tone="gold" />
        <Stat label="مناسبات وطنية" value={notifications.filter((n) => n.category === "وطني").length} icon={Sparkles} tone="green" />
      </div>

      {/* Preset templates */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-mohemah-coral" />
          <h3 className="font-bold text-sm">قوالب جاهزة للمناسبات الوطنية والدينية</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {NOTIFICATION_PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => { setPreset(p); setOpen(true); }}
              className="text-right p-3 rounded-xl border border-border hover:border-mohemah-coral hover:shadow-md transition group"
              style={{ background: `linear-gradient(135deg, ${p.accentColor}10, transparent)` }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: `${p.accentColor}1f` }}><NotifIcon icon={p.icon} color={p.accentColor} size={20} /></span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${CATEGORY_STYLES[p.category].bg}`}>{CATEGORY_STYLES[p.category].label}</span>
              </div>
              <p className="font-bold text-xs leading-snug line-clamp-2 mt-2">{p.title}</p>
              <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{p.body}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-mohemah-light/50">
          <h3 className="font-bold text-sm">سجل الإشعارات المُرسلة</h3>
        </div>
        <div className="divide-y divide-border">
          {notifications.map((n) => (
            <div key={n.id} className="p-4 flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${n.accentColor ?? "#FF6B5C"}20` }}>
                <NotifIcon icon={n.icon} color={n.accentColor ?? "#FF6B5C"} size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-sm">{n.title}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${CATEGORY_STYLES[n.category].bg}`}>{CATEGORY_STYLES[n.category].label}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${n.scope === "عامة" ? "bg-mohemah-blue/15 text-mohemah-blue" : "bg-mohemah-coral/15 text-mohemah-coral"}`}>{n.scope}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{audienceLabel(n.audience)}</span>
                  {n.sound === false ? <VolumeX className="w-3.5 h-3.5 text-muted-foreground" aria-label="بدون صوت" /> : <Volume2 className="w-3.5 h-3.5 text-muted-foreground" aria-label="مع صوت" />}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{n.body}</p>
                <p className="text-[10px] text-muted-foreground mt-2">{n.sentAt}</p>
              </div>
              <button onClick={() => { removeNotification(n.id); toast.success("تم الحذف"); }} className="p-2 rounded-lg bg-red-50 text-red-600">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {notifications.length === 0 && <div className="p-8 text-center text-muted-foreground text-sm">لا توجد إشعارات</div>}
        </div>
      </div>

      {open && (
        <NotificationDialog
          preset={preset}
          customers={customers.map((c) => ({ id: c.id, label: c.name }))}
          providers={providers.map((p) => ({ id: p.id, label: p.name }))}
          onClose={() => { setOpen(false); setPreset(null); }}
          onSend={(d) => { sendNotification(d); toast.success("تم إرسال الإشعار"); setOpen(false); setPreset(null); }}
        />
      )}
    </div>
  );
}

function NotificationDialog({ preset, customers, providers, onClose, onSend }: {
  preset: typeof NOTIFICATION_PRESETS[number] | null;
  customers: { id: string; label: string }[];
  providers: { id: string; label: string }[];
  onClose: () => void;
  onSend: (d: Omit<AdminNotification, "id" | "sentAt">) => void;
}) {
  const [title, setTitle] = useState(preset?.title ?? "");
  const [body, setBody] = useState(preset?.body ?? "");
  const [audience, setAudience] = useState<AdminNotification["audience"]>("all");
  const [scope, setScope] = useState<AdminNotification["scope"]>("عامة");
  const [category, setCategory] = useState<NotifCategory>(preset?.category ?? "عام");
  const [icon, setIcon] = useState(preset?.icon ?? "bell");
  const [sound, setSound] = useState(true);
  const iconFile = useRef<HTMLInputElement>(null);
  const uploadIcon = (f?: File) => {
    if (!f) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(f.type)) return toast.error("اختر صورة PNG أو JPG أو WEBP أو SVG");
    uploadAdminImage(f).then((url) => { setIcon(url); toast.success("تم رفع الأيقونة"); }).catch((e) => toast.error(errMsg(e, "تعذر رفع الأيقونة")));
  };
  const [accentColor, setAccentColor] = useState(preset?.accentColor ?? "#FF6B5C");
  const [scheduledAt, setScheduledAt] = useState("");
  const [targets, setTargets] = useState<string[]>([]);

  const list = audience === "specific" ? [...customers.map(c => ({ ...c, kind: "طالب" })), ...providers.map(p => ({ ...p, kind: "مقدم" }))] : [];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl p-6 max-w-2xl w-full max-h-[92vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-1">إرسال إشعار جديد</h3>
        <p className="text-xs text-muted-foreground mb-4">حدد الجمهور المستهدف ونوع المناسبة</p>

        {/* Live preview */}
        <div className="rounded-2xl p-4 mb-4 border border-border" style={{ background: `linear-gradient(135deg, ${accentColor}15, transparent)` }}>
          <p className="text-[10px] text-muted-foreground mb-2">معاينة الإشعار</p>
          <div className="flex items-start gap-3 bg-card rounded-xl p-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${accentColor}25` }}><NotifIcon icon={icon} color={accentColor} size={20} /></div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">{title || "عنوان الإشعار"}</p>
              <p className="text-xs text-muted-foreground mt-1">{body || "محتوى الإشعار يظهر هنا..."}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <Field label="العنوان"><input value={title} onChange={(e) => setTitle(e.target.value)} className="admin-input" /></Field>
          <Field label="المحتوى"><textarea value={body} onChange={(e) => setBody(e.target.value)} className="admin-input min-h-24" /></Field>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="الجمهور المستهدف">
              <select value={audience} onChange={(e) => setAudience(e.target.value as any)} className="admin-input">
                <option value="all">الجميع</option>
                <option value="customers">طالبو الخدمات فقط</option>
                <option value="providers">مقدمو الخدمات فقط</option>
                <option value="specific">مستخدمون محددون</option>
              </select>
            </Field>
            <Field label="نوع المناسبة">
              <select value={category} onChange={(e) => setCategory(e.target.value as NotifCategory)} className="admin-input">
                <option value="عام">عام</option>
                <option value="وطني">🇸🇦 مناسبة وطنية</option>
                <option value="ديني">🌙 مناسبة دينية</option>
                <option value="ترويجي">🎁 عرض ترويجي</option>
                <option value="تنبيه">⚠️ تنبيه</option>
                <option value="صيانة">🛠️ صيانة</option>
              </select>
            </Field>
            <Field label="النطاق">
              <select value={scope} onChange={(e) => setScope(e.target.value as any)} className="admin-input">
                <option value="عامة">عامة</option>
                <option value="خاصة">خاصة</option>
              </select>
            </Field>
          </div>

          <Field label="الأيقونة" hint="اختر من الأيقونات أو ارفع أيقونتك الخاصة (PNG/SVG مربعة)">
            <div className="flex flex-wrap gap-1.5">
              {NOTIF_ICONS.map((x) => (
                <button key={x.key} type="button" title={x.label} onClick={() => setIcon(x.key)}
                  className={`w-10 h-10 rounded-xl grid place-items-center border transition ${icon === x.key ? "border-transparent ring-2" : "border-border hover:bg-mohemah-light"}`}
                  style={icon === x.key ? { background: `${accentColor}22`, boxShadow: `0 0 0 2px ${accentColor}` } : undefined}>
                  <x.Icon style={{ width: 18, height: 18, color: icon === x.key ? accentColor : undefined }} />
                </button>
              ))}
              <button type="button" onClick={() => iconFile.current?.click()} className="h-10 px-3 rounded-xl border border-dashed border-border text-xs flex items-center gap-1 hover:bg-mohemah-light">
                <Upload className="w-3.5 h-3.5" /> رفع أيقونة
              </button>
              <input ref={iconFile} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => { uploadIcon(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="لون مميز"><input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="admin-input h-10 p-1 cursor-pointer" /></Field>
            <Field label="جدولة الإرسال (اختياري)"><input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="admin-input" /></Field>
            <Field label="الصوت">
              <label className="admin-input h-10 flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} />
                {sound ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}<span className="text-xs">{sound ? "مع صوت التنبيه" : "صامت"}</span>
              </label>
            </Field>
          </div>

          {audience === "specific" && (
            <Field label="اختر المستلمين">
              <div className="max-h-44 overflow-auto border border-border rounded-xl p-2 space-y-1">
                {list.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-xs p-1.5 rounded-lg hover:bg-mohemah-light">
                    <input type="checkbox" checked={targets.includes(u.id)} onChange={() => setTargets((t) => t.includes(u.id) ? t.filter((x) => x !== u.id) : [...t, u.id])} />
                    <span className="font-medium">{u.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{u.kind}</span>
                    <span className="text-muted-foreground mr-auto">{u.id}</span>
                  </label>
                ))}
              </div>
            </Field>
          )}
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-mohemah-light text-sm font-bold">إلغاء</button>
          <button
            onClick={() => title && body && onSend({ title, body, audience, scope, category, icon, accentColor, sound, scheduledAt: scheduledAt || undefined, targetIds: audience === "specific" ? targets : undefined })}
            className="flex-1 py-2.5 rounded-xl mohemah-btn-coral text-sm font-bold flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" /> {scheduledAt ? "جدولة الإرسال" : "إرسال الآن"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================== Ads =========================== */
export function AdminAdsPage() {
  const { ads, addAd, updateAd, removeAd } = useAdmin();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminAd | null>(null);

  return (
    <div>
      <Header
        title="المساحات الإعلانية"
        subtitle="إدارة الإعلانات والبانرات التي تظهر للمستخدمين داخل التطبيق"
        action={<button onClick={() => { setEditing(null); setOpen(true); }} className="mohemah-btn-coral text-sm px-4 py-2 rounded-xl flex items-center gap-2"><Plus className="w-4 h-4" /> إعلان جديد</button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="إجمالي الإعلانات" value={ads.length} icon={Megaphone} />
        <Stat label="إعلانات نشطة" value={ads.filter(a => a.active).length} icon={Eye} tone="green" />
        <Stat label="إعلانات موقوفة" value={ads.filter(a => !a.active).length} icon={Trash2} tone="coral" />
        <Stat label="متوسط المدة" value={`${Math.round(ads.reduce((s, a) => s + a.durationDays, 0) / Math.max(1, ads.length))} يوم`} icon={Calendar} tone="blue" />
      </div>

      <div className="bg-mohemah-blue/5 border border-mohemah-blue/20 rounded-2xl p-3 mb-5 flex items-start gap-2 text-xs text-mohemah-blue">
        <ImageIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <p>المقاسات المقترحة للإعلانات: <b>بانر علوي 1200×400</b> (نسبة 3:1) — <b>بانر سفلي 1200×300</b> (نسبة 4:1) — <b>بطاقة منبثقة 800×600</b> (نسبة 4:3). الصور العرضية تعطي مظهراً احترافياً.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ads.map((a) => (
          <div key={a.id} className="bg-card border border-border rounded-2xl overflow-hidden">
            {/* Landscape banner preview 3:1 */}
            <div className="relative w-full bg-gradient-to-l from-mohemah-coral to-mohemah-blue overflow-hidden" style={{ aspectRatio: "3 / 1" }}>
              {a.imageUrl ? (
                <img src={a.imageUrl} alt={a.title} className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-primary-foreground">
                  <div className="text-center">
                    <Megaphone className="w-8 h-8 mx-auto mb-1 opacity-80" />
                    <p className="font-bold">{a.title}</p>
                    <p className="text-xs opacity-80">{a.sponsor}</p>
                  </div>
                </div>
              )}
              <span className={`absolute top-2 right-2 text-[10px] px-2 py-1 rounded-full ${a.active ? "bg-emerald-500 text-white" : "bg-slate-700/80 text-white"}`}>{a.active ? "نشط" : "موقوف"}</span>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-bold">{a.title}</p>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-mohemah-light text-muted-foreground">{a.placement ?? "بانر علوي"}</span>
              </div>
              <p className="text-xs text-muted-foreground">{a.sponsor}</p>
              <div className="text-[11px] text-muted-foreground mt-3 flex justify-between border-t border-border pt-3">
                <span>من: {a.startDate}</span>
                <span>إلى: {a.endDate}</span>
                <span>{a.durationDays} يوم</span>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => updateAd(a.id, { active: !a.active })} className="flex-1 py-1.5 rounded-lg bg-mohemah-light text-xs font-bold">{a.active ? "إيقاف" : "تفعيل"}</button>
                <button onClick={() => { setEditing(a); setOpen(true); }} className="flex-1 py-1.5 rounded-lg bg-mohemah-blue/10 text-mohemah-blue text-xs font-bold flex items-center justify-center gap-1"><Pencil className="w-3 h-3" /> تعديل</button>
                <button onClick={() => { removeAd(a.id); toast.success("تم الحذف"); }} className="p-2 rounded-lg bg-red-50 text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </div>
        ))}
        {ads.length === 0 && <p className="text-center text-sm text-muted-foreground py-8 col-span-full">لا توجد إعلانات</p>}
      </div>

      {open && <AdDialog
        initial={editing ?? undefined}
        onClose={() => { setOpen(false); setEditing(null); }}
        onSave={(d) => {
          if (editing) { updateAd(editing.id, d); toast.success("تم التحديث"); }
          else { addAd(d); toast.success("تم الإضافة"); }
          setOpen(false); setEditing(null);
        }}
      />}
    </div>
  );
}

function AdDialog({ initial, onClose, onSave }: { initial?: AdminAd; onClose: () => void; onSave: (d: Omit<AdminAd, "id">) => void }) {
  const [sponsor, setSponsor] = useState(initial?.sponsor ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [link, setLink] = useState(initial?.link ?? "");
  const [placement, setPlacement] = useState<AdminAd["placement"]>(initial?.placement ?? "بانر علوي");
  const [startDate, setStart] = useState(initial?.startDate ?? new Date().toISOString().slice(0, 10));
  const [endDate, setEnd] = useState(initial?.endDate ?? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [active, setActive] = useState(initial?.active ?? true);
  const fileRef = useRef<HTMLInputElement>(null);

  const duration = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000));
  const recommended = placement === "بانر علوي" ? "1200×400 (3:1)" : placement === "بانر سفلي" ? "1200×300 (4:1)" : "800×600 (4:3)";
  const aspect = placement === "بانر علوي" ? "3 / 1" : placement === "بانر سفلي" ? "4 / 1" : "4 / 3";

  const handleFile = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) { toast.error("الحد الأقصى 3MB"); return; }
    uploadAdminImage(f).then(setImageUrl).catch((e) => toast.error(errMsg(e, "تعذر رفع الصورة")));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl p-6 max-w-xl w-full max-h-[92vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">{initial ? "تعديل إعلان" : "إعلان جديد"}</h3>

        {/* Preview */}
        <div className="mb-4">
          <p className="text-[10px] text-muted-foreground mb-1">معاينة بنفس مقاس الإعلان ({recommended})</p>
          <div className="relative w-full rounded-xl overflow-hidden bg-gradient-to-l from-mohemah-coral to-mohemah-blue border border-border" style={{ aspectRatio: aspect }}>
            {imageUrl ? <img src={imageUrl} alt="" className="w-full h-full object-cover" /> :
              <div className="absolute inset-0 flex items-center justify-center text-primary-foreground text-sm">{title || "معاينة الإعلان"}</div>}
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Field label="اسم الجهة المعلنة"><input value={sponsor} onChange={(e) => setSponsor(e.target.value)} className="admin-input" /></Field>
            <Field label="عنوان الإعلان"><input value={title} onChange={(e) => setTitle(e.target.value)} className="admin-input" /></Field>
          </div>

          <Field label="مكان عرض الإعلان" hint={`المقاس المقترح: ${recommended}`}>
            <select value={placement} onChange={(e) => setPlacement(e.target.value as AdminAd["placement"])} className="admin-input">
              <option value="بانر علوي">بانر علوي (3:1)</option>
              <option value="بانر سفلي">بانر سفلي (4:1)</option>
              <option value="بطاقة منبثقة">بطاقة منبثقة (4:3)</option>
            </select>
          </Field>

          <Field label="صورة الإعلان" hint="استخدم صورة عرضية باللون المناسب لهوية الجهة">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="px-3 py-2 rounded-xl bg-mohemah-blue/10 text-mohemah-blue text-xs font-bold flex items-center gap-2">
                <Upload className="w-3.5 h-3.5" /> رفع صورة
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={(e) => handleFile(e.target.files?.[0])} className="hidden" />
              {imageUrl && <button type="button" onClick={() => setImageUrl("")} className="px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-bold">إزالة</button>}
              <input value={imageUrl.startsWith("data:") ? "" : imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="أو ألصق رابط صورة..." className="admin-input flex-1" />
            </div>
          </Field>

          <Field label="رابط الإعلان (اختياري)"><input value={link} onChange={(e) => setLink(e.target.value)} className="admin-input" /></Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="تاريخ البداية"><input type="date" value={startDate} onChange={(e) => setStart(e.target.value)} className="admin-input" /></Field>
            <Field label="تاريخ النهاية"><input type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} className="admin-input" /></Field>
          </div>
          <div className="flex items-center justify-between bg-mohemah-light rounded-xl p-3">
            <span className="text-xs">المدة المحسوبة: <b>{duration}</b> يوم</span>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> مفعّل</label>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-mohemah-light text-sm font-bold">إلغاء</button>
          <button onClick={() => sponsor && title && onSave({ sponsor, title, imageUrl, link, startDate, endDate, durationDays: duration, active, placement })} className="flex-1 py-2.5 rounded-xl mohemah-btn-coral text-sm font-bold">حفظ</button>
        </div>
      </div>
    </div>
  );
}

/* =========================== Policies =========================== */
const POLICY_TEMPLATES: { type: AdminPolicy["type"]; title: string; body: string; audience: AdminPolicy["audience"] }[] = [
  { type: "خصوصية", audience: "all", title: "سياسة الخصوصية",
    body: "نلتزم في تطبيق مهمة بحماية البيانات الشخصية لمستخدمينا، ولا تتم مشاركتها مع أي طرف ثالث إلا وفق الأنظمة المعمول بها في المملكة العربية السعودية..." },
  { type: "شروط استخدام", audience: "all", title: "شروط الاستخدام",
    body: "باستخدامك تطبيق مهمة فإنك توافق على الالتزام بالشروط والأحكام التالية..." },
  { type: "سياسة دفع", audience: "providers", title: "سياسة الدفع والكوينز",
    body: "يتم خصم عدد محدد من الكوينز من رصيد مقدم الخدمة عند قبول كل طلب، ولا يمكن استرداد الكوينز المُخصومة بعد القبول..." },
  { type: "سياسة استرداد", audience: "customers", title: "سياسة الإلغاء والاسترداد",
    body: "يحق لطالب الخدمة إلغاء الطلب قبل قبوله من مقدم الخدمة دون أي رسوم..." },
];

export function AdminPoliciesPage() {
  const { policies, addPolicy, updatePolicy, removePolicy } = useAdmin();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminPolicy | null>(null);
  const [seed, setSeed] = useState<typeof POLICY_TEMPLATES[number] | null>(null);

  return (
    <div>
      <Header
        title="السياسات والشروط"
        subtitle="إدارة سياسات الخصوصية والشروط الخاصة بكل فئة من المستخدمين"
        action={<button onClick={() => { setEditing(null); setSeed(null); setOpen(true); }} className="mohemah-btn-coral text-sm px-4 py-2 rounded-xl flex items-center gap-2"><Plus className="w-4 h-4" /> سياسة جديدة</button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="إجمالي السياسات" value={policies.length} icon={FileText} />
        <Stat label="منشورة" value={policies.filter(p => p.published).length} icon={Eye} tone="green" />
        <Stat label="للمقدمين فقط" value={policies.filter(p => p.audience === "providers").length} icon={FileText} tone="blue" />
        <Stat label="للطالبين فقط" value={policies.filter(p => p.audience === "customers").length} icon={FileText} tone="gold" />
      </div>

      {/* Templates */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-mohemah-coral" />
          <h3 className="font-bold text-sm">قوالب جاهزة</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {POLICY_TEMPLATES.map((t) => (
            <button key={t.type + t.audience} onClick={() => { setSeed(t); setEditing(null); setOpen(true); }} className="text-right p-3 rounded-xl border border-border hover:border-mohemah-coral transition">
              <p className="font-bold text-xs">{t.title}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{audienceLabel(t.audience)} · {t.type}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {policies.map((p) => (
          <div key={p.id} className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <FileText className="w-4 h-4 text-mohemah-coral" />
                <h4 className="font-bold">{p.title}</h4>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-mohemah-blue/10 text-mohemah-blue">{p.type}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{audienceLabel(p.audience)}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-mohemah-light">v{p.version}</span>
                {p.placements.map((k) => <span key={k} className="text-[10px] px-2 py-0.5 rounded-full border border-border">{POLICY_PLACEMENTS.find((o) => o.key === k)?.label.split(" (")[0] ?? k}</span>)}
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.published ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{p.published ? "منشورة" : "مسودة"}</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => updatePolicy(p.id, { published: !p.published })} className="px-3 py-1.5 rounded-lg bg-mohemah-light text-xs font-bold">{p.published ? "إلغاء النشر" : "نشر"}</button>
                <button onClick={() => { setEditing(p); setSeed(null); setOpen(true); }} className="p-2 rounded-lg bg-mohemah-blue/10 text-mohemah-blue"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => { removePolicy(p.id); toast.success("تم الحذف"); }} className="p-2 rounded-lg bg-red-50 text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">{p.body}</p>
            <p className="text-[10px] text-muted-foreground mt-3">آخر تحديث: {p.updatedAt}</p>
          </div>
        ))}
        {policies.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">لا توجد سياسات بعد</p>}
      </div>

      {open && <PolicyDialog
        initial={editing ?? undefined}
        seed={seed ?? undefined}
        onClose={() => { setOpen(false); setEditing(null); setSeed(null); }}
        onSave={(d) => {
          if (editing) { updatePolicy(editing.id, d); toast.success("تم التحديث"); }
          else { addPolicy(d); toast.success("تم الإضافة"); }
          setOpen(false); setEditing(null); setSeed(null);
        }}
      />}
    </div>
  );
}

function PolicyDialog({ initial, seed, onClose, onSave }: {
  initial?: AdminPolicy;
  seed?: typeof POLICY_TEMPLATES[number];
  onClose: () => void;
  onSave: (d: Omit<AdminPolicy, "id" | "updatedAt">) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? seed?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? seed?.body ?? "");
  const [audience, setAudience] = useState<AdminPolicy["audience"]>(initial?.audience ?? seed?.audience ?? "all");
  const [type, setType] = useState<AdminPolicy["type"]>(initial?.type ?? seed?.type ?? "سياسة عامة");
  const [version, setVersion] = useState(initial?.version ?? "1.0");
  const [published, setPublished] = useState(initial?.published ?? true);
  const [placements, setPlacements] = useState<PolicyPlacement[]>(initial?.placements ?? ["registration", "account"]);
  const options = POLICY_PLACEMENTS.filter((o) => audience === "all" || o.who === "all" || o.who === audience);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl p-6 max-w-2xl w-full max-h-[92vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">{initial ? "تعديل سياسة" : "سياسة جديدة"}</h3>

        <div className="space-y-3 text-sm">
          <Field label="عنوان السياسة"><input value={title} onChange={(e) => setTitle(e.target.value)} className="admin-input" /></Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="موجّهة إلى">
              <select value={audience} onChange={(e) => setAudience(e.target.value as any)} className="admin-input">
                <option value="all">الجميع</option>
                <option value="customers">طالبو الخدمات</option>
                <option value="providers">مقدمو الخدمات</option>
              </select>
            </Field>
            <Field label="نوع السياسة">
              <select value={type} onChange={(e) => setType(e.target.value as any)} className="admin-input">
                <option value="خصوصية">خصوصية</option>
                <option value="شروط استخدام">شروط استخدام</option>
                <option value="سياسة دفع">سياسة دفع</option>
                <option value="سياسة استرداد">سياسة استرداد</option>
                <option value="سياسة عامة">سياسة عامة</option>
              </select>
            </Field>
            <Field label="رقم الإصدار"><input value={version} onChange={(e) => setVersion(e.target.value)} className="admin-input" /></Field>
          </div>

          <Field label="أين تظهر؟" hint="تظهر السياسة لمن اخترته في «موجّهة إلى»، وفي الأماكن المحددة هنا فقط.">
            <div className="grid sm:grid-cols-2 gap-1.5">
              {options.map((o) => (
                <label key={o.key} className="flex items-center gap-2 text-xs border border-border rounded-lg px-2.5 py-2 cursor-pointer hover:bg-mohemah-light">
                  <input type="checkbox" checked={placements.includes(o.key)} onChange={(e) => setPlacements((p) => e.target.checked ? [...p, o.key] : p.filter((x) => x !== o.key))} />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </Field>

          <Field label="نص السياسة"><textarea value={body} onChange={(e) => setBody(e.target.value)} className="admin-input min-h-48" /></Field>

          <label className="flex items-center gap-2 text-xs bg-mohemah-light rounded-xl p-3">
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
            <span>نشر السياسة فوراً في التطبيق</span>
          </label>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-mohemah-light text-sm font-bold">إلغاء</button>
          <button onClick={() => {
            const where = placements.filter((k) => options.some((o) => o.key === k));
            if (!title || !body) return toast.error("أكمل العنوان والنص");
            if (!where.length) return toast.error("اختر مكاناً واحداً على الأقل لظهور السياسة");
            onSave({ title, body, audience, type, version, published, placements: where });
          }} className="flex-1 py-2.5 rounded-xl mohemah-btn-coral text-sm font-bold">حفظ</button>
        </div>
      </div>
    </div>
  );
}
