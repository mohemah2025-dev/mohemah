import { createFileRoute } from "@tanstack/react-router";
import { AdminProviderProfilePage } from "@/components/admin/AdminProviderProfile";
export const Route = createFileRoute("/admin/provider-profile/$id")({
  component: AdminProviderProfilePage,
  head: () => ({ meta: [{ title: "ملف مقدم الخدمة | إدارة مهمة" }, { name: "description", content: "أداء مقدم الخدمة وخدماته ودوامه وتقييماته" }, { property: "og:title", content: "ملف مقدم الخدمة | إدارة مهمة" }, { property: "og:description", content: "أداء مقدم الخدمة وخدماته ودوامه وتقييماته" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
});
