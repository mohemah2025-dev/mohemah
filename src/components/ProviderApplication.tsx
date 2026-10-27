import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Clock, XCircle, FileText, Check, X, Upload } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { usePublicData } from "@/lib/publicData";
import { DOC_ACCEPT, docKindLabel, listProviderDocs, uploadProviderDocs, validateDoc, type DocLink } from "@/lib/providerDocs";
import { ProviderApplyForm } from "@/components/RegistrationForms";

/** Applicant-facing status of a provider registration (provider app). */
export function ProviderApplicationStatus() {
  const { user, profile, isProvider, refreshProfile } = useAuth();
  const [idFile, setIdFile] = useState<File | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const status = profile?.verification_status ?? "none";
  if (!user || isProvider) return null;
  if (status === "none") return <ProviderApplyForm />;

  const upload = async () => {
    if (!idFile && !certFile) return toast.error("اختر ملفاً واحداً على الأقل");
    const err = (idFile && validateDoc(idFile, "صورة الهوية")) || (certFile && validateDoc(certFile, "الشهادة"));
    if (err) return toast.error(err);
    setBusy(true);
    try {
      await uploadProviderDocs(idFile, certFile);
      toast.success("تم رفع المرفقات للمراجعة");
      setIdFile(null); setCertFile(null); refreshProfile();
    } catch (e) { toast.error(errMsg(e, "تعذّر رفع المرفقات")); }
    setBusy(false);
  };

  return (
    <div className="mohemah-card p-4 text-sm space-y-3">
      <div className="flex items-center gap-2">
        {status === "pending" ? <Clock className="w-5 h-5 text-primary" /> : <XCircle className="w-5 h-5 text-destructive" />}
        <p className="font-bold">{status === "pending" ? "طلب تسجيلك كمقدم خدمة قيد المراجعة" : "لم تتم الموافقة على طلب التسجيل"}</p>
      </div>
      {status === "pending" && <p className="text-xs text-muted-foreground">سنشعرك هنا فور موافقة الإدارة، وبعدها تستطيع تفعيل الاتصال واستقبال الطلبات.</p>}
      {status === "rejected" && profile?.review_note && <p className="text-xs text-muted-foreground">ملاحظة الإدارة: {profile.review_note}</p>}
      <p className="text-xs text-muted-foreground">{status === "rejected" ? "ارفع مستندات محدّثة لإعادة إرسال الطلب للمراجعة." : "يمكنك تحديث صورة الهوية أو الشهادة إذا لزم."}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {([["صورة الهوية / الإقامة", idFile, setIdFile], ["الشهادة", certFile, setCertFile]] as const).map(([label, file, setFile]) => (
          <label key={label} className="flex items-center gap-2 min-w-0 rounded-xl border border-dashed border-border bg-muted px-3 py-2 cursor-pointer text-xs">
            <Upload className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate flex-1">{file ? file.name : label}</span>
            <input type="file" accept={DOC_ACCEPT} className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        ))}
      </div>
      <button onClick={upload} disabled={busy} className="mohemah-btn-primary w-full py-2 text-sm disabled:opacity-50">{busy ? "جارٍ الرفع..." : "رفع المرفقات"}</button>
    </div>
  );
}

type Applicant = {
  id: string; full_name: string | null; phone: string | null; email: string | null; national_id: string | null; nationality: string | null; company_name?: string | null;
  gender: string | null; region: string | null; verification_status: string; review_note: string | null; requested_services: string[]; requested_service_names?: string[]; created_at: string;
};

const STATUS_TABS = [
  { key: "pending", label: "قيد المراجعة" },
  { key: "approved", label: "مقبول" },
  { key: "rejected", label: "مرفوض" },
] as const;

