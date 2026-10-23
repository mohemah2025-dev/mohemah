import { createFileRoute } from "@tanstack/react-router";
import { AdminPoliciesPage } from "@/components/admin/AdminExtraPages";
export const Route = createFileRoute("/admin/policies")({ head: () => ({ meta: [{"title": "السياسات | إدارة مهمة"}, {"name": "description", "content": "إدارة شروط وسياسات مهمة."}, {"property": "og:title", "content": "السياسات | إدارة مهمة"}, {"property": "og:description", "content": "إدارة شروط وسياسات مهمة."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}] }), component: AdminPoliciesPage });
