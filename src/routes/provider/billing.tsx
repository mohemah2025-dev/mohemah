import { createFileRoute } from "@tanstack/react-router";
import { ProviderBillingPage } from "@/components/ProviderBilling";

export const Route = createFileRoute("/provider/billing")({
  component: ProviderBillingPage,
  head: () => ({
    meta: [
      { title: "مهمة - طريقة الدفع والاشتراك" },
      { name: "description", content: "اختر الدفع بالكوينز لكل خدمة أو الاشتراك الدوري" },
      { property: "og:title", content: "مهمة - طريقة الدفع والاشتراك" },
      { property: "og:description", content: "اختر الدفع بالكوينز لكل خدمة أو الاشتراك الدوري" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
