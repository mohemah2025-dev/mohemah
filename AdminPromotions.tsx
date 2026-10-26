import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BadgePercent, Plus, Trash2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useAdmin } from "@/lib/adminStore";
import { useAuth } from "@/lib/AuthContext";
import { NOTIF_ICONS } from "@/lib/notifIcons";

const adm = <T,>(path: string, opts: { method?: string; body?: unknown } = {}) => api<T>(path, { ...opts, app: "admin" });

interface Promo {
  id: string; title: string; kind: "percent" | "free" | "amount"; value: number; scope: "all" | "service"; service_id: string | null; service_name: string | null;
  applies_to: "orders" | "subscriptions" | "topups" | "all"; starts_at: string; ends_at: string; active: number;
}

const KIND = { percent: "نسبة مئوية", free: "مجاني بالكامل", amount: "مبلغ محدد" };
const TARGET = { orders: "قبول الطلبات (الكوينز)", subscriptions: "الاشتراكات", topups: "شحن الكوينز", all: "الكل" };
const OCCASIONS = ["عرض العيد", "عرض رمضان", "عرض اليوم الوطني", "عرض يوم التأسيس", "عرض نهاية الأسبوع"];

const toLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

function describe(p: Promo) {
  const v = p.kind === "free" ? "مجاناً" : p.kind === "percent" ? `خصم ${p.value}%` : `خصم ${p.value}`;
  return `${v} على ${TARGET[p.applies_to]}${p.scope === "service" ? ` · قسم ${p.service_name ?? "—"}` : " · كل الأقسام"}`;
}

export function AdminPromotionsPage() {
  const { services } = useAdmin();
  const { can } = useAuth();
  const canEdit = can("billing", "edit");
  const [list, setList] = useState<Promo[]>([]);
  const [open, setOpen] = useState(false);
  const load = () => adm<Promo[]>("/api/admin/promotions").then(setList).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []);

  const now = new Date().toISOString();
  const status = (p: Promo) => !p.active ? "موقوف" : p.ends_at <= now ? "انتهى" : p.starts_at > now ? "مجدول" : "فعّال";

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">العروض والخصومات</h1>
          <p className="text-xs text-muted-foreground">خصومات المناسبات لمقدمي الخدمة: نسبة، أو مجاني بالكامل، أو مبلغ محدد، للكل أو لقسم معيّن. تُطبَّق تلقائياً في الخادم خلال فترة العرض.</p>
        </div>
        {canEdit && <button onClick={() => setOpen(true)} className="mohemah-btn-coral text-sm px-4 py-2 rounded-xl flex items-center gap-2"><Plus className="w-4 h-4" /> عرض جديد</button>}
      </div>

      <div className="bg-card border border-border rounded-2xl divide-y divide-border">
        {list.map((p) => {
          const st = status(p);
          return (
            <div key={p.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-pink-100 text-pink-600 grid place-items-center shrink-0"><BadgePercent className="w-5 h-5" /></div>
                <div className="min-w-0">
                  <p className="font-bold text-sm">{p.title} <span className={`text-[10px] px-2 py-0.5 rounded-full mr-1 ${st === "فعّال" ? "bg-emerald-100 text-emerald-700" : st === "مجدول" ? "bg-sky-100 text-sky-700" : "bg-muted text-muted-foreground"}`}>{st}</span></p>
                  <p className="text-xs text-muted-foreground">{describe(p)}</p>
                  <p className="text-[11px] text-muted-foreground" dir="ltr" style={{ textAlign: "right" }}>{p.starts_at.slice(0, 16).replace("T", " ")} → {p.ends_at.slice(0, 16).replace("T", " ")}</p>
                </div>
              </div>
              {canEdit && (
                <div className="flex items-center gap-2 text-xs">
                  <button onClick={async () => { try { await adm(`/api/admin/promotions/${p.id}`, { method: "PATCH", body: { active: !p.active } }); load(); } catch (e) { toast.error(errMsg(e)); } }}
                    className="px-3 py-1.5 rounded-lg bg-mohemah-light font-bold">{p.active ? "إيقاف" : "تفعيل"}</button>
                  <button onClick={async () => { try { await adm(`/api/admin/promotions/${p.id}`, { method: "DELETE" }); toast.success("تم الحذف"); load(); } catch (e) { toast.error(errMsg(e)); } }}
                    className="p-2 rounded-lg bg-red-50 text-red-600" aria-label="حذف"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </div>
          );
        })}
        {!list.length && <p className="p-6 text-center text-sm text-muted-foreground">لا توجد عروض بعد.</p>}
      </div>

      {open && <PromoDialog services={services.map((s) => ({ id: s.id, name: s.name }))} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load(); }} />}
    </div>
  );
}

