import { createFileRoute } from "@tanstack/react-router";
import { ProviderOrdersPage } from "@/components/ProviderOrdersPage";

export const Route = createFileRoute("/provider/orders")({
  component: ProviderOrdersPage,
  head: () => ({
    meta: [
      { title: "مهمة - طلبات مقدم الخدمة" }, {"property": "og:title", "content": "مهمة - طلبات مقدم الخدمة"}, {"property": "og:description", "content": "إدارة طلبات مقدم الخدمة"}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"},
      { name: "description", content: "إدارة طلبات مقدم الخدمة" },
    ],
  }),
});