/** Administration review queue for provider registrations. */
export function AdminProviderApplications({ onChanged }: { onChanged?: () => void }) {
  const { services } = usePublicData();
  const serviceNames = Object.fromEntries(services.map((s) => [s.id, s.name]));
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]["key"]>("pending");
  const [rows, setRows] = useState<Applicant[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocLink[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  // Per-document decision for the latest ID and certificate.
  const [docDecision, setDocDecision] = useState<Record<"id" | "certificate", { status: "ok" | "rejected" | null; note: string }>>({ id: { status: null, note: "" }, certificate: { status: null, note: "" } });
  const setDoc = (kind: "id" | "certificate", patch: Partial<{ status: "ok" | "rejected" | null; note: string }>) =>
    setDocDecision((d) => ({ ...d, [kind]: { ...d[kind], ...patch } }));

  const load = useCallback(async () => {
    try { setRows(await api<Applicant[]>(`/api/admin/applications?status=${tab}`)); } catch { setRows([]); }
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  const open = async (id: string) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id); setNote(""); setDocs([]);
    setDocDecision({ id: { status: null, note: "" }, certificate: { status: null, note: "" } });
    try { setDocs(await listProviderDocs(id)); } catch { setDocs([]); }
  };

  const review = async (id: string, approve: boolean) => {
    const rejectedDoc = docDecision.id.status === "rejected" || docDecision.certificate.status === "rejected";
    if (!approve && !note.trim() && !rejectedDoc) return toast.error("حدد المستند غير المقبول أو اكتب سبب الرفض");
    if (approve && rejectedDoc) return toast.error("لا يمكن الموافقة مع وجود مستند غير مقبول");
    setBusy(true);
    try {
      await api(`/api/admin/applications/${id}/review`, { body: {
        approve, note: note.trim() || null,
        id_status: docDecision.id.status, id_note: docDecision.id.note.trim() || null,
        cert_status: docDecision.certificate.status, cert_note: docDecision.certificate.note.trim() || null,
      } });
      toast.success(approve ? "تمت الموافقة وتفعيل مقدم الخدمة" : "تم رفض الطلب");
      setOpenId(null); load(); onChanged?.();
    } catch (e) { toast.error(errMsg(e, "تعذّر حفظ القرار")); }
    setBusy(false);
  };

  return (
    <section className="bg-card border border-border rounded-2xl p-4 mb-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
          <h2 className="font-bold truncate">طلبات تسجيل مقدمي الخدمات</h2>
        </div>
        <div className="flex gap-1">
          {STATUS_TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`px-2.5 py-1 rounded-lg text-xs ${tab === t.key ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{t.label}</button>
          ))}
        </div>
      </div>
      {!rows.length && <p className="text-xs text-muted-foreground">لا توجد طلبات في هذه القائمة.</p>}
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="border border-border rounded-xl">
            <button onClick={() => open(r.id)} className="w-full grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 p-3 text-right">
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{r.full_name || "بدون اسم"}</p>
                <p className="text-xs text-muted-foreground truncate" dir="ltr">{r.phone} · {r.email}</p>
              </div>
              <span className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString("ar-SA-u-nu-latn")}</span>
            </button>
            {openId === r.id && (
              <div className="border-t border-border p-3 space-y-3 text-sm">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <div><span className="text-muted-foreground block">الهوية/الإقامة</span><span dir="ltr">{r.national_id || "-"}</span></div>
                  <div><span className="text-muted-foreground block">الجنسية</span>{r.nationality || "-"}</div>
                  {r.company_name && <div><span className="text-muted-foreground block">المؤسسة / الشركة</span>{r.company_name}</div>}
                  <div><span className="text-muted-foreground block">الجنس</span>{r.gender === "female" ? "أنثى" : r.gender === "male" ? "ذكر" : "-"}</div>
                  <div><span className="text-muted-foreground block">المدينة</span>{r.region || "-"}</div>
                  <div className="min-w-0 col-span-2 sm:col-span-1"><span className="text-muted-foreground block">الخدمات</span>{(r.requested_service_names?.length ? r.requested_service_names : r.requested_services.map((s) => serviceNames[s]).filter(Boolean)).join("، ") || "لم يحدد خدمات"}</div>
                </div>
                <div className="space-y-2">
                  {(["id", "certificate"] as const).map((kind) => {
                    const d = docs.find((x) => x.kind === kind);
                    const dec = docDecision[kind];
                    return (
                      <div key={kind} className="rounded-xl border border-border p-2.5 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {d ? (
                            <a href={d.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent text-accent-foreground text-xs">
                              <FileText className="w-3.5 h-3.5" /> {docKindLabel(kind)}
                            </a>
                          ) : <span className="text-xs text-muted-foreground">{docKindLabel(kind)}: غير مرفوع</span>}
                          {d?.status === "approved" && <span className="text-[11px] text-success">✓ مقبول سابقاً</span>}
                          {d?.status === "rejected" && <span className="text-[11px] text-destructive">✗ مرفوض سابقاً{d.note ? `: ${d.note}` : ""}</span>}
                          {tab !== "approved" && d && (
                            <div className="ms-auto flex gap-1">
                              <button type="button" onClick={() => setDoc(kind, { status: dec.status === "ok" ? null : "ok" })}
                                className={`px-2.5 py-1 rounded-lg text-xs inline-flex items-center gap-1 ${dec.status === "ok" ? "bg-success text-white" : "bg-muted"}`}><Check className="w-3.5 h-3.5" /> سليم</button>
                              <button type="button" onClick={() => setDoc(kind, { status: dec.status === "rejected" ? null : "rejected" })}
                                className={`px-2.5 py-1 rounded-lg text-xs inline-flex items-center gap-1 ${dec.status === "rejected" ? "bg-destructive text-white" : "bg-muted"}`}><X className="w-3.5 h-3.5" /> غير مقبول</button>
                            </div>
                          )}
                        </div>
                        {dec.status === "rejected" && (
                          <input value={dec.note} onChange={(e) => setDoc(kind, { note: e.target.value })} maxLength={300}
                            placeholder={kind === "id" ? "سبب رفض الهوية (مثال: الصورة غير واضحة)" : "سبب رفض الشهادة (مثال: الشهادة منتهية)"} className="admin-input text-xs" />
                        )}
                      </div>
                    );
                  })}
                </div>
                {r.review_note && <p className="text-xs text-muted-foreground">ملاحظة سابقة: {r.review_note}</p>}
                {tab !== "approved" && (
                  <>
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="ملاحظة (مطلوبة عند الرفض)" className="admin-input min-h-16" />
                    <div className="grid grid-cols-2 gap-2">
                      <button disabled={busy} onClick={() => review(r.id, true)} className="mohemah-btn-primary py-2 text-sm flex items-center justify-center gap-1 disabled:opacity-50"><Check className="w-4 h-4" /> موافقة</button>
                      {tab === "pending" && <button disabled={busy} onClick={() => review(r.id, false)} className="py-2 text-sm rounded-xl bg-red-50 text-red-600 flex items-center justify-center gap-1 disabled:opacity-50"><X className="w-4 h-4" /> رفض</button>}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
