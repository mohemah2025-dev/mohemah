import { createFileRoute } from "@tanstack/react-router";
import { AdminMessagesPage } from "@/components/admin/AdminGatewaysMessages";
export const Route = createFileRoute("/admin/messages")({
  component: AdminMessagesPage,
  head: () => ({ meta: [{ title: "مهمة - الرسائل" }, {"property": "og:title", "content": "مهمة - الرسائل"}, {"property": "og:description", "content": "إرسال ومتابعة رسائل المستخدمين"}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}, { name: "description", content: "إرسال ومتابعة رسائل المستخدمين" }] }),
});
