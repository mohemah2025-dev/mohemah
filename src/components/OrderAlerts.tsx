import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { BellRing } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

const SW_URL = "/order-alerts-sw.js";
const supported = () => typeof window !== "undefined" && "Notification" in window;

async function getRegistration() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return (await navigator.serviceWorker.getRegistration(SW_URL)) ?? (await navigator.serviceWorker.register(SW_URL));
  } catch {
    return null;
  }
}

/** Shows an OS notification when the page is in the background (web). Native push arrives with the mobile apps. */
export async function showSystemNotification(title: string, body: string, url = "/provider/orders", tag = "mohemah-order") {
  if (!supported() || Notification.permission !== "granted") return false;
  const options = { body, tag, icon: "/favicon.ico", data: { url } } as NotificationOptions;
  const reg = await getRegistration();
  if (reg) { await reg.showNotification(title, options); return true; }
  try { new Notification(title, options); return true; } catch { return false; }
}

export const inBackground = () => typeof document !== "undefined" && (document.visibilityState === "hidden" || !document.hasFocus());

export type AppNotification = { id: string; title: string; body: string; category: string; icon: string | null; link: string | null; at: string; read: number };

/** Polls personal notifications (order updates, ratings, approvals) and surfaces new ones as toasts. */
export function NotificationAlerts() {
  const { user, app } = useAuth();
  const navigate = useNavigate();
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!user) { seen.current = null; return; }
    let stop = false;
    const tick = async () => {
      try {
        const list = await api<AppNotification[]>("/api/me/notifications");
        if (stop) return;
        if (!seen.current) { seen.current = new Set(list.map((n) => n.id)); return; }
        for (const n of list) {
          if (seen.current.has(n.id)) continue;
          seen.current.add(n.id);
          if (n.read) continue;
          const link = n.link;
          if (inBackground() && (await showSystemNotification(n.title, n.body, link ?? "/", `mohemah-${n.id}`))) continue;
          toast(n.title, { description: n.body, action: link ? { label: "عرض", onClick: () => navigate({ to: link }) } : undefined });
        }
      } catch { /* offline */ }
    };
    tick();
    const t = setInterval(tick, 20000);
    return () => { stop = true; clearInterval(t); };
  }, [user?.id, app, navigate]);

  return null;
}

/** Button to allow system notifications for new orders (web). */
export function EnableOrderAlerts() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  useEffect(() => { setPermission(supported() ? Notification.permission : "unsupported"); }, []);
  if (permission === "granted" || permission === "unsupported") return null;

  const enable = async () => {
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      await getRegistration();
      toast.success("تم تفعيل إشعارات الطلبات");
    } else toast.error("لم يتم السماح بالإشعارات من المتصفح");
  };

  return (
    <button onClick={enable} className="mohemah-card w-full p-3 flex items-center gap-3 text-right">
      <BellRing className="w-5 h-5 text-primary shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold">تفعيل إشعارات الطلبات</span>
        <span className="block text-xs text-muted-foreground">
          {permission === "denied" ? "الإشعارات محظورة، فعّلها من إعدادات المتصفح" : "تصلك تنبيهات الطلبات الجديدة وأنت خارج الصفحة"}
        </span>
      </span>
    </button>
  );
}
