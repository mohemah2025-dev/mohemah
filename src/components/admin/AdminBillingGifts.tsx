import { useState } from "react";
import { Gift } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAdmin } from "@/lib/adminStore";
import { api, errMsg } from "@/lib/api";

export function AdminBillingGifts() {
  const { providers, refreshAll } = useAdmin();
  const [kind, setKind] = useState("subscription");
  const [target, setTarget] = useState("");
  const [period, setPeriod] = useState("7");
  const [days, setDays] = useState(7);
  const [coins, setCoins] = useState(10);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const grant = async () => {
    if (!target) return toast.error("اختر مقدم الخدمة أو جميع مقدمي الخدمات");
    if (target === "all" && !confirmAll) return toast.error("أكد منح الهدية لجميع مقدمي الخدمات");
    if (kind === "coins" && (!Number.isInteger(coins) || coins < 1)) return toast.error("أدخل عدد كوينز صحيحاً");
    if (kind === "subscription" && period === "dates" && (!start || !end || new Date(end) <= new Date(start))) return toast.error("حدد وقت بداية ونهاية صحيحين");
    if (kind === "subscription" && period !== "dates" && (!Number.isInteger(days) || days < 1)) return toast.error("أدخل عدد أيام صحيحاً");
    setBusy(true);
    const body = {
      kind, coins: kind === "coins" ? coins : undefined,
      days: kind === "subscription" && period !== "dates" ? days : undefined,
      starts_at: start ? new Date(start).toISOString() : undefined,
      ends_at: kind === "subscription" && period === "dates" ? new Date(end).toISOString() : undefined,
      note, provider_id: target === "all" ? undefined : target,
    };
    let result: { count?: number } | null = null;
    try { result = await api<{ count: number }>("/api/admin/grant", { app: "admin", body }); }
    catch (e) { setBusy(false); return toast.error(errMsg(e, "تعذّر منح الهدية")); }
    setBusy(false);
    toast.success(`تم منح الهدية وإرسال الإشعار إلى ${result?.count ?? 1} من مقدمي الخدمات`);
    setConfirmAll(false);
    await refreshAll();
  };
  return <section className="my-6 border-t border-border pt-5 space-y-4">
    <h2 className="font-bold flex items-center gap-2"><Gift className="size-5 text-mohemah-coral" />الاشتراكات المجانية وهدايا الكوينز</h2>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label className="text-sm">نوع الهدية<select aria-label="نوع الهدية" className="admin-input mt-1" value={kind} onChange={e => setKind(e.target.value)}><option value="subscription">اشتراك مجاني</option><option value="coins">كوينز هدية</option></select></label>
      <label className="text-sm">المستفيد<select aria-label="المستفيد" className="admin-input mt-1" value={target} onChange={e => { setTarget(e.target.value); setConfirmAll(false); }}><option value="">اختر المستفيد</option><option value="all">جميع مقدمي الخدمات</option>{providers.map(p => <option key={p.id} value={p.id}>{p.name}{p.phone ? ` — ${p.phone}` : ""}</option>)}</select></label>
      {kind === "coins" ? <label className="text-sm">عدد الكوينز<input aria-label="عدد الكوينز" className="admin-input mt-1" type="number" min={1} max={1000000} step={1} value={coins} onChange={e => setCoins(Number(e.target.value))} /></label> : <>
        <label className="text-sm">مدة الاشتراك<select aria-label="مدة الاشتراك" className="admin-input mt-1" value={period} onChange={e => { setPeriod(e.target.value); if (e.target.value !== "custom" && e.target.value !== "dates") setDays(Number(e.target.value)); }}><option value="7">أسبوع مجاني</option><option value="30">30 يوماً مجاناً</option><option value="custom">عدد أيام مخصص</option><option value="dates">من وقت محدد إلى وقت محدد</option></select></label>
        {period === "custom" && <label className="text-sm">عدد الأيام<input type="number" min={1} max={3660} step={1} value={days} onChange={e => setDays(Number(e.target.value))} className="admin-input mt-1" /></label>}
        <label className="text-sm">{period === "dates" ? "وقت البداية" : "وقت البداية (فارغ = الآن)"}<input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} className="admin-input mt-1" /></label>
        {period === "dates" && <label className="text-sm">وقت الانتهاء<input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} className="admin-input mt-1" /></label>}
      </>}
    </div>
    <label className="block text-sm">ملاحظة الهدية<textarea className="admin-input mt-1" maxLength={500} value={note} onChange={e => setNote(e.target.value)} /></label>
    {target === "all" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmAll} onChange={e => setConfirmAll(e.target.checked)} />أؤكد منح الهدية لجميع مقدمي الخدمات</label>}
    <Button disabled={busy} onClick={grant}><Gift />{busy ? "جارٍ المنح…" : "منح الهدية"}</Button>
  </section>;
}