import { createFileRoute } from "@tanstack/react-router";
import { ProviderAccountSectionPage } from "@/components/ProviderAccountSectionPage";

export const Route = createFileRoute("/provider/account/$section")({
  component: ProviderAccountSectionPage,
  head: () => ({
    meta: [
      { title: "تفاصيل حساب مقدم الخدمة | مهمة" }, {"property": "og:title", "content": "تفاصيل حساب مقدم الخدمة | مهمة"}, {"property": "og:description", "content": "إدارة بيانات وتفضيلات مقدم الخدمة في مهمة."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}, {"name": "description", "content": "إدارة بيانات وتفضيلات مقدم الخدمة في مهمة."},
    ],
  }),
});
