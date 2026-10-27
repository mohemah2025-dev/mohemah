/**
 * Translation with Workers AI (binding AI): conversations between users who chose different app languages,
 * and admin-entered content (service names, policies, notifications) for the English / Urdu apps.
 * Results are cached in D1 so each text is translated once. Without the AI binding the original text is used.
 */
import { all, first, run, type Ctx, type Env } from "./core";

export type Lang = "ar" | "en" | "ur";
export const LANGS: Lang[] = ["ar", "en", "ur"];
const MODEL = "@cf/meta/m2m100-1.2b";

/** App language of the request (header x-lang or ?lang=), Arabic by default. */
export function langOf(c: Ctx): Lang {
  const v = (c.req.headers.get("x-lang") ?? c.url.searchParams.get("lang") ?? "ar").toLowerCase().slice(0, 2);
  return (LANGS as string[]).includes(v) ? (v as Lang) : "ar";
}

/** Rough script-based guess: Urdu letters → ur, other Arabic script → ar, otherwise en. */
export function detectLang(text: string): Lang {
  if (/[ٹڈڑںےۓھہۂکگچپژی]/.test(text) && !/[ةىي]/.test(text)) return "ur";
  if (/[؀-ۿ]/.test(text)) return "ar";
  return "en";
}

async function sha(text: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** One AI call (short texts); long texts are translated paragraph by paragraph. */
export async function aiTranslate(env: Env, text: string, from: Lang, to: Lang): Promise<string | null> {
  if (!env.AI || !text.trim() || from === to) return null;
  const parts = text.split(/(\n+)/);
  const out: string[] = [];
  for (const p of parts) {
    if (!p.trim() || /^\n+$/.test(p)) { out.push(p); continue; }
    try {
      const r = (await env.AI.run(MODEL, { text: p.slice(0, 1500), source_lang: from, target_lang: to })) as { translated_text?: string };
      out.push(r?.translated_text?.trim() || p);
    } catch (e) {
      console.error("translate", e);
      return null;
    }
  }
  return out.join("");
}

/** Translates many texts into `to` with the D1 cache; returns original text when it cannot be translated. */
export async function translateTexts(env: Env, texts: (string | null | undefined)[], to: Lang): Promise<Map<string, string>> {
  const res = new Map<string, string>();
  const unique = [...new Set(texts.filter((t): t is string => !!t && !!t.trim()))];
  if (!unique.length) return res;
  const todo = unique.filter((t) => detectLang(t) !== to);
  unique.filter((t) => !todo.includes(t)).forEach((t) => res.set(t, t));
  if (!todo.length) return res;
  const hashes = await Promise.all(todo.map(sha));
  for (let i = 0; i < todo.length; i += 90) {
    const hs = hashes.slice(i, i + 90);
    const rows = await all<{ hash: string; text: string }>(env.DB, `SELECT hash, text FROM content_translations WHERE lang = ? AND hash IN (${hs.map(() => "?").join(",")})`, to, ...hs);
    const byHash = new Map(rows.map((r) => [r.hash, r.text]));
    hs.forEach((h, k) => { const t = byHash.get(h); if (t) res.set(todo[i + k], t); });
  }
  const missing = todo.filter((t) => !res.has(t));
  if (!env.AI) { missing.forEach((t) => res.set(t, t)); return res; }
  // Limit the AI work done in one request; the rest stays in the original language until the next request.
  let budget = 40;
  await Promise.all(missing.map(async (t) => {
    if (budget-- <= 0) { res.set(t, t); return; }
    const out = await aiTranslate(env, t, detectLang(t), to);
    res.set(t, out ?? t);
    if (out) await run(env.DB, "INSERT OR REPLACE INTO content_translations (hash, lang, text) VALUES (?,?,?)", await sha(t), to, out).catch(() => {});
  }));
  return res;
}

/** Translates the given fields of each row in place (for lang ≠ ar). */
export async function translateRows<T extends Record<string, unknown>>(env: Env, rows: T[], fields: (keyof T)[], to: Lang) {
  if (to === "ar" || !rows.length) return rows;
  const map = await translateTexts(env, rows.flatMap((r) => fields.map((f) => r[f] as string | null)), to);
  for (const r of rows) for (const f of fields) { const v = r[f]; if (typeof v === "string" && map.has(v)) (r as Record<string, unknown>)[f as string] = map.get(v); }
  return rows;
}

/** Remembers the language the user writes and reads in. */
export async function rememberLang(c: Ctx, userId: string) {
  const lang = langOf(c);
  if (c.req.headers.get("x-lang")) await run(c.env.DB, "UPDATE users SET lang = ? WHERE id = ? AND lang <> ?", lang, userId, lang).catch(() => {});
  return lang;
}

/** Messages with `translated` (viewer's language) and `original_lang`; translations are cached per message. */
export async function translateMessages<T extends { id: string; body: string | null; lang: string | null; kind?: string | null }>(env: Env, rows: T[], to: Lang) {
  const need = rows.filter((m) => m.body && !(m.kind ?? "text").startsWith("price") && (m.lang ?? detectLang(m.body)) !== to);
  const out = rows.map((m) => ({ ...m, original_lang: m.lang ?? (m.body ? detectLang(m.body) : null), translated: null as string | null }));
  if (!need.length) return out;
  const ids = need.map((m) => m.id);
  const cached = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 90) {
    const chunk = ids.slice(i, i + 90);
    (await all<{ message_id: string; text: string }>(env.DB, `SELECT message_id, text FROM message_translations WHERE lang = ? AND message_id IN (${chunk.map(() => "?").join(",")})`, to, ...chunk))
      .forEach((r) => cached.set(r.message_id, r.text));
  }
  let budget = 25;
  await Promise.all(need.map(async (m) => {
    if (cached.has(m.id) || budget-- <= 0) return;
    const t = await aiTranslate(env, m.body!, (m.lang as Lang) ?? detectLang(m.body!), to);
    if (t) { cached.set(m.id, t); await run(env.DB, "INSERT OR REPLACE INTO message_translations (message_id, lang, text) VALUES (?,?,?)", m.id, to, t).catch(() => {}); }
  }));
  for (const m of out) m.translated = cached.get(m.id) ?? null;
  return out;
}

/** Transcribes a voice note (WAV / MP3 / M4A bytes) with Whisper; null when unavailable. */
export async function transcribe(env: Env, bytes: ArrayBuffer): Promise<string | null> {
  if (!env.AI) return null;
  try {
    const r = (await env.AI.run("@cf/openai/whisper", { audio: [...new Uint8Array(bytes)] })) as { text?: string };
    return r?.text?.trim() || null;
  } catch (e) {
    console.error("transcribe", e);
    return null;
  }
}

export async function userLang(env: Env, userId: string): Promise<Lang> {
  const r = await first<{ lang: string | null }>(env.DB, "SELECT lang FROM users WHERE id = ?", userId);
  return (LANGS as string[]).includes(r?.lang ?? "") ? (r!.lang as Lang) : "ar";
}
