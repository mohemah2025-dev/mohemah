import { all, fail, first, now, run, type App, type Ctx, type Env, type Role } from "./core";
import { signingSecret } from "./migrate";

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/* ---------- Passwords: PBKDF2-SHA256, stored as pbkdf2$<iterations>$<salt>$<hash> ---------- */
async function derive(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
}

export async function hashPassword(env: Env, password: string) {
  const iterations = Math.min(Math.max(Number(env.PBKDF2_ITERATIONS) || 100000, 10000), 100000);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, iterations);
  return `pbkdf2$${iterations}$${b64url(salt)}$${b64url(hash)}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, iter, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2" || !iter || !salt || !hash) return false;
  const got = new Uint8Array(await derive(password, fromB64url(salt), Number(iter)));
  const want = fromB64url(hash);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
  return diff === 0;
}

export function validatePassword(p: string | null) {
  if (!p || p.length < 8) fail(400, "weak_password", "كلمة المرور 8 أحرف على الأقل");
  if (p!.length > 128) fail(400, "weak_password", "كلمة المرور طويلة جداً");
}

/* ---------- Sessions ---------- */
async function sha256(s: string) {
  return b64url(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}

const SESSION_DAYS = 60;

export async function createSession(env: Env, userId: string, app: App, userAgent: string | null) {
  const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await run(env.DB, "INSERT INTO sessions (token_hash, user_id, app, expires_at, user_agent) VALUES (?,?,?,?,?)", await sha256(token), userId, app, expires, userAgent?.slice(0, 200) ?? null);
  return token;
}

export async function destroySession(env: Env, token: string) {
  await run(env.DB, "DELETE FROM sessions WHERE token_hash = ?", await sha256(token));
}

export type AuthUser = {
  id: string;
  email: string | null;
  username: string | null;
  full_name: string | null;
  is_active: number;
  verification_status: string;
  roles: Role[];
  app: App;
};

function bearer(req: Request) {
  const h = req.headers.get("authorization") ?? "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : null;
}

export async function getUser(c: Ctx): Promise<AuthUser | null> {
  const token = bearer(c.req);
  if (!token) return null;
  const row = await first<{ user_id: string; app: App; expires_at: string; email: string | null; username: string | null; full_name: string | null; is_active: number; verification_status: string }>(
    c.env.DB,
    `SELECT s.user_id, s.app, s.expires_at, u.email, u.username, u.full_name, u.is_active, u.verification_status
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
    await sha256(token),
  );
  if (!row || row.expires_at < now()) return null;
  const roles = (await all<{ role: Role }>(c.env.DB, "SELECT role FROM user_roles WHERE user_id = ?", row.user_id)).map((r) => r.role);
  return { id: row.user_id, email: row.email, username: row.username, full_name: row.full_name, is_active: row.is_active, verification_status: row.verification_status, roles, app: row.app };
}

export async function requireUser(c: Ctx, opts: { app?: App | App[]; roles?: Role[] } = {}) {
  const u = await getUser(c);
  if (!u) return fail(401, "unauthenticated", "سجّل الدخول للمتابعة");
  if (!u.is_active) fail(403, "account_suspended", "تم إيقاف هذا الحساب، تواصل مع الدعم");
  if (opts.app) {
    const apps = Array.isArray(opts.app) ? opts.app : [opts.app];
    if (!apps.includes(u.app)) fail(403, "wrong_app", "هذه العملية غير متاحة من هذا التطبيق");
  }
  if (opts.roles && !opts.roles.some((r) => u.roles.includes(r))) fail(403, "forbidden", "لا تملك صلاحية لهذه العملية");
  return u;
}

export const isAdmin = (u: AuthUser) => u.roles.includes("admin") || u.roles.includes("staff");
export const requireAdmin = (c: Ctx) => requireUser(c, { app: "admin", roles: ["admin", "staff"] });
export const requireOwner = (c: Ctx) => requireUser(c, { app: "admin", roles: ["admin"] });
export const requireProvider = (c: Ctx) => requireUser(c, { app: "provider", roles: ["provider"] });

