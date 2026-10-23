# مهمة — التشغيل والنشر على Cloudflare

## البنية
| الجزء | التقنية | المسار |
|---|---|---|
| تطبيق طالب الخدمة | React SPA | `/` (الدخول `/auth`) |
| تطبيق مقدم الخدمة | React SPA | `/provider` (الدخول والتسجيل `/provider/auth`) |
| لوحة التحكم | React SPA | `/admin` |
| الـ API | Cloudflare Worker | `worker/` ← `/api/*` |
| قاعدة البيانات | Cloudflare D1 | `migrations/0001_init.sql` |
| الملفات (الهويات، الشهادات، الشعار، الإعلانات) | Cloudflare R2 | `mohemah-files` |

لكل تطبيق جلسة دخول مستقلة، فيمكن فتح تطبيق العميل وتطبيق مقدم الخدمة في نفس المتصفح بحسابين مختلفين.

## التشغيل المحلي
```bash
npm install
npm run dev                   # http://localhost:5173 (الواجهات + الـ API معاً)
```
اختياري لتعبئة بيانات تجريبية: `python3 scripts/seed_demo.py http://localhost:5173`
(المالك: admin / Admin@12345 — عميل: khaled@demo.sa — مقدم خدمة: fahad@demo.sa — كلمة المرور Pass@1234)

اختبار الـ API الكامل (على قاعدة جديدة فارغة): `python3 scripts/e2e_api_test.py http://localhost:5173`

## النشر من لوحة Cloudflare (بدون طرفية)
1. ارفع المشروع إلى مستودع على GitHub باسم `mohemah`.
2. في dash.cloudflare.com: **Workers & Pages** ← **Create** ← **Import a repository** ← اربط GitHub واختر `mohemah`.
3. الإعدادات:
   - **Project name:** `app` (يجب أن يطابق الاسم في `wrangler.jsonc`)
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler deploy`
4. اضغط **Deploy**. تُنشأ قاعدة D1 وحاوية R2 تلقائياً، وتُنشأ الجداول عند أول فتح للتطبيق.
5. الرابط يظهر في صفحة المشروع: `https://app.<اسم-حسابك>.workers.dev` — افتح `/admin` وأنشئ كلمة مرور المالك.

بعدها كل تعديل يُرفع إلى GitHub يُنشر تلقائياً.

> يحتاج R2 تفعيلاً لمرة واحدة من لوحة Cloudflare (**R2 Object Storage** ← Enable). الخطة المجانية تشمل 10GB.

## النشر من الطرفية (بديل)
```bash
npm install && npx wrangler login && ./deploy.sh
```
نطاق خاص: `DOMAIN=app.mohemah.sa ./deploy.sh`

### ملاحظات مهمة
- **خطة Workers المدفوعة (5$ شهرياً) موصى بها**: تشفير كلمات المرور (PBKDF2) يحتاج وقت معالجة أعلى من حد الخطة المجانية (10ms). للتجربة على الخطة المجانية أضف في `wrangler.jsonc` ضمن `vars`: `"PBKDF2_ITERATIONS": "20000"`.
- **الدفع تجريبي**: الشحن والاشتراك يعملان بلا خصم فعلي ما دام «السماح بالدفع التجريبي» مفعّلاً (لوحة التحكم ← الاشتراكات والتحصيل). عطّله قبل الإطلاق، وربط البوابة الحقيقية مرحلة لاحقة.
- **نسيان كلمة المرور**: لا يوجد بريد إرسال بعد؛ المالك يعيد التعيين من «المستخدمون والصلاحيات».
- **ترحيلات مستقبلية**: أضف ملفاً جديداً `migrations/0002_*.sql`؛ يُضمَّن تلقائياً عند البناء ويُطبَّق عند أول طلب بعد النشر. لا تعدّل `0001` بعد النشر.
- **نسخة الجوال (المرحلة الثانية)**: `MOBILE=1 VITE_API_BASE=https://<نطاقك> npx vite build` ينتج `dist-mobile/` لتغليفه بـ Capacitor، والـ API يسمح مسبقاً بأصول Capacitor عبر `ALLOWED_ORIGINS`.
