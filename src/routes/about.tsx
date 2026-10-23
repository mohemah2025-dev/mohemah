import { createFileRoute } from "@tanstack/react-router";
import { AppGuide } from "@/components/AppOpening";

export const Route = createFileRoute("/about")({
  component: AppGuide,
  head: () => ({ meta: [
    { title: "عن مهمة — طالب الخدمة ومقدم الخدمة" },
    { name: "description", content: "تعرف على طلب الخدمات وتقديمها في مهمة، والاشتراكات والكوينز الخاصة بمقدمي الخدمة." },
    { property: "og:title", content: "عن مهمة — طالب الخدمة ومقدم الخدمة" },
    { property: "og:description", content: "خطوات طلب الخدمة وتقديمها، ورسوم مقدم الخدمة فقط." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});