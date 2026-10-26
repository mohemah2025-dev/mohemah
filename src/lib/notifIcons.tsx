import {
  AlertTriangle, BadgePercent, Bell, CalendarHeart, CheckCircle2, Coffee, Flag, Gift, Heart, Megaphone, Moon, PartyPopper,
  Sparkles, Star, Sun, Tag, TreePalm, Trophy, Wrench, Landmark, type LucideIcon,
} from "lucide-react";
import { fileUrl } from "@/lib/api";

/** Shared notification icon set. The same keys are mapped to Material icons in the mobile apps. */
export const NOTIF_ICONS: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: "bell", label: "تنبيه", Icon: Bell },
  { key: "megaphone", label: "إعلان", Icon: Megaphone },
  { key: "gift", label: "هدية", Icon: Gift },
  { key: "percent", label: "خصم", Icon: BadgePercent },
  { key: "tag", label: "عرض", Icon: Tag },
  { key: "moon", label: "هلال", Icon: Moon },
  { key: "mosque", label: "مسجد", Icon: Landmark },
  { key: "star", label: "نجمة", Icon: Star },
  { key: "sparkles", label: "احتفال", Icon: Sparkles },
  { key: "party", label: "مناسبة", Icon: PartyPopper },
  { key: "flag", label: "علم", Icon: Flag },
  { key: "palm", label: "نخلة", Icon: TreePalm },
  { key: "calendar", label: "موعد", Icon: CalendarHeart },
  { key: "heart", label: "شكر", Icon: Heart },
  { key: "trophy", label: "إنجاز", Icon: Trophy },
  { key: "check", label: "تم", Icon: CheckCircle2 },
  { key: "sun", label: "صباح", Icon: Sun },
  { key: "coffee", label: "استراحة", Icon: Coffee },
  { key: "alert", label: "تحذير", Icon: AlertTriangle },
  { key: "wrench", label: "صيانة", Icon: Wrench },
];

const isImage = (v: string) => v.startsWith("http") || v.startsWith("/api/files");

/** Renders an icon key, an uploaded image or a legacy emoji. */
export function NotifIcon({ icon, color = "#2B6CD9", size = 20 }: { icon?: string | null; color?: string; size?: number }) {
  const v = icon || "bell";
  if (isImage(v)) return <img src={fileUrl(v)} alt="" className="object-contain rounded" style={{ width: size + 6, height: size + 6 }} />;
  const hit = NOTIF_ICONS.find((x) => x.key === v);
  if (hit) return <hit.Icon style={{ width: size, height: size, color }} strokeWidth={2} />;
  return <span style={{ fontSize: size }}>{v}</span>;
}
