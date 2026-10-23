import { createFileRoute } from "@tanstack/react-router";
import { OrdersPage } from "@/components/OrdersPage";

export const Route = createFileRoute("/orders")({
  component: OrdersPage,
  head: () => ({
    meta: [
      { title: "مهمة - الطلبات" }, {"property": "og:title", "content": "مهمة - الطلبات"}, {"property": "og:description", "content": "تتبع طلباتك الجارية والسابقة"}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"},
      { name: "description", content: "تتبع طلباتك الجارية والسابقة" },
    ],
  }),
});
