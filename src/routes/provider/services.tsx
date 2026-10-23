import { createFileRoute } from "@tanstack/react-router";
import { ProviderServicesSetup } from "@/components/ProviderServicesSetup";

export const Route = createFileRoute("/provider/services")({
  component: ProviderServicesSetup,
  head: () => ({
    meta: [
      { title: "مهمة - خدماتي والرسائل" },
      { name: "description", content: "اختر الخدمات التي تقدمها واطلع على رسائلك" },
      { property: "og:title", content: "مهمة - خدماتي والرسائل" },
      { property: "og:description", content: "اختر الخدمات التي تقدمها واطلع على رسائلك" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