/* ---------- Simple rate limit on sign-in ---------- */
export async function rateLimit(env: Env, key: string, max: number, windowMinutes: number) {
  const row = await first<{ count: number; window_start: string }>(env.DB, "SELECT count, window_start FROM login_attempts WHERE key = ?", key);
  const t = now();
  const windowStart = new Date(Date.now() - windowMinutes * 60000).toISOString();
  if (!row || row.window_start < windowStart) {
    await run(env.DB, "INSERT INTO login_attempts (key, count, window_start) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start", key, t);
    return;
  }
  if (row.count >= max) fail(429, "too_many_attempts", "محاولات كثيرة، حاول بعد قليل");
  await run(env.DB, "UPDATE login_attempts SET count = count + 1 WHERE key = ?", key);
}
export const clearRateLimit = (env: Env, key: string) => run(env.DB, "DELETE FROM login_attempts WHERE key = ?", key);

/* ---------- Signed file URLs (private provider documents) ---------- */
async function hmac(env: Env, data: string) {
  const secret = await signingSecret(env);
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}
export async function signFileUrl(env: Env, key: string, ttlSeconds = 600) {
  const e = Math.floor(Date.now() / 1000) + ttlSeconds;
  const s = await hmac(env, `${key}:${e}`);
  return `/api/files/doc?k=${encodeURIComponent(key)}&e=${e}&s=${s}`;
}
export async function verifyFileSignature(env: Env, key: string, e: string, s: string) {
  if (!key || !e || !s || Number(e) < Date.now() / 1000) return false;
  return (await hmac(env, `${key}:${e}`)) === s;
}

/* ---------- Admin permissions per section ---------- */
export const ADMIN_SECTIONS = [
  "dashboard", "customers", "providers", "services", "finance", "billing", "gateways",
  "notifications", "messages", "ads", "policies", "integrations", "staff", "settings",
] as const;
export type AdminSection = (typeof ADMIN_SECTIONS)[number];
export type PermLevel = "none" | "view" | "edit";
export type AdminPermissions = Record<AdminSection, PermLevel>;

/** Staff without custom permissions keep the previous behaviour: everything except administration pages. */
export function defaultStaffPermissions(): AdminPermissions {
  const p = Object.fromEntries(ADMIN_SECTIONS.map((s) => [s, "edit"])) as AdminPermissions;
  p.gateways = "view";
  p.settings = "view";
  p.integrations = "none";
  p.staff = "none";
  return p;
}

export function parsePermissions(raw: unknown): AdminPermissions {
  const base = defaultStaffPermissions();
  let obj: Record<string, unknown> = {};
  if (typeof raw === "string" && raw) { try { obj = JSON.parse(raw); } catch { obj = {}; } } else if (raw && typeof raw === "object") obj = raw as Record<string, unknown>;
  for (const s of ADMIN_SECTIONS) {
    const v = obj[s];
    if (v === "none" || v === "view" || v === "edit") base[s] = v;
  }
  return base;
}

export async function permissionsOf(c: Ctx, u: AuthUser): Promise<AdminPermissions> {
  if (u.roles.includes("admin")) return Object.fromEntries(ADMIN_SECTIONS.map((s) => [s, "edit"])) as AdminPermissions;
  const row = await first<{ admin_permissions: string | null }>(c.env.DB, "SELECT admin_permissions FROM users WHERE id = ?", u.id);
  return parsePermissions(row?.admin_permissions);
}

/** Admin user with at least `level` on one of `sections` (the owner always passes). */
export async function requirePerm(c: Ctx, sections: AdminSection | AdminSection[], level: "view" | "edit") {
  const u = await requireAdmin(c);
  if (u.roles.includes("admin")) return u;
  const p = await permissionsOf(c, u);
  const list = Array.isArray(sections) ? sections : [sections];
  const ok = list.some((s) => (level === "view" ? p[s] !== "none" : p[s] === "edit"));
  if (!ok) fail(403, "forbidden", level === "view" ? "لا تملك صلاحية عرض هذا القسم" : "لا تملك صلاحية التعديل في هذا القسم");
  return u;
}
