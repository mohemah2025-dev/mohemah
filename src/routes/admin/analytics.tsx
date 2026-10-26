import { createFileRoute } from "@tanstack/react-router";
import { AdminAnalyticsPage } from "@/components/admin/AdminAnalytics";
export const Route = createFileRoute("/admin/analytics")({
  component: AdminAnalyticsPage,
  head: () => ({ meta: [{ title: "مهمة - تحليل الطلبات" }, { name: "description", content: "تحليل الطلبات حسب الخدمة والمدينة والحي والعميل والوقت" }, { property: "og:title", content: "مهمة - تحليل الطلبات" }, { property: "og:description", content: "تحليل الطلبات والتوصيات التجارية" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
});
