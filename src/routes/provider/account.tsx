import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { ProviderAccountPage } from "@/components/ProviderAccountPage";

function ProviderAccountLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isRoot = path === "/provider/account" || path === "/provider/account/";
  if (isRoot) return <ProviderAccountPage />;
  return <Outlet />;
}

export const Route = createFileRoute("/provider/account")({
  component: ProviderAccountLayout,
  head: () => ({
    meta: [
      { title: "مهمة - حساب مقدم الخدمة" }, {"property": "og:title", "content": "مهمة - حساب مقدم الخدمة"}, {"property": "og:description", "content": "إدارة حساب مقدم الخدمة"}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"},
      { name: "description", content: "إدارة حساب مقدم الخدمة" },
    ],
  }),
});
