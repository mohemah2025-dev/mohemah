export interface Env {
  DB: D1Database;
  /** Optional: when no R2 bucket is bound, files are stored in D1. */
  FILES?: R2Bucket;
  ASSETS: Fetcher;
  ALLOWED_ORIGINS?: string;
  FILE_SIGNING_SECRET?: string;
  PBKDF2_ITERATIONS?: string;
  /** Firebase service account JSON (secret) used to send push notifications. */
  FCM_SERVICE_ACCOUNT?: string;
  /** Payment gateway secret keys (Worker secrets). */
  MOYASAR_SECRET_KEY?: string;
  MOYASAR_WEBHOOK_SECRET?: string;
  TAP_SECRET_KEY?: string;
  /** SMS provider key (Unifonic AppSid / Taqnyat bearer token / Msegat API key). */
  SMS_API_KEY?: string;
  /** E-mail provider key (Resend / SendGrid). */
  EMAIL_API_KEY?: string;
  /** WhatsApp Cloud API permanent access token (Meta). */
  WHATSAPP_TOKEN?: string;
}

export type App = "customer" | "provider" | "admin";
export type Role = "admin" | "staff" | "provider" | "customer";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

export const fail = (status: number, code: string, message?: string): never => {
  throw new ApiError(status, code, message);
};

export function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const addDays = (iso: string, days: number) => new Date(new Date(iso).getTime() + days * 86400000).toISOString();
export function addMonths(iso: string, months: number) {
  const d = new Date(iso);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString();
}

/* ---------- DB helpers ---------- */
export async function first<T = Record<string, unknown>>(db: D1Database, sql: string, ...params: unknown[]) {
  return (await db.prepare(sql).bind(...params).first<T>()) ?? null;
}
export async function all<T = Record<string, unknown>>(db: D1Database, sql: string, ...params: unknown[]) {
  return (await db.prepare(sql).bind(...params).all<T>()).results ?? [];
}
export async function run(db: D1Database, sql: string, ...params: unknown[]) {
  return db.prepare(sql).bind(...params).run();
}
export const stmt = (db: D1Database, sql: string, ...params: unknown[]) => db.prepare(sql).bind(...params);

/** Builds "IN (?, ?, ?)" placeholders. */
export const inList = (n: number) => `(${Array.from({ length: Math.max(n, 1) }, () => "?").join(",")})`;

/* ---------- Input validation ---------- */
type Body = Record<string, unknown>;

export async function readJson(req: Request): Promise<Body> {
  try {
    const b = await req.json();
    return b && typeof b === "object" && !Array.isArray(b) ? (b as Body) : {};
  } catch {
    return {};
  }
}

export function str(b: Body, key: string, opts: { required?: boolean; max?: number; min?: number; label?: string } = {}) {
  const v = b[key];
  if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
    if (opts.required) fail(400, "missing_field", `${opts.label ?? key} مطلوب`);
    return null;
  }
  if (typeof v !== "string" && typeof v !== "number") fail(400, "invalid_field", `${opts.label ?? key} غير صالح`);
  const s = String(v).trim();
  if (opts.min && s.length < opts.min) fail(400, "invalid_field", `${opts.label ?? key} قصير جداً`);
  if (opts.max && s.length > opts.max) fail(400, "invalid_field", `${opts.label ?? key} طويل جداً`);
  return s;
}

export function num(b: Body, key: string, opts: { required?: boolean; min?: number; max?: number; int?: boolean; label?: string } = {}) {
  const v = b[key];
  if (v === undefined || v === null || v === "") {
    if (opts.required) fail(400, "missing_field", `${opts.label ?? key} مطلوب`);
    return null;
  }
  const n = Number(v);
  if (!Number.isFinite(n)) fail(400, "invalid_field", `${opts.label ?? key} غير صالح`);
  if (opts.int && !Number.isInteger(n)) fail(400, "invalid_field", `${opts.label ?? key} يجب أن يكون عدداً صحيحاً`);
  if (opts.min !== undefined && n < opts.min) fail(400, "invalid_field", `${opts.label ?? key} أقل من المسموح`);
  if (opts.max !== undefined && n > opts.max) fail(400, "invalid_field", `${opts.label ?? key} أكبر من المسموح`);
  return n;
}

export function bool(b: Body, key: string) {
  const v = b[key];
  if (v === undefined || v === null) return null;
  return v === true || v === 1 || v === "1" || v === "true";
}

export function oneOf<T extends string>(b: Body, key: string, values: readonly T[], opts: { required?: boolean; label?: string } = {}): T | null {
  const v = str(b, key, opts);
  if (v === null) return null;
  if (!values.includes(v as T)) fail(400, "invalid_field", `${opts.label ?? key} غير صالح`);
  return v as T;
}

export function strArray(b: Body, key: string, max = 100): string[] {
  const v = b[key];
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string" && x.length <= 64).slice(0, max) as string[];
}

export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
export function normalizePhone(raw: string) {
  let p = raw.replace(/[\s-]+/g, "").replace(/^00/, "+");
  if (p.startsWith("05")) p = "+966" + p.slice(1);
  else if (p.startsWith("5") && p.length === 9) p = "+966" + p;
  return p;
}
export const validSaudiPhone = (p: string) => /^\+9665\d{8}$/.test(p);

export const REGIONS = ["الرياض", "جدة", "مكة", "المدينة", "بريدة", "الدمام", "الخبر", "أبها", "تبوك", "حائل", "جازان", "نجران", "الطائف", "الأحساء", "الجوف", "عرعر", "الباحة"] as const;

/* ---------- Router ---------- */
export type Ctx = {
  req: Request; env: Env; url: URL; params: Record<string, string>; ip: string;
  /** Push notifications to send after a successful response. */
  push: import("./push").PushJob[];
  /** Background work (SMS, e-mail) finished after the response is sent. */
  tasks: Promise<unknown>[];
};
type Handler = (c: Ctx) => Promise<Response>;

export class Router {
  private routes: { method: string; parts: string[]; handler: Handler }[] = [];
  on(method: string, path: string, handler: Handler) {
    this.routes.push({ method, parts: path.split("/").filter(Boolean), handler });
    return this;
  }
  get(p: string, h: Handler) { return this.on("GET", p, h); }
  post(p: string, h: Handler) { return this.on("POST", p, h); }
  put(p: string, h: Handler) { return this.on("PUT", p, h); }
  patch(p: string, h: Handler) { return this.on("PATCH", p, h); }
  delete(p: string, h: Handler) { return this.on("DELETE", p, h); }

  match(method: string, pathname: string) {
    const parts = pathname.split("/").filter(Boolean);
    for (const r of this.routes) {
      if (r.method !== method || r.parts.length !== parts.length) continue;
      const params: Record<string, string> = {};
      let ok = true;
      for (let i = 0; i < parts.length; i++) {
        const rp = r.parts[i];
        if (rp.startsWith(":")) params[rp.slice(1)] = decodeURIComponent(parts[i]);
        else if (rp !== parts[i]) { ok = false; break; }
      }
      if (ok) return { handler: r.handler, params };
    }
    return null;
  }
}
