# تطبيقات مهمة للجوال (Flutter)

تطبيقان أصليان لأندرويد وآيفون من كود واحد بلغة **Dart / Flutter**، يتصلان بنفس خادم Cloudflare الذي تعمل عليه لوحة التحكم:

| التطبيق | المجلد | المعرّف في المتاجر |
|---|---|---|
| **مهمة** — طالب الخدمة | `apps/customer` | `sa.mohemah.app` |
| **مهمة شريك** — مقدم الخدمة | `apps/provider` | `sa.mohemah.partner` |

## الهيكل

```
mobile/
  packages/mohemah_core/   الكود المشترك: الاتصال بالخادم، الجلسات، الهوية البصرية، شاشة الافتتاح، الصفحات المشتركة
  apps/customer/           تطبيق طالب الخدمة
  apps/provider/           تطبيق مقدم الخدمة
  branding/                أيقونات التطبيقين
  tool/configure_platforms.py  ضبط أسماء التطبيقين ومعرّفاتهما وصلاحياتهما بعد إنشاء مجلدات أندرويد وآيفون
```

- **شاشة الافتتاح** (`packages/mohemah_core/lib/src/splash.dart`): شرائح مائلة تدخل من الجانبين وتتداخل، ثم تغطي الشاشة شريحة بألوان الهوية، ثم يظهر الشعار واسم التطبيق.
- **قواعد العمل كلها في الخادم** (تكلفة الطلب، القبول، الاسترجاع...). التطبيقان يعرضان ويرسلان فقط.
- الجلسة لكل تطبيق منفصلة كما في نسخة الويب.

## البناء (تلقائي على GitHub)

ملف `.github/workflows/mobile.yml` يبني التطبيقين عند كل تحديث لمجلد `mobile/`:

1. **مرة واحدة:** في المستودع اذهب إلى **Settings ← Secrets and variables ← Actions ← Variables** وأضف متغيراً باسم `API_BASE` قيمته رابط الخادم، مثل `https://app.<حسابك>.workers.dev`.
2. ارفع التحديثات. سيظهر البناء في تبويب **Actions**، ويستغرق قرابة 10 دقائق.
3. بعد نجاحه تجد الملفين في **Releases ← mobile-test**:
   - `mohemah-customer.apk`
   - `mohemah-partner.apk`

   افتح الرابط من جوال أندرويد، ونزّل الملف وثبّته.

لبناء نسخة آيفون للتحقق منها: من **Actions ← Mobile apps ← Run workflow** فعّل خيار iOS. النسخة الموقّعة للآيفون (TestFlight) تحتاج حساب Apple Developer.

## البناء على جهازك (اختياري)

```bash
cd mobile/apps/customer            # أو apps/provider
flutter create --platforms=android,ios --org sa.mohemah --project-name mohemah_customer .
python3 ../../tool/configure_platforms.py . customer
flutter pub get
dart run flutter_launcher_icons
dart run flutter_native_splash:create
flutter run --dart-define=API_BASE=https://app.<حسابك>.workers.dev
```

الخط المستخدم Cairo مرخّص برخصة SIL Open Font License.
