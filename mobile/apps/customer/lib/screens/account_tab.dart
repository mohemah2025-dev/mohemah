import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mohemah_core/mohemah_core.dart';

import '../orders_store.dart';
import 'addresses_page.dart';
import 'auth_page.dart';

class AccountTab extends StatelessWidget {
  const AccountTab({super.key});

  @override
  Widget build(BuildContext context) {
    final session = SessionScope.of(context);
    final settings = PublicScope.of(context).settings;
    final p = session.profile;
    void push(Widget page) => Navigator.push(context, MaterialPageRoute(builder: (_) => page));

    return Scaffold(
      appBar: PageHeader.bar('حسابي'),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 30), children: [
        if (p == null)
          AppCard(
            child: Column(children: [
              const Icon(Icons.account_circle_outlined, size: 64, color: Brand.primary),
              const SizedBox(height: 8),
              const Text('سجّل دخولك لإدارة حسابك وعناوينك وطلباتك', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 14),
              FilledButton(onPressed: () => ensureSignedIn(context), child: const Text('تسجيل الدخول / حساب جديد')),
            ]),
          )
        else ...[
          AppCard(
            child: Row(children: [
              CircleAvatar(
                radius: 30,
                backgroundColor: Brand.primary,
                child: Text(p.fullName.characters.first, style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800)),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(p.fullName, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
                  if (p.memberNo != null)
                    Text('رقم العضوية #${p.memberNo}', textDirection: TextDirection.rtl, style: const TextStyle(fontSize: 12, color: Brand.mutedFg, fontWeight: FontWeight.w700)),
                  if (p.email != null) Text(p.email!, textDirection: TextDirection.ltr, style: const TextStyle(color: Brand.mutedFg, fontSize: 12.5)),
                  if (p.phone != null) Text(p.phone!, textDirection: TextDirection.ltr, style: const TextStyle(color: Brand.mutedFg, fontSize: 12.5)),
                ]),
              ),
              IconButton(onPressed: () => push(const ProfileEditPage()), icon: const Icon(Icons.edit_outlined, color: Brand.primary)),
            ]),
          ),
          if (p.referralCode != null) ...[
            const SizedBox(height: 10),
            AppCard(
              color: Brand.accent,
              child: Row(children: [
                const Icon(Icons.card_giftcard_outlined, color: Brand.accentFg),
                const SizedBox(width: 10),
                const Expanded(child: Text('رمز الإحالة', style: TextStyle(fontWeight: FontWeight.w700, color: Brand.accentFg))),
                SelectableText(p.referralCode!, style: const TextStyle(fontWeight: FontWeight.w800, letterSpacing: 1.5)),
                IconButton(
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: p.referralCode!));
                    showSnack(context, 'تم نسخ رمز الإحالة');
                  },
                  icon: const Icon(Icons.copy_outlined, size: 20, color: Brand.accentFg),
                ),
              ]),
            ),
          ],
          const SizedBox(height: 16),
          MenuGroup(children: [
            MenuTile(icon: Icons.place_outlined, title: 'عناويني', subtitle: 'العناوين المحفوظة للطلبات الحضورية', onTap: () => push(const AddressesPage())),
            MenuTile(
              icon: Icons.notifications_outlined,
              title: 'الإشعارات',
              onTap: () {
                OrdersScope.read(context).markNotificationsSeen();
                push(const NotificationsPage());
              },
            ),
            MenuTile(icon: Icons.support_agent_outlined, title: 'الرسائل مع الإدارة', onTap: () => push(const SupportMessagesPage())),
          ]),
        ],
        const SizedBox(height: 16),
        MenuGroup(children: [
          MenuTile(icon: Icons.policy_outlined, title: 'السياسات والشروط', onTap: () => push(const PoliciesPage(audience: 'customers', placement: 'account'))),
          MenuTile(icon: Icons.help_outline, title: 'كيف تعمل مهمة؟', subtitle: 'خطوات الطلب بشكل مختصر', onTap: () => push(const HowItWorksPage())),
          MenuTile(icon: Icons.info_outlined, title: 'عن مهمة', onTap: () => push(const _AboutPage())),
          if (settings.supportPhone != null || settings.supportEmail != null)
            MenuTile(
              icon: Icons.call_outlined,
              title: 'اتصل بنا',
              subtitle: settings.supportPhone ?? settings.supportEmail,
              onTap: () => settings.supportPhone != null ? callPhone(context, settings.supportPhone!) : openUrl(context, 'mailto:${settings.supportEmail}'),
            ),
          MenuTile(
            icon: Icons.engineering_outlined,
            title: 'هل لديك مهارة أو خبرة؟',
            subtitle: 'سجّل في تطبيق «مهمة شريك» وابدأ استقبال الطلبات',
            color: Brand.accentFg,
            onTap: () => push(const _JoinProvidersPage()),
          ),
        ]),
        if (p != null) ...[
          const SizedBox(height: 16),
          MenuGroup(children: [
            MenuTile(icon: Icons.lock_outlined, title: 'تغيير كلمة المرور', onTap: () => push(const ChangePasswordPage())),
            MenuTile(icon: Icons.logout_outlined, title: 'تسجيل خروج', onTap: () => signOutFlow(context)),
            MenuTile(icon: Icons.delete_forever_outlined, title: 'حذف الحساب', color: Brand.danger, onTap: () => deleteAccountFlow(context)),
          ]),
        ],
        const SizedBox(height: 20),
        const Center(child: Text('مهمة • الإصدار 1.0.0', style: TextStyle(color: Brand.mutedFg, fontSize: 12))),
      ]),
    );
  }
}

