import type { Env } from "./core";
// migrations/*.sql embedded at build time (npm run build) so a fresh D1 database is set up on the first request.
import { MIGRATIONS } from "./migrations.gen";

function statements(sql: string) {
  return sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

let ready: Promise<void> | null = null;

export function ensureSchema(env: Env) {
  ready ??= migrate(env).catch((e) => { ready = null; throw e; });
  return ready;
}

async function migrate(env: Env) {
  const db = env.DB;
  // Also understands databases migrated earlier with `wrangler d1 migrations apply`.
  await db.prepare("CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)").run();
  const done = new Set(((await db.prepare("SELECT name FROM d1_migrations").all<{ name: string }>()).results ?? []).map((r) => r.name));
  for (const m of MIGRATIONS) {
    if (done.has(m.name)) continue;
    if (m.name === "0001_init.sql") {
      const exists = await db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users'").first();
      if (exists) { await db.prepare("INSERT OR IGNORE INTO d1_migrations (name) VALUES (?)").bind(m.name).run(); continue; }
    }
    await db.batch([...statements(m.sql).map((s) => db.prepare(s)), db.prepare("INSERT OR IGNORE INTO d1_migrations (name) VALUES (?)").bind(m.name)]);
  }
  await db.prepare("CREATE TABLE IF NOT EXISTS app_secrets (name TEXT PRIMARY KEY, value TEXT NOT NULL)").run();
}

/** File-link signing key: the FILE_SIGNING_SECRET secret if set, otherwise a random key kept in D1. */
let secretCache: string | null = null;
export async function signingSecret(env: Env) {
  if (env.FILE_SIGNING_SECRET) return env.FILE_SIGNING_SECRET;
  if (secretCache) return secretCache;
  const row = await env.DB.prepare("SELECT value FROM app_secrets WHERE name = 'file_signing'").first<{ value: string }>();
  if (row) return (secretCache = row.value);
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const value = btoa(String.fromCharCode(...bytes));
  await env.DB.prepare("INSERT OR IGNORE INTO app_secrets (name, value) VALUES ('file_signing', ?)").bind(value).run();
  return (secretCache = (await env.DB.prepare("SELECT value FROM app_secrets WHERE name = 'file_signing'").first<{ value: string }>())!.value);
}
