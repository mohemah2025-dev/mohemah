import { useEffect } from "react";
import { Outlet, Link, createRootRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { BottomTabBar } from "@/components/BottomTabBar";
import { ProviderBottomTabBar } from "@/components/ProviderBottomTabBar";
import { ProviderProvider } from "@/components/ProviderContext";
import { ProviderIncomingModal } from "@/components/ProviderIncomingModal";
import { ProviderPinnedIncoming } from "@/components/ProviderPinnedIncoming";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/AuthContext";
import { PublicDataProvider } from "@/lib/publicData";
import { appFromPath } from "@/lib/api";
import { AppOpening } from "@/components/AppOpening";
import { NotificationAlerts } from "@/components/OrderAlerts";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">الصفحة غير موجودة</h2>
        <p className="mt-2 text-sm text-muted-foreground">الصفحة التي تبحث عنها غير موجودة أو تم نقلها.</p>
        <div className="mt-6">
          <Link to="/" className="mohemah-btn-primary px-6 py-2.5 inline-block">الرئيسية</Link>
        </div>
      </div>
    </div>
  );
}

/** On the website's own domain (admin → إدارة الموقع → النطاق) the root address opens the website instead of the web app. */
function useSiteDomainRedirect(path: string) {
  const navigate = useNavigate();
  useEffect(() => {
    if (path !== "/") return;
    const host = window.location.hostname.replace(/^www\./, "");
    const go = (d: string) => { if (d && d.replace(/^www\./, "") === host) void navigate({ to: "/site", replace: true }); };
    let cached: string | null = null;
    try { cached = sessionStorage.getItem("mohemah.site.domain"); } catch { /* ignore */ }
    if (cached !== null) return go(cached);
    fetch("/api/site/domain").then((r) => r.json()).then((d: { domain?: string }) => {
      try { sessionStorage.setItem("mohemah.site.domain", d.domain ?? ""); } catch { /* ignore */ }
      go(d.domain ?? "");
    }).catch(() => {});
  }, [path, navigate]);
}

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const app = appFromPath(path);
  const isAuthScreen = path === "/auth" || path.startsWith("/provider/auth");
  // Public website: its own layout, no app session, no bottom bar.
  const isSite = path === "/site" || path.startsWith("/site/");
  useSiteDomainRedirect(path);
  if (isSite) return <Outlet />;

  return (
    <PublicDataProvider>
      {/* Each app keeps its own session; remounting on app change loads the right account. */}
      <AuthProvider key={app} app={app}>
        <AppOpening />
        {app === "admin" ? (
          <Outlet />
        ) : app === "provider" ? (
          <ProviderProvider>
            <Outlet />
            {!isAuthScreen && <ProviderBottomTabBar />}
            <ProviderIncomingModal />
            <ProviderPinnedIncoming />
            <NotificationAlerts />
          </ProviderProvider>
        ) : (
          <>
            <Outlet />
            {!isAuthScreen && <BottomTabBar />}
            <NotificationAlerts />
          </>
        )}
        <Toaster position="top-center" richColors />
      </AuthProvider>
    </PublicDataProvider>
  );
}
