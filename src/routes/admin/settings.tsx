import { createFileRoute } from "@tanstack/react-router";
import { AdminSettingsPage } from "@/components/admin/AdminPages";
export const Route = createFileRoute("/admin/settings")({ component: AdminSettingsPage, head: () => ({ meta: [
  { title: "إعدادات مهمة — شعار الجهة والهوية" },
  { name: "description", content: "إدارة شعار الجهة واسم التطبيق وبيانات التواصل في مهمة." },
  { property: "og:title", content: "إعدادات مهمة — شعار الجهة والهوية" },
  { property: "og:description", content: "إدارة شعار الجهة والهوية وبيانات التواصل في مهمة." },
  { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
] }) });
