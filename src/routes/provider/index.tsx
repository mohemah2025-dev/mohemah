import { createFileRoute } from "@tanstack/react-router";
import { ProviderHomePage } from "@/components/ProviderHomePage";

export const Route = createFileRoute("/provider/")({
  component: ProviderHomePage,
  head: () => ({
    meta: [
      { title: "مهمة - مقدم الخدمة" }, {"property": "og:title", "content": "مهمة - مقدم الخدمة"}, {"property": "og:description", "content": "الصفحة الرئيسية لمقدم الخدمة في تطبيق مهمة"}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"},
      { name: "description", content: "الصفحة الرئيسية لمقدم الخدمة في تطبيق مهمة" },
    ],
  }),
});