class _AboutPage extends StatelessWidget {
  const _AboutPage();
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('عن مهمة')),
        body: ListView(padding: const EdgeInsets.all(20), children: [
          Center(
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(gradient: Brand.gradient, borderRadius: BorderRadius.circular(28)),
              child: const AppLogo(height: 70),
            ),
          ),
          const SizedBox(height: 18),
          const Text('مهمة', textAlign: TextAlign.center, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          const Text(
            'منصة رقمية تربط الأفراد الباحثين عن خدمات يومية بمقدمي الخدمات المحترفين، بطريقة سريعة وسهلة تعتمد على الموقع والاحتياج الفعلي.',
            textAlign: TextAlign.center,
            style: TextStyle(height: 1.8),
          ),
          const SizedBox(height: 14),
          const Text(
            'تختار نوع الخدمة وتحدد إن كانت حضورية أو عن بُعد، ثم يصل طلبك لمقدمي الخدمة في مدينتك، وتتابع التنفيذ حتى اكتماله.',
            textAlign: TextAlign.center,
            style: TextStyle(height: 1.8, color: Brand.mutedFg),
          ),
        ]),
      );
}

class _JoinProvidersPage extends StatelessWidget {
  const _JoinProvidersPage();
  @override
  Widget build(BuildContext context) {
    final s = PublicScope.of(context).settings;
    return Scaffold(
      appBar: AppBar(title: const Text('انضم كمقدم خدمة')),
      body: ListView(padding: const EdgeInsets.all(20), children: [
        const Icon(Icons.engineering_outlined, size: 72, color: Brand.primary),
        const SizedBox(height: 14),
        const Text('هل لديك مهارة أو خبرة؟', textAlign: TextAlign.center, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        const Text(
          'حمّل تطبيق «مهمة شريك»، سجّل بياناتك وأرفق هويتك وشهادتك، وابدأ استقبال الطلبات بعد موافقة الإدارة.',
          textAlign: TextAlign.center,
          style: TextStyle(height: 1.8),
        ),
        const SizedBox(height: 22),
        AppDownloadButtons(ios: s.providerIosUrl, android: s.providerAndroidUrl, other: s.providerOtherUrl),
      ]),
    );
  }
}

/// Short explanation of how ordering works (opened from «حسابي»).
class HowItWorksPage extends StatelessWidget {
  const HowItWorksPage({super.key});

  @override
  Widget build(BuildContext context) {
    const steps = [
      (Icons.touch_app_outlined, 'اختر الخدمة', 'حدد المهمة وهل هي حضورية أو عن بُعد'),
      (Icons.campaign_outlined, 'يصل طلبك', 'لمقدمي الخدمة في مدينتك فوراً'),
      (Icons.handshake_outlined, 'تابع التنفيذ', 'راسل مقدم الخدمة وقيّمه بعد الإنجاز'),
    ];
    return Scaffold(
      appBar: PageHeader.bar('كيف تعمل مهمة؟'),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 24), children: [
    AppCard(
      color: Brand.accent,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        for (final s in steps)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 5),
            child: Row(children: [
              Icon(s.$1, color: Brand.accentFg),
              const SizedBox(width: 10),
              Expanded(
                child: Text.rich(TextSpan(children: [
                  TextSpan(text: '${s.$2}: ', style: const TextStyle(fontWeight: FontWeight.w800)),
                  TextSpan(text: s.$3),
                ]), style: const TextStyle(fontSize: 13, color: Brand.foreground)),
              ),
            ]),
          ),
        const SizedBox(height: 4),
        const Text('لا يأخذ التطبيق أي رسوم من طالب الخدمة، وتتفق مع مقدم الخدمة على قيمة التنفيذ.', style: TextStyle(fontSize: 12, color: Brand.mutedFg)),
      ]),
    ),
      ]),
    );
  }
}
