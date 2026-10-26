import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import logo from "@/assets/mohemah-logo-new.png";
import { usePublicData } from "@/lib/publicData";
import { fileUrl } from "@/lib/api";

/** Shared frame for the customer and provider sign-in screens. */
export function AuthScreen({ title, subtitle, badge, children, switchTo }: { title: string; subtitle: string; badge: string; children: ReactNode; switchTo: { to: "/auth" | "/provider/auth"; label: string } }) {
  const { settings } = usePublicData();
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: "var(--gradient-brand)" }}>
      <div className="w-full max-w-md bg-card text-foreground rounded-3xl shadow-xl p-6 sm:p-8 border border-border">
        <div className="text-center mb-6">
          <img src={settings?.app_logo_url ? fileUrl(settings.app_logo_url) : logo} alt={settings?.app_name ?? "مهمة"} className="mx-auto size-16 object-contain" />
          <span className="inline-block mt-3 rounded-full bg-accent px-3 py-1 text-[11px] font-bold text-primary">{badge}</span>
          <h1 className="text-2xl font-bold mt-2">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>
        {children}
        <div className="mt-6 border-t border-border pt-4 text-center text-xs text-muted-foreground">
          <Link to={switchTo.to} className="font-semibold text-primary">{switchTo.label}</Link>
        </div>
      </div>
    </div>
  );
}
