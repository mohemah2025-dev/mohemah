import { createFileRoute } from "@tanstack/react-router";
import { SiteHomePage } from "@/components/site/SitePage";

export const Route = createFileRoute("/site/")({
  component: SiteHomePage,
  head: () => ({ meta: [{ title: "مهمة — كل مهامك اليومية بضغطة زر" }, { name: "description", content: "منصة مهمة تربطك بمقدمي خدمات موثوقين في مدينتك. حمّل التطبيق واطلب خدمتك خلال دقيقة." }, { property: "og:type", content: "website" }] }),
});
