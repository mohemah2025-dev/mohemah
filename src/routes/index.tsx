import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/HomePage";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "مهمة - الرئيسية" },
      { name: "description", content: "منصة مهمة لربط طالبي الخدمات بمقدمي الخدمات المحترفين" },
      { property: "og:title", content: "مهمة - الرئيسية" },
      { property: "og:description", content: "منصة مهمة لربط طالبي الخدمات بمقدمي الخدمات المحترفين" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
