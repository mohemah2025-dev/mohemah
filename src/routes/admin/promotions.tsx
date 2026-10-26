import { createFileRoute } from "@tanstack/react-router";
import { AdminPromotionsPage } from "@/components/admin/AdminPromotions";
export const Route = createFileRoute("/admin/promotions")({
  component: AdminPromotionsPage,
  head: () => ({ meta: [{ title: "مهمة - العروض والخصومات" }, { name: "description", content: "خصومات المناسبات لمقدمي الخدمة" }, { property: "og:title", content: "مهمة - العروض والخصومات" }, { property: "og:description", content: "خصومات المناسبات لمقدمي الخدمة" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
});
