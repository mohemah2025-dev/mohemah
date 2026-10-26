import { ApiError, json, Router, type Env } from "./lib/core";
import { registerAccountRoutes } from "./routes/account";
import { registerOrderRoutes } from "./routes/orders";
import { registerAdminRoutes } from "./routes/admin";
import { registerPaymentRoutes } from "./routes/payments";
import { registerAnalyticsRoutes } from "./routes/analytics";
import { registerProviderRoutes } from "./routes/providers";
import { registerSupportRoutes } from "./routes/support";
import { registerBadgeRoutes } from "./routes/badges";
import { ensureSchema } from "./lib/migrate";
import { flushPush, type PushJob } from "./lib/push";

const router = new Router();
registerAccountRoutes(router);
registerOrderRoutes(router);
registerAdminRoutes(router);
registerPaymentRoutes(router);
registerAnalyticsRoutes(router);
registerProviderRoutes(router);
registerSupportRoutes(router);
registerBadgeRoutes(router);

function corsHeaders(req: Request, env: Env, url: URL): Record<string, string> {
  const origin = req.headers.get("origin");
  if (!origin) return {};
  const allowed = new Set([url.origin, ...(env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean)]);
  if (!allowed.has(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "authorization,content-type",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) {
      // The provider web app now opens the Flutter web version (/partner/) once it has been published.
      if (url.pathname === "/provider" || url.pathname.startsWith("/provider/")) {
        const probe = await env.ASSETS.fetch(new Request(`${url.origin}/partner/flutter_bootstrap.js`));
        if (probe.ok && (probe.headers.get("content-type") ?? "").includes("javascript")) {
          return Response.redirect(`${url.origin}/partner/`, 302);
        }
      }
      return env.ASSETS.fetch(req);
    }
    const cors = corsHeaders(req, env, url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    let res: Response;
    const push: PushJob[] = [];
    const tasks: Promise<unknown>[] = [];
    try {
      await ensureSchema(env);
      const m = router.match(req.method, url.pathname);
      if (!m) {
        res = json({ error: "not_found", message: "المسار غير موجود" }, 404);
      } else {
        res = await m.handler({ req, env, url, params: m.params, ip: req.headers.get("cf-connecting-ip") ?? "local", push, tasks });
      }
    } catch (e) {
      if (e instanceof ApiError) {
        res = json({ error: e.code, message: e.message }, e.status);
      } else {
        console.error("API error", url.pathname, e);
        const msg = String((e as Error)?.message ?? "");
        res = msg.includes("UNIQUE constraint")
          ? json({ error: "conflict", message: "البيانات مكررة" }, 409)
          : json({ error: "server_error", message: "حدث خطأ غير متوقع، حاول مجدداً" }, 500);
      }
    }
    if (push.length && res.status < 400) ctx.waitUntil(flushPush(env, push));
    if (tasks.length) ctx.waitUntil(Promise.allSettled(tasks));
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(cors)) h.set(k, v);
    h.set("x-content-type-options", "nosniff");
    return new Response(res.body, { status: res.status, headers: h });
  },
} satisfies ExportedHandler<Env>;
