import type { Env } from "./core";

/** File storage: uses R2 when a FILES bucket is bound, otherwise stores files inside D1 in chunks. */
const CHUNK = 512 * 1024;

export type StoredFile = { body: ReadableStream | ArrayBuffer; contentType: string; size: number };

export async function putFile(env: Env, key: string, file: File, contentType = file.type) {
  if (env.FILES) {
    await env.FILES.put(key, file.stream(), { httpMetadata: { contentType } });
    return;
  }
  const buf = new Uint8Array(await file.arrayBuffer());
  const n = Math.max(1, Math.ceil(buf.byteLength / CHUNK));
  await env.DB.prepare("DELETE FROM stored_files WHERE key = ?").bind(key).run();
  await env.DB.prepare("INSERT INTO stored_files (key, content_type, size, chunks) VALUES (?,?,?,?)").bind(key, contentType, buf.byteLength, n).run();
  for (let i = 0; i < n; i++) {
    // One chunk per statement keeps every request well under D1's size limits.
    await env.DB.prepare("INSERT INTO stored_file_chunks (key, idx, data) VALUES (?,?,?)").bind(key, i, buf.slice(i * CHUNK, (i + 1) * CHUNK).buffer).run();
  }
}

export async function getFile(env: Env, key: string): Promise<StoredFile | null> {
  if (env.FILES) {
    const obj = await env.FILES.get(key);
    if (!obj) return null;
    return { body: obj.body, contentType: obj.httpMetadata?.contentType ?? "application/octet-stream", size: obj.size };
  }
  const meta = await env.DB.prepare("SELECT content_type, size, chunks FROM stored_files WHERE key = ?").bind(key).first<{ content_type: string; size: number; chunks: number }>();
  if (!meta) return null;
  const out = new Uint8Array(meta.size);
  let offset = 0;
  for (let i = 0; i < meta.chunks; i++) {
    const row = await env.DB.prepare("SELECT data FROM stored_file_chunks WHERE key = ? AND idx = ?").bind(key, i).first<{ data: ArrayBuffer | number[] }>();
    if (!row) return null;
    const part = row.data instanceof ArrayBuffer ? new Uint8Array(row.data) : Uint8Array.from(row.data as number[]);
    out.set(part, offset);
    offset += part.byteLength;
  }
  return { body: out.buffer, contentType: meta.content_type, size: meta.size };
}

export async function deleteFiles(env: Env, keys: string[]) {
  if (!keys.length) return;
  if (env.FILES) { await env.FILES.delete(keys); return; }
  await env.DB.batch(keys.flatMap((k) => [
    env.DB.prepare("DELETE FROM stored_file_chunks WHERE key = ?").bind(k),
    env.DB.prepare("DELETE FROM stored_files WHERE key = ?").bind(k),
  ]));
}
