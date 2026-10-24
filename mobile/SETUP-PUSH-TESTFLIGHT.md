# التنبيهات الفورية + TestFlight

## أولاً: التنبيهات الفورية (Firebase — مجاني)

تصل التنبيهات للجوال والتطبيق مغلق: طلب جديد لمقدم الخدمة، قبول/وصول/إنجاز للعميل، رسائل المحادثة، وإشعارات الإدارة.

1. افتح https://console.firebase.google.com ← **Create a project** ← الاسم `mohemah`.
2. **أندرويد:** اضغط أيقونة أندرويد ← Package name: `sa.mohemah.app` ← Register (تجاهل بقية الخطوات).
   كرر لتطبيق ثانٍ: `sa.mohemah.partner`.
3. ⚙️ **Project settings** ← تبويب **General** ← انزل إلى تطبيقات أندرويد ← نزّل **google-services.json** (ملف واحد يضم التطبيقين).
4. ارفعه في GitHub داخل المجلد `mobile/firebase/` (بنفس الاسم).
5. ⚙️ **Project settings** ← تبويب **Service accounts** ← **Generate new private key** ← يُنزَّل ملف JSON (سري، لا ترفعه لـ GitHub).
6. Cloudflare ← **Workers & Pages** ← **app** ← **Settings** ← **Variables and Secrets** ← **Add**:
   - Type: **Secret**
   - Name: `FCM_SERVICE_ACCOUNT`
   - Value: افتح ملف JSON بالمفكرة وانسخ محتواه كاملاً والصقه
   - **Deploy**
7. بعد اكتمال بناء GitHub ثبّت النسختين الجديدتين، سجّل الدخول، واسمح بالإشعارات عند السؤال.

**للآيفون (بعد حساب Apple):**
- Apple Developer ← **Keys** ← ➕ ← فعّل **Apple Push Notifications service (APNs)** ← نزّل ملف `.p8` واحفظ **Key ID**.
- Firebase ← Project settings ← **Cloud Messaging** ← **Apple app configuration** ← ارفع ملف `.p8` مع Key ID و Team ID.
- Firebase ← أضف تطبيقي iOS بنفس المعرّفين، ونزّل ملفي `GoogleService-Info.plist` وأعد تسميتهما:
  `GoogleService-Info-customer.plist` و `GoogleService-Info-provider.plist` ثم ارفعهما إلى `mobile/firebase/`.

## ثانياً: TestFlight (بدون جهاز ماك — عبر Codemagic)

1. اشترك في **Apple Developer Program** (99$ سنوياً): https://developer.apple.com/programs/enroll
2. **Certificates, IDs & Profiles ← Identifiers ← ➕ App IDs**:
   - `sa.mohemah.app` — فعّل **Push Notifications**
   - `sa.mohemah.partner` — فعّل **Push Notifications**
3. **App Store Connect ← Apps ← ➕ New App** (مرتين): المنصة iOS، اللغة العربية، اختر المعرّف، والاسم «مهمة» / «مهمة شريك» (إن كان الاسم محجوزاً أضف كلمة مثل «مهمة - خدمات»).
4. **App Store Connect ← Users and Access ← Integrations ← App Store Connect API ← ➕**: الدور **App Manager** ← نزّل ملف `.p8` (يُنزَّل مرة واحدة) واحفظ **Issuer ID** و **Key ID**.
5. https://codemagic.io ← سجّل الدخول بحساب GitHub ← **Add application** ← المستودع `mohemah2025-dev/mohemah` ← نوع المشروع Flutter ← يقرأ ملف `codemagic.yaml` تلقائياً.
6. Codemagic ← **Team settings ← Integrations ← Developer Portal ← Connect** ← الاسم بالضبط: `Mohemah ASC` ← أدخل Issuer ID و Key ID وارفع `.p8`.
7. Codemagic ← **Team settings ← Code signing identities ← iOS certificates ← Generate certificate** (نوع Apple Distribution).
8. Codemagic ← التطبيق ← **Environment variables**: مجموعة باسم `mohemah` فيها `API_BASE` = رابط الخادم.
9. **Start new build** ← اختر `iOS • مهمة` ثم `iOS • مهمة شريك`. بعد نحو 20 دقيقة ومعالجة أبل يظهر التطبيق في **TestFlight**.
10. App Store Connect ← التطبيق ← **TestFlight ← Internal Testing** ← أضف المختبرين بالبريد، فيصلهم رابط تطبيق TestFlight على الآيفون.

الحصة المجانية في Codemagic تكفي لعشرات البناءات شهرياً.
