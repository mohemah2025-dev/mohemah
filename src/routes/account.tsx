import { createFileRoute } from "@tanstack/react-router";
import { AccountPage } from "@/components/AccountPage";

export const Route = createFileRoute("/account")({
  component: AccountPage,
  head: () => ({
    meta: [
      { title: "مهمة - حسابي" }, {"property": "og:title", "content": "مهمة - حسابي"}, {"property": "og:description", "content": "إدارة حسابك الشخصي في تطبيق مهمة"}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"},
      { name: "description", content: "إدارة حسابك الشخصي في تطبيق مهمة" },
    ],
  }),
});
