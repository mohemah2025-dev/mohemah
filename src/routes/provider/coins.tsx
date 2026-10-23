import { createFileRoute } from "@tanstack/react-router";
import { ProviderCoinsPage } from "@/components/ProviderCoinsPage";

export const Route = createFileRoute("/provider/coins")({
  component: ProviderCoinsPage,
  head: () => ({
    meta: [
      { title: "مهمة - تعبئة الكوينز" }, {"property": "og:title", "content": "مهمة - تعبئة الكوينز"}, {"property": "og:description", "content": "باقات الكوينز لمقدمي الخدمات"}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"},
      { name: "description", content: "باقات الكوينز لمقدمي الخدمات" },
    ],
  }),
});
