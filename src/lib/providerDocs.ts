import { api } from "@/lib/api";
import { compressImage } from "@/lib/imageCompress";

export const DOC_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
export const DOC_MAX_BYTES = 5 * 1024 * 1024;

export function validateDoc(file: File | null, label: string): string | null {
  if (!file) return `أرفق ${label}`;
  if (file.size > DOC_MAX_BYTES) return `${label}: الحجم الأقصى 5MB`;
  if (!DOC_ACCEPT.split(",").includes(file.type)) return `${label}: الصيغ المسموحة صورة أو PDF`;
  return null;
}

export type DocLink = { id: string; kind: "id" | "certificate"; created_at: string; url: string };
export const docKindLabel = (k: string) => (k === "id" ? "الهوية / الإقامة" : "الشهادة");

/** Re-uploads documents for a pending or rejected application (provider app). */
export async function uploadProviderDocs(idFile: File | null, certFile: File | null) {
  const form = new FormData();
  if (idFile) form.set("id_file", await compressImage(idFile));
  if (certFile) form.set("cert_file", await compressImage(certFile));
  return api("/api/provider/documents", { form });
}

/** Signed, short-lived links to an applicant's documents (administration). */
export const listProviderDocs = (userId: string) => api<DocLink[]>(`/api/admin/applications/${userId}/documents`);
