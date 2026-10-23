import { createFileRoute } from "@tanstack/react-router";
import { AdminAdsPage } from "@/components/admin/AdminExtraPages";
export const Route = createFileRoute("/admin/ads")({ head: () => ({ meta: [{"title": "إعلانات مهمة | الإدارة"}, {"name": "description", "content": "إدارة المساحات الإعلانية في مهمة."}, {"property": "og:title", "content": "إعلانات مهمة | الإدارة"}, {"property": "og:description", "content": "إدارة المساحات الإعلانية في مهمة."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}] }), component: AdminAdsPage });
