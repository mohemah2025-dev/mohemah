import { createFileRoute } from "@tanstack/react-router";
import { AdminNotificationsPage } from "@/components/admin/AdminExtraPages";
export const Route = createFileRoute("/admin/notifications")({ head: () => ({ meta: [{"title": "الإشعارات | إدارة مهمة"}, {"name": "description", "content": "إدارة إشعارات مستخدمي مهمة."}, {"property": "og:title", "content": "الإشعارات | إدارة مهمة"}, {"property": "og:description", "content": "إدارة إشعارات مستخدمي مهمة."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}] }), component: AdminNotificationsPage });
