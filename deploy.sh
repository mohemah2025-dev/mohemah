#!/usr/bin/env bash
# نشر مهمة من الطرفية (بديل عن النشر من لوحة Cloudflare). يتطلب: npm install && npx wrangler login
# قاعدة البيانات D1 وحاوية R2 تُنشآن تلقائياً عند أول نشر، والجداول تُنشأ تلقائياً عند أول فتح.
set -uo pipefail
LOG=$(mktemp)
npx wrangler whoami >/dev/null 2>&1 || { echo "✖ شغّل أولاً: npx wrangler login"; exit 1; }
[ -n "${DOMAIN:-}" ] && node -e "
const fs=require('fs');const f='wrangler.jsonc';let s=fs.readFileSync(f,'utf8');
s=s.replace(/\n  \"routes\": \[[^\]]*\],/,'');
s=s.replace('\"workers_dev\": true,','\"workers_dev\": true,\n  \"routes\": [{ \"pattern\": \"$DOMAIN\", \"custom_domain\": true }],');
fs.writeFileSync(f,s);"
npm run build >"$LOG" 2>&1 || { tail -20 "$LOG"; echo "✖ فشل البناء"; exit 1; }
npx wrangler deploy 2>&1 | tee "$LOG"
grep -qi "workers.dev subdomain" "$LOG" && { echo "✖ اختر اسماً فرعياً لحسابك من لوحة Cloudflare ← Workers & Pages ثم أعد المحاولة"; exit 1; }
URL=$(grep -oE "https://[a-zA-Z0-9.-]+\.workers\.dev" "$LOG" | head -1)
[ -n "${DOMAIN:-}" ] && URL="https://$DOMAIN"
[ -n "$URL" ] || { echo "✖ لم يكتمل النشر — أرسل صورة الشاشة"; exit 1; }
echo "$URL" > .deployed-url
printf '\n✅ تم النشر\n  طالب الخدمة: %s\n  مقدم الخدمة: %s/provider\n  لوحة التحكم: %s/admin\n' "$URL" "$URL" "$URL"