function PromoDialog({ services, onClose, onSaved }: { services: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(OCCASIONS[0]);
  const [kind, setKind] = useState<Promo["kind"]>("percent");
  const [value, setValue] = useState(20);
  const [scope, setScope] = useState<Promo["scope"]>("all");
  const [serviceId, setServiceId] = useState("");
  const [appliesTo, setAppliesTo] = useState<Promo["applies_to"]>("orders");
  const [start, setStart] = useState(toLocal(new Date()));
  const [end, setEnd] = useState(toLocal(new Date(Date.now() + 3 * 86400000)));
  const [notify, setNotify] = useState(true);
  const [icon, setIcon] = useState("percent");
  const [busy, setBusy] = useState(false);
  const svcName = services.find((s) => s.id === serviceId)?.name;
  const summary = `${kind === "free" ? "مجاناً" : kind === "percent" ? `خصم ${value}%` : `خصم ${value}`} على ${TARGET[appliesTo]}${scope === "service" && svcName ? ` في ${svcName}` : ""}`;
  const [nTitle, setNTitle] = useState("");
  const [nBody, setNBody] = useState("");

  const save = async () => {
    if (scope === "service" && !serviceId) return toast.error("اختر القسم");
    setBusy(true);
    try {
      await adm("/api/admin/promotions", { body: {
        title, kind, value: kind === "free" ? 100 : value, scope, service_id: scope === "service" ? serviceId : null, applies_to: appliesTo,
        starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString(),
        notify, notify_title: nTitle || `${title} 🎉`, notify_body: nBody || `${summary} حتى ${end.replace("T", " ")}. استفد من العرض الآن!`, notify_icon: icon,
      } });
      toast.success(notify ? "تم إنشاء العرض وإرسال الإشعار لمقدمي الخدمة" : "تم إنشاء العرض");
      onSaved();
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl p-6 max-w-xl w-full max-h-[92vh] overflow-auto space-y-3 text-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold">عرض جديد</h3>
        <label className="block"><span className="text-xs text-muted-foreground">اسم العرض / المناسبة</span>
          <input list="occasions" value={title} onChange={(e) => setTitle(e.target.value)} className="admin-input mt-1" />
          <datalist id="occasions">{OCCASIONS.map((o) => <option key={o} value={o} />)}</datalist>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-xs text-muted-foreground">نوع الخصم</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as Promo["kind"])} className="admin-input mt-1">
              {Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          {kind !== "free" && (
            <label className="block"><span className="text-xs text-muted-foreground">{kind === "percent" ? "النسبة %" : "المبلغ (كوين أو ريال حسب المجال)"}</span>
              <input type="number" min={1} max={kind === "percent" ? 100 : undefined} value={value} onChange={(e) => setValue(Number(e.target.value))} className="admin-input mt-1" />
            </label>
          )}
          <label className="block"><span className="text-xs text-muted-foreground">يُطبَّق على</span>
            <select value={appliesTo} onChange={(e) => setAppliesTo(e.target.value as Promo["applies_to"])} className="admin-input mt-1">
              {Object.entries(TARGET).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="block"><span className="text-xs text-muted-foreground">النطاق</span>
            <select value={scope} onChange={(e) => setScope(e.target.value as Promo["scope"])} className="admin-input mt-1">
              <option value="all">كل الأقسام</option><option value="service">قسم محدد</option>
            </select>
          </label>
          {scope === "service" && (
            <label className="block col-span-2"><span className="text-xs text-muted-foreground">القسم</span>
              <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="admin-input mt-1">
                <option value="">اختر القسم</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          )}
          <label className="block"><span className="text-xs text-muted-foreground">يبدأ</span><input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="admin-input mt-1" /></label>
          <label className="block"><span className="text-xs text-muted-foreground">ينتهي</span><input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="admin-input mt-1" /></label>
        </div>
        <p className="text-xs bg-pink-50 text-pink-800 rounded-lg p-2">{summary}. {scope === "service" && appliesTo !== "orders" ? "تنبيه: القسم المحدد يؤثر على قبول الطلبات فقط؛ الاشتراك والشحن لا يرتبطان بقسم." : ""}</p>

        <label className="flex items-center gap-2 text-xs bg-mohemah-light rounded-xl p-3"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />إرسال إشعار بالعرض لمقدمي الخدمة (مع صوت)</label>
        {notify && (
          <div className="space-y-2">
            <input value={nTitle} onChange={(e) => setNTitle(e.target.value)} placeholder={`${title} 🎉`} className="admin-input" />
            <textarea value={nBody} onChange={(e) => setNBody(e.target.value)} placeholder={`${summary} حتى ${end.replace("T", " ")}. استفد من العرض الآن!`} className="admin-input min-h-16" />
            <div className="flex flex-wrap gap-1.5">
              {NOTIF_ICONS.filter((x) => ["percent", "gift", "tag", "moon", "flag", "palm", "party", "sparkles", "star"].includes(x.key)).map((x) => (
                <button key={x.key} type="button" onClick={() => setIcon(x.key)} title={x.label}
                  className={`w-9 h-9 rounded-lg grid place-items-center border ${icon === x.key ? "border-pink-500 bg-pink-50 text-pink-600" : "border-border"}`}><x.Icon className="w-4 h-4" /></button>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-mohemah-light text-sm font-bold">إلغاء</button>
          <button onClick={save} disabled={busy} className="flex-1 py-2.5 rounded-xl mohemah-btn-coral text-sm font-bold disabled:opacity-50">{busy ? "جارٍ الحفظ…" : "إنشاء العرض"}</button>
        </div>
      </div>
    </div>
  );
}
