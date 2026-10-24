import { all, run, type Env } from "./core";

/**
 * Push notifications through Firebase Cloud Messaging (HTTP v1) — one channel for Android and iOS.
 *
 * Setup: Cloudflare → Worker → Settings → Variables and Secrets → add the secret
 * FCM_SERVICE_ACCOUNT with the full JSON of a Firebase service account key.
 * Without it, pushes are skipped silently and the apps keep working with in-app polling.
 */
export type PushMessage = {
  title: string;
  body: string;
  /** Extra data for the app when the notification is opened (e.g. { type: "order", order_id }). */
  data?: Record<string, string>;
};

export type PushJob = { userIds: string[]; app?: "customer" | "provider"; message: PushMessage };

type ServiceAccount = { client_email: string; private_key: string; project_id: string };

let tokenCache: { token: string; exp: number; email: string } | null = null;

function b64url(input: ArrayBuffer | Uint8Array | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input instanceof Uint8Array ? input : new Uint8Array(input);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function serviceAccount(env: Env): ServiceAccount | null {
  if (!env.FCM_SERVICE_ACCOUNT) return null;
  try {
    const sa = JSON.parse(env.FCM_SERVICE_ACCOUNT) as ServiceAccount;
    return sa.client_email && sa.private_key && sa.project_id ? sa : null;
  } catch {
    console.error("FCM_SERVICE_ACCOUNT is not valid JSON");
    return null;
  }
}

/** OAuth access token for FCM, signed with the service account key (RS256) and cached ~55 minutes. */
async function accessToken(sa: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.email === sa.client_email && tokenCache.exp > now + 60) return tokenCache.token;
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${header}.${claims}.${b64url(sig)}`,
  });
  if (!res.ok) throw new Error(`FCM auth failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: data.access_token, exp: now + Math.min(data.expires_in, 3300), email: sa.client_email };
  return data.access_token;
}

async function sendOne(env: Env, sa: ServiceAccount, bearer: string, token: string, m: PushMessage) {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: "POST",
    headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: m.title.slice(0, 200), body: m.body.slice(0, 500) },
        data: m.data ?? {},
        android: { priority: "HIGH", notification: { sound: "default", default_vibrate_timings: true } },
        apns: { headers: { "apns-priority": "10" }, payload: { aps: { sound: "default" } } },
      },
    }),
  });
  if (res.ok) return;
  const text = await res.text();
  // The app was uninstalled or the token rotated: forget it.
  if (res.status === 404 || text.includes("UNREGISTERED") || text.includes("registration-token-not-registered")) {
    await run(env.DB, "DELETE FROM push_tokens WHERE token = ?", token);
  } else {
    console.error("FCM send failed", res.status, text.slice(0, 300));
  }
}

/** Sends queued pushes; never throws (runs after the response through waitUntil). */
export async function flushPush(env: Env, jobs: PushJob[]) {
  const sa = serviceAccount(env);
  if (!sa || !jobs.length) return;
  try {
    const bearer = await accessToken(sa);
    for (const job of jobs) {
      const ids = [...new Set(job.userIds)].slice(0, 2000);
      for (let i = 0; i < ids.length; i += 90) {
        const chunk = ids.slice(i, i + 90);
        const rows = await all<{ token: string }>(env.DB,
          `SELECT token FROM push_tokens WHERE user_id IN (${chunk.map(() => "?").join(",")})${job.app ? " AND app = ?" : ""}`,
          ...chunk, ...(job.app ? [job.app] : []));
        for (let j = 0; j < rows.length; j += 20) {
          await Promise.all(rows.slice(j, j + 20).map((r) => sendOne(env, sa, bearer, r.token, job.message).catch((e) => console.error("FCM", e))));
        }
      }
    }
  } catch (e) {
    console.error("push failed", e);
  }
}

/** Pushes to every device of an app audience (administration broadcasts). */
export async function audienceUserIds(env: Env, audience: "all" | "customers" | "providers") {
  const where = audience === "customers" ? "WHERE app = 'customer'" : audience === "providers" ? "WHERE app = 'provider'" : "";
  return (await all<{ user_id: string }>(env.DB, `SELECT DISTINCT user_id FROM push_tokens ${where} LIMIT 2000`)).map((r) => r.user_id);
}
