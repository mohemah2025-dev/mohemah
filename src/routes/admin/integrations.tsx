import { createFileRoute } from "@tanstack/react-router";
import { AdminIntegrationsPage } from "@/components/admin/AdminIntegrations";
export const Route = createFileRoute("/admin/integrations")({
  component: AdminIntegrationsPage,
  head: () => ({ meta: [{ title: "مهمة - الرسائل النصية والبريد" }, { name: "description", content: "ربط الرسائل النصية والبريد الإلكتروني" }, { property: "og:title", content: "مهمة - الرسائل النصية والبريد" }, { property: "og:description", content: "ربط الرسائل النصية والبريد الإلكتروني" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
});
