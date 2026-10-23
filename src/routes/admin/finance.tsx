import { createFileRoute } from "@tanstack/react-router";
import { AdminFinancePage } from "@/components/admin/AdminPages";
export const Route = createFileRoute("/admin/finance")({ component: AdminFinancePage, head: () => ({ meta: [
  { title: "مالية مهمة — الاشتراكات والكوينز" },
  { name: "description", content: "إدارة تحصيل مقدمي الخدمة والاشتراكات والكوينز والهدايا وسجل العمليات." },
  { property: "og:title", content: "مالية مهمة — الاشتراكات والكوينز" },
  { property: "og:description", content: "الاشتراكات وهدايا الكوينز وعمليات مقدمي الخدمة." },
  { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
] }) });
