import { createFileRoute } from "@tanstack/react-router";
import { ProviderActivityPage } from "@/components/ProviderActivityPage";

export const Route = createFileRoute("/provider/activity")({
  component: ProviderActivityPage,
  head: () => ({
    meta: [
      { title: "مهمة - النشاط" }, {"property": "og:title", "content": "مهمة - النشاط"}, {"property": "og:description", "content": "نشاط مقدم الخدمة والإحصائيات"}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"},
      { name: "description", content: "نشاط مقدم الخدمة والإحصائيات" },
    ],
  }),
});
