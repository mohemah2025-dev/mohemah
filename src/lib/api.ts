/** Thin client for the Mohemah Worker API. Each app (customer / provider / admin) keeps its own session token. */
export type App = "customer" | "provider" | "admin";

const BASE: string = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, "") ?? "";

export function appFromPath(pathname: string): App {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/provider")) return "provider";
  return "customer";
}

const key = (app: App) => `mohemah.session.${app}`;

export const session = {
  get(app: App): string | null {
    try { return localStorage.getItem(key(app)); } catch { return null; }
  },
  set(app: App, token: string) {
    try { localStorage.setItem(key(app), token); } catch { /* storage unavailable */ }
  },
  clear(app: App) {
    try { localStorage.removeItem(key(app)); } catch { /* storage unavailable */ }
  },
};

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public data?: unknown) {
    super(message);
  }
}

type Opts = { method?: string; body?: unknown; form?: FormData; app?: App; signal?: AbortSignal };

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const app = opts.app ?? appFromPath(typeof window === "undefined" ? "/" : window.location.pathname);
  const token = session.get(app);
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) { body = JSON.stringify(opts.body); headers["content-type"] = "application/json"; }
  let res: Response;
  try {
    res = await fetch(BASE + path, { method: opts.method ?? (body ? "POST" : "GET"), headers, body, signal: opts.signal });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    throw new ApiError(0, "network", "تعذّر الاتصال بالخادم، تحقق من الإنترنت");
  }
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const d = (data ?? {}) as { error?: string; message?: string };
    if (res.status === 401) session.clear(app);
    throw new ApiError(res.status, d.error ?? "error", d.message ?? "حدث خطأ غير متوقع", data);
  }
  return data as T;
}

export const errMsg = (e: unknown, fallback = "حدث خطأ غير متوقع") => (e instanceof ApiError || e instanceof Error ? e.message : fallback) || fallback;

/** Absolute URL for files served by the API (needed when the app runs inside Capacitor). */
export const fileUrl = (u: string | null | undefined) => (!u ? "" : u.startsWith("/") ? BASE + u : u);
