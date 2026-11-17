import { createFileRoute } from "@tanstack/react-router";
import { SiteDocPage } from "@/components/site/SitePage";

export const Route = createFileRoute("/site/$slug")({
  component: () => { const { slug } = Route.useParams(); return <SiteDocPage slug={slug} />; },
});
