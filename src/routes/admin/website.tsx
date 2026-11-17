import { createFileRoute } from "@tanstack/react-router";
import { AdminWebsitePage } from "@/components/admin/AdminWebsite";
export const Route = createFileRoute("/admin/website")({
  component: AdminWebsitePage,
  head: () => ({ meta: [{ title: "مهمة - إدارة الموقع" }] }),
});
