import { Fragment, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { api, errMsg } from "@/lib/api";

const adm = <T,>(path: string) => api<T>(path, { app: "admin" });

interface Perf {
  id: string; name: string; phone: string | null; region: string | null; online: boolean; active: boolean; rating: number;
  offered: number; accepted: number; rejected: number; ignored: number; released: number; completed: number; customer_cancelled: number; warnings: number;
  accept_rate: number | null; response_rate: number | null; flag: "warn" | null;
}
interface Hist { kind: "reject" | "release"; reason: string | null; created_at: string; order_no: number; service_name: string; sub_service_name: string | null; region: string | null; status: string }

const cols = [
  { k: "offered", label: "وصله", hint: "طلبات ظهرت له" },
  { k: "accepted", label: "قبل" },
  { k: "rejected", label: "رفض" },
  { k: "ignored", label: "بلا رد", hint: "وصله ولم يقبل أو يرفض" },
  { k: "released", label: "ألغى بعد القبول" },
  { k: "completed", label: "أنجز" },
] as const;

/** Per-provider analysis: reached / accepted / declined / no response / cancelled (with reasons). */
export function AdminProviderPerformance() {
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<Perf[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [hist, setHist] = useState<Record<string, Hist[]>>({});
  const [sort, setSort] = useState<keyof Perf>("offered");

  useEffect(() => {
    adm<{ providers: Perf[] }>(`/api/admin/providers/performance?days=${days}`).then((r) => setRows(r.providers)).catch((e) => toast.error(errMsg(e)));
  }, [days]);

  const toggle = async (id: string) => {
    if (open === id) return setOpen(null);
    setOpen(id);
    if (!hist[id]) {
      try { const h = await adm<Hist[]>(`/api/admin/providers/${id}/performance`); setHist((x) => ({ ...x, [id]: h })); } catch (e) { toast.error(errMsg(e)); }
    }
  };
  const sorted = [...rows].sort((a, b) => Number(b[sort] ?? 0) - Number(a[sort] ?? 0));

  return (
    <section className="mt-6 bg-card border border-border rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h2 className="font-bold text-sm">تحليل أداء مقدمي الخدمة</h2>
        <select className="admin-input w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {[7, 30, 90, 365].map((d) => <option key={d} value={d}>آخر {d} يوماً</option>)}
        </select>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">
        يصل مقدم الخدمة تنبيه تلقائي في التطبيق عند كل 5 طلبات مرفوضة أو 3 طلبات ملغاة بعد القبول خلال 30 يوماً. الإلغاء بعد القبول يتطلب كتابة السبب. اضغط على أي صف لعرض الأسباب.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-right min-w-[860px]">
          <thead className="bg-mohemah-light text-muted-foreground">
            <tr>
              <th className="p-2">مقدم الخدمة</th>
              {cols.map((c) => <th key={c.k} className="p-2 cursor-pointer" title={"hint" in c ? c.hint : undefined} onClick={() => setSort(c.k)}>{c.label}{sort === c.k ? " ▾" : ""}</th>)}
              <th className="p-2 cursor-pointer" onClick={() => setSort("accept_rate")}>نسبة القبول</th>
              <th className="p-2">ألغاها العميل</th>
              <th className="p-2">تنبيهات</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <Fragment key={p.id}>
                <tr className={`border-t border-border cursor-pointer hover:bg-mohemah-light/40 ${p.flag ? "bg-amber-50/60" : ""}`} onClick={() => toggle(p.id)}>
                  <td className="p-2">
                    <span className="font-bold flex items-center gap-1">{p.flag && <AlertTriangle className="size-3.5 text-amber-600" />}{p.name}</span>
                    <span className="text-muted-foreground">{p.region ?? "—"} · {p.online ? "متصل" : "غير متصل"}{!p.active ? " · موقوف" : ""}</span>
                  </td>
                  <td className="p-2 font-bold">{p.offered}</td>
                  <td className="p-2 text-emerald-700 font-bold">{p.accepted}</td>
                  <td className={`p-2 ${p.rejected >= 5 ? "text-destructive font-bold" : ""}`}>{p.rejected}</td>
                  <td className="p-2">{p.ignored}</td>
                  <td className={`p-2 ${p.released >= 3 ? "text-destructive font-bold" : ""}`}>{p.released}</td>
                  <td className="p-2">{p.completed}</td>
                  <td className="p-2">{p.accept_rate === null ? "—" : `${p.accept_rate}%`}</td>
                  <td className="p-2">{p.customer_cancelled}</td>
                  <td className="p-2">{p.warnings}</td>
                  <td className="p-2">{open === p.id ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</td>
                </tr>
                {open === p.id && (
                  <tr className="border-t border-border bg-muted/40">
                    <td colSpan={11} className="p-3">
                      {!hist[p.id] ? <p className="text-muted-foreground">جاري التحميل…</p> : hist[p.id].length === 0 ? <p className="text-muted-foreground">لا يوجد رفض أو إلغاء.</p> : (
                        <ul className="space-y-1.5">
                          {hist[p.id].map((h, i) => (
                            <li key={i} className="flex flex-wrap gap-x-3 gap-y-0.5">
                              <span className={`px-2 rounded-full ${h.kind === "release" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{h.kind === "release" ? "إلغاء بعد القبول" : "رفض"}</span>
                              <span className="font-bold">#{h.order_no}</span>
                              <span>{h.sub_service_name ?? h.service_name}</span>
                              <span className="text-muted-foreground">{h.region ?? ""}</span>
                              <span className="text-muted-foreground" dir="ltr">{h.created_at.slice(0, 16).replace("T", " ")}</span>
                              {h.kind === "release" && <span className="w-full text-muted-foreground">السبب: {h.reason || "—"}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {!rows.length && <tr><td colSpan={11} className="p-3 text-muted-foreground">لا يوجد مقدمو خدمة.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
