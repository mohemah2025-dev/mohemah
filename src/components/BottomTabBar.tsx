import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Wrench, ClipboardList, User } from "lucide-react";

const tabs = [
  { label: "الرئيسية", icon: Home, path: "/" },
  { label: "خدمات", icon: Wrench, path: "/services" },
  { label: "طلبات", icon: ClipboardList, path: "/orders" },
  { label: "حساب", icon: User, path: "/account" },
];

export function BottomTabBar() {
  const currentPath = useRouterState({
    select: (s) => s.location.pathname,
  });

  return (
    <nav className="bottom-navigation fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="max-w-lg mx-auto grid grid-cols-4 items-center py-2">
        {tabs.map((tab) => {
          const isActive = currentPath === tab.path || (tab.path !== "/" && tab.path !== "/provider" && currentPath.startsWith(`${tab.path}/`));
          return (
            <Link
              key={tab.path}
              to={tab.path}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-w-0 flex-col items-center gap-0.5 px-2 py-1 text-xs font-semibold transition-colors ${
                isActive ? "text-mohemah-blue mohemah-tab-active" : "text-muted-foreground"
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
