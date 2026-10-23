import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Bell, Clock } from "lucide-react";
import { useProvider, INCOMING_TTL_MS, orderTitle } from "./ProviderContext";

/** Minimized incoming request pinned to the top of every provider page except home (home shows its own banner). */
export function ProviderPinnedIncoming() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { pendingIncoming, incomingMinimized, setIncomingMinimized } = useProvider();
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!pendingIncoming) return;
    const tick = () => setRemaining(Math.max(0, pendingIncoming.expiresAt - Date.now()));
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [pendingIncoming]);

  if (!path.startsWith("/provider") || path === "/provider" || path === "/provider/" || path.startsWith("/provider/auth")) return null;
  if (!pendingIncoming || !incomingMinimized) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[70] p-2 pointer-events-none" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
      <button onClick={() => setIncomingMinimized(false)}
        className="pointer-events-auto w-full max-w-md mx-auto block rounded-2xl overflow-hidden shadow-lg bg-gradient-to-l from-mohemah-coral to-mohemah-blue text-primary-foreground active:scale-[0.99] transition-transform">
        <div className="px-4 py-3 flex items-center gap-3">
          <span className="relative flex w-9 h-9 rounded-full bg-white/25 items-center justify-center shrink-0">
            <Bell className="w-5 h-5" />
            <span className="absolute inset-0 rounded-full bg-white/30 animate-ping" />
          </span>
          <div className="flex-1 text-right min-w-0">
            <p className="text-sm font-bold truncate">طلب وارد جديد · {pendingIncoming.customer.name}</p>
            <p className="text-[11px] opacity-90 truncate">{orderTitle(pendingIncoming)} · {pendingIncoming.mode === "in_person" ? "حضوري" : "عن بُعد"}</p>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold bg-white/20 px-2 py-1 rounded-full"><Clock className="w-3.5 h-3.5" />{Math.ceil(remaining / 1000)}ث</div>
        </div>
        <div className="h-1 bg-white/20"><div className="h-full bg-white transition-all" style={{ width: `${(remaining / INCOMING_TTL_MS) * 100}%` }} /></div>
      </button>
    </div>
  );
}
