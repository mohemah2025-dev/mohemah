/**
 * SMS and e-mail delivery through external providers.
 *
 * Settings that are not secret (provider, sender name, from address, on/off) live in app_settings and are
 * edited from the admin page «الرسائل والبريد». API keys are Worker secrets only:
 *   SMS_API_KEY    Unifonic AppSid | Taqnyat bearer token | Msegat API key
 *   EMAIL_API_KEY  Resend API key | SendGrid API key
 */
import { all, now, run, uid, type Ctx, type Env } from "./core";
import { getSettings, type Settings } from "./domain";

export const SMS_PROVIDERS = ["unifonic", "taqnyat", "msegat"] as const;
export const EMAIL_PROVIDERS = ["resend", "sendgrid"] as const;

type Result = { ok: true } | { ok: false; error: string };

/** 05XXXXXXXX / +9665XXXXXXXX → 9665XXXXXXXX (international format without +). */
export function intlPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("966")) return d;
  if (d.startsWith("05")) return `966${d.slice(1)}`;
  if (d.startsWith("5") && d.length === 9) return `966${d}`;
  return d;
}

async function log(env: Env, channel: "sms" | "email", recipient: string, subject: string | null, r: Result) {
  try {
    await run(env.DB, "INSERT INTO message_log (id, channel, recipient, subject, status, error, created_at) VALUES (?,?,?,?,?,?,?)",
      uid(), channel, recipient, subject, r.ok ? "sent" : "failed", r.ok ? null : r.error.slice(0, 500), now());
  } catch { /* logging must never break delivery */ }
}

async function readError(res: Response) {
  const t = await res.text().catch(() => "");
  return `HTTP ${res.status}: ${t.slice(0, 300)}`;
}

/* ---------------- SMS ---------------- */

export async function sendSmsWith(env: Env, s: Settings, to: string, body: string): Promise<Result> {
  const key = env.SMS_API_KEY;
  if (!key) return { ok: false, error: "SMS_API_KEY غير مضاف في أسرار Cloudflare" };
  if (!s.sms_provider) return { ok: false, error: "اختر مزود الرسائل" };
  if (!s.sms_sender) return { ok: false, error: "اكتب اسم المرسل المعتمد" };
  const number = intlPhone(to);
  try {
    let res: Response;
    switch (s.sms_provider) {
      case "unifonic":
        res = await fetch("https://el.cloud.unifonic.com/rest/SMS/messages", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ AppSid: key, SenderID: s.sms_sender, Recipient: number, Body: body }),
        });
        if (res.ok) {
          const j = await res.json<{ success?: boolean | string; message?: string }>().catch(() => ({}) as { success?: boolean; message?: string });
          if (String(j.success) !== "true") return { ok: false, error: j.message ?? "رفض المزود الرسالة" };
        }
        break;
      case "taqnyat":
        res = await fetch("https://api.taqnyat.sa/v1/messages", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
          body: JSON.stringify({ recipients: [number], body, sender: s.sms_sender }),
        });
        break;
      case "msegat":
        res = await fetch("https://www.msegat.com/gw/sendsms.php", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userName: s.sms_username ?? "", apiKey: key, numbers: number, userSender: s.sms_sender, msg: body, msgEncoding: "UTF8" }),
        });
        if (res.ok) {
          const j = await res.json<{ code?: string | number; message?: string }>().catch(() => ({}) as { code?: string; message?: string });
          if (String(j.code) !== "1" && String(j.code) !== "M0000") return { ok: false, error: j.message ?? `رمز ${j.code}` };
        }
        break;
      default:
        return { ok: false, error: "مزود رسائل غير معروف" };
    }
    if (!res.ok) return { ok: false, error: await readError(res) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e) };
  }
}

/* ---------------- E-mail ---------------- */

