# إعدادات Firebase للتنبيهات الفورية

ضع هنا الملفات التي تنزّلها من Firebase Console ← Project settings:

| الملف | من أين |
|---|---|
| `google-services.json` | تطبيقا أندرويد `sa.mohemah.app` و`sa.mohemah.partner` (ملف واحد يضم الاثنين، نزّله بعد إضافة التطبيقين) |
| `GoogleService-Info-customer.plist` | تطبيق iOS `sa.mohemah.app` (أعد تسمية الملف بعد تنزيله) |
| `GoogleService-Info-provider.plist` | تطبيق iOS `sa.mohemah.partner` |

هذه الملفات معرّفات عامة للتطبيق وليست أسراراً. المفتاح السري (Service account) لا يوضع هنا، بل في Cloudflare باسم `FCM_SERVICE_ACCOUNT`.
