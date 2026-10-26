import { useRef, useState } from "react";
import { toast } from "sonner";
import { Paperclip } from "lucide-react";
import { api, errMsg } from "@/lib/api";

export type AccountAction = "suspend" | "reactivate" | "delete";

const TITLES: Record<AccountAction, string> = { suspend: "تعليق الحساب", reactivate: "إعادة تفعيل الحساب", delete: "حذف الحساب نهائياً" };

/** Suspend / reactivate / delete a customer or provider with a reason and an optional attached letter (PDF or image). */
export function AccountActionDialog({ userId, userName, action, onClose, onDone }: {
  userId: string; userName: string; action: AccountAction; onClose: () => void; onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (reason.trim().length < 3) return toast.error("اكتب سبب الإجراء");
    if (file && file.size > 5 * 1024 * 1024) return toast.error("حجم الخطاب الأقصى 5MB");
    setBusy(true);
    try {
      const form = new FormData();
      form.set("action", action);
      form.set("reason", reason.trim());
      if (file) form.set("letter_file", file);
      await api(`/api/admin/users/${userId}/account-action`, { app: "admin", form });
      toast.success(action === "delete" ? "تم حذف الحساب" : action === "suspend" ? "تم تعليق الحساب وإبلاغ صاحبه" : "تمت إعادة التفعيل");
      onDone();
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl p-6 max-w-lg w-full space-y-3 text-sm" onClick={(e) => e.stopPropagation()} dir="rtl">
        <h3 className={`text-lg font-bold ${action === "reactivate" ? "" : "text-destructive"}`}>{TITLES[action]}</h3>
        <p className="text-xs text-muted-foreground">الحساب: <b>{userName}</b>. {action === "delete" ? "الحذف نهائي ولا يمكن التراجع عنه." : action === "suspend" ? "لن يتمكن من الدخول حتى إعادة التفعيل." : ""}</p>
        <label className="block"><span className="text-xs text-muted-foreground">السبب (يُرسل لصاحب الحساب)</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="admin-input mt-1 min-h-24" placeholder="اكتب السبب بوضوح" />
        </label>
        <div>
          <span className="text-xs text-muted-foreground">إرفاق خطاب (PDF أو صورة، اختياري)</span>
          <div className="mt-1 flex items-center gap-2">
            <button type="button" onClick={() => input.current?.click()} className="px-3 py-2 rounded-lg border border-border text-xs flex items-center gap-1"><Paperclip className="w-3.5 h-3.5" />اختيار ملف</button>
            <span className="text-xs text-muted-foreground truncate">{file?.name ?? "لا يوجد ملف"}</span>
          </div>
          <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-mohemah-light text-sm font-bold">إلغاء</button>
          <button onClick={submit} disabled={busy} className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 ${action === "reactivate" ? "bg-emerald-600" : "bg-red-600"}`}>{busy ? "جارٍ التنفيذ…" : TITLES[action]}</button>
        </div>
      </div>
    </div>
  );
}