export function emailLayout(s: Settings, title: string, text: string) {
  const esc = (v: string) => v.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
  const color = s.primary_color || "#2B6CD9";
  return `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#f4f6fa;font-family:Tahoma,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e3e8f0">
<tr><td style="background:${color};color:#fff;padding:18px 24px;font-size:18px;font-weight:bold">${esc(s.app_name)}</td></tr>
<tr><td style="padding:24px;color:#1b2430;font-size:15px;line-height:1.9">
<h2 style="margin:0 0 12px;font-size:18px">${esc(title)}</h2>
<p style="margin:0;white-space:pre-line">${esc(text)}</p></td></tr>
<tr><td style="padding:14px 24px;background:#f8fafc;color:#7a8594;font-size:12px">${esc(s.support_email ?? "")} ${esc(s.support_phone ?? "")}</td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendEmailWith(env: Env, s: Settings, to: string, subject: string, html: string): Promise<Result> {
  const key = env.EMAIL_API_KEY;
  if (!key) return { ok: false, error: "EMAIL_API_KEY غير مضاف في أسرار Cloudflare" };
  if (!s.email_provider) return { ok: false, error: "اختر مزود البريد" };
  if (!s.email_from) return { ok: false, error: "اكتب بريد المرسل (من نطاق موثّق لدى المزود)" };
  const fromName = s.email_from_name || s.app_name;
  try {
    let res: Response;
    if (s.email_provider === "resend") {
      res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({ from: `${fromName} <${s.email_from}>`, to: [to], subject, html }),
      });
    } else if (s.email_provider === "sendgrid") {
      res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({ personalizations: [{ to: [{ email: to }] }], from: { email: s.email_from, name: fromName }, subject, content: [{ type: "text/html", value: html }] }),
      });
    } else {
      return { ok: false, error: "مزود بريد غير معروف" };
    }
    if (!res.ok) return { ok: false, error: await readError(res) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e) };
  }
}

/* ---------------- Background helpers used by the routes ---------------- */

/**
 * Sends an SMS and/or e-mail to users after the response (only for the channels switched on).
 * Missing phone/e-mail or a disabled channel is skipped silently.
 */
export function notifyExternal(c: Ctx, userIds: string[], msg: { title: string; body: string; sms?: boolean; email?: boolean }) {
  if (!userIds.length) return;
  c.tasks.push((async () => {
    const s = await getSettings(c.env);
    const wantSms = msg.sms !== false && !!s.sms_enabled;
    const wantEmail = msg.email !== false && !!s.email_enabled;
    if (!wantSms && !wantEmail) return;
    const marks = userIds.map(() => "?").join(",");
    const users = await all<{ phone: string | null; email: string | null }>(c.env.DB, `SELECT phone, email FROM users WHERE id IN (${marks})`, ...userIds);
    for (const u of users) {
      if (wantSms && u.phone) await log(c.env, "sms", u.phone, msg.title, await sendSmsWith(c.env, s, u.phone, `${s.app_name}: ${msg.body}`));
      if (wantEmail && u.email) await log(c.env, "email", u.email, msg.title, await sendEmailWith(c.env, s, u.email, msg.title, emailLayout(s, msg.title, msg.body)));
    }
  })().catch((e) => console.error("notifyExternal", e)));
}

export async function testSms(env: Env, to: string) {
  const s = await getSettings(env);
  const r = await sendSmsWith(env, s, to, `${s.app_name}: رسالة تجريبية من لوحة التحكم ✓`);
  await log(env, "sms", to, "رسالة تجريبية", r);
  return r;
}

export async function testEmail(env: Env, to: string) {
  const s = await getSettings(env);
  const r = await sendEmailWith(env, s, to, `${s.app_name} — بريد تجريبي`, emailLayout(s, "تم ربط البريد بنجاح", "هذه رسالة تجريبية من لوحة التحكم، وصولها يعني أن الربط يعمل."));
  await log(env, "email", to, "بريد تجريبي", r);
  return r;
}
