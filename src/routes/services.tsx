import { createFileRoute } from "@tanstack/react-router";
import { ServicesPage } from "@/components/ServicesPage";

export const Route = createFileRoute("/services")({
  component: ServicesPage,
  validateSearch: (search: Record<string, unknown>) => ({
    category: (search.category as string) || "",
    subService: (search.subService as string) || "",
  }),
  head: () => ({
    meta: [
      { title: "مهمة - الخدمات" },
      { name: "description", content: "اختر الخدمة التي تحتاجها من بين مجموعة واسعة من الخدمات" },
      { property: "og:title", content: "مهمة - الخدمات" },
      { property: "og:description", content: "اختر الخدمة التي تحتاجها من بين مجموعة واسعة من الخدمات" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
