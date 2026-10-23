import { createFileRoute } from "@tanstack/react-router";
import { AdminGatewaysPage } from "@/components/admin/AdminGatewaysMessages";
export const Route = createFileRoute("/admin/gateways")({
  component: AdminGatewaysPage,
  head: () => ({ meta: [{ title: "مهمة - بوابات الدفع" }, {"property": "og:title", "content": "مهمة - بوابات الدفع"}, {"property": "og:description", "content": "إدارة بوابات الدفع"}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}, { name: "description", content: "إدارة بوابات الدفع" }] }),
});
