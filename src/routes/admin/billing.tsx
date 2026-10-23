import { createFileRoute } from "@tanstack/react-router";
import { AdminBillingSettings } from "@/components/ProviderBilling";
import { AdminBillingGifts } from "@/components/admin/AdminBillingGifts";
function AdminBillingPage() { return <div><h1 className="text-2xl font-bold mb-6">الاشتراكات وطريقة التحصيل</h1><AdminBillingSettings /><AdminBillingGifts /></div>; }
export const Route = createFileRoute("/admin/billing")({ component: AdminBillingPage, head: () => ({ meta: [
  { title: "الاشتراكات والتحصيل | إدارة مهمة" },
  { name: "description", content: "تفعيل التحصيل بالكوينز أو الاشتراك ومنح الاشتراكات المجانية والكوينز الهدية." },
  { property: "og:title", content: "الاشتراكات والتحصيل | إدارة مهمة" },
  { property: "og:description", content: "طريقة تحصيل الرسوم والاشتراكات المجانية لمقدمي الخدمة." },
  { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
] }) });
