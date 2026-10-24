import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mohemah_core/mohemah_core.dart';

import '../provider_store.dart';
import 'billing_page.dart';
import 'home_tab.dart';

class ProviderAccountTab extends StatelessWidget {
  const ProviderAccountTab({super.key});

  @override
  Widget build(BuildContext context) {
    final session = SessionScope.of(context);
    final store = ProviderScope.of(context);
    final p = session.profile!;
    final stats = store.stats;
    final tier = loyaltyTiers[currentTierIndex(stats?.completed ?? 0, stats?.rating ?? 0)];
    void push(Widget page) => Navigator.push(context, MaterialPageRoute(builder: (_) => page));

    return Scaffold(
      appBar: AppBar(title: const Text('حسابي')),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 30), children: [
        AppCard(
          child: Row(children: [
            GestureDetector(
              onTap: () => _changePhoto(context),
              child: Stack(clipBehavior: Clip.none, children: [
                Avatar(name: p.fullName, url: p.avatarUrl, radius: 32, color: Brand.primaryDeep, onLight: false),
                const Positioned(
                  bottom: -2,
                  left: -2,
                  child: CircleAvatar(radius: 12, backgroundColor: Colors.white, child: Icon(Icons.photo_camera_rounded, size: 15, color: Brand.primaryDeep)),
                ),
              ]),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(p.fullName, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
                const SizedBox(height: 2),
                Row(children: [
                  Stars(value: p.rating, size: 15),
                  const SizedBox(width: 4),
                  Text('${p.rating.toStringAsFixed(1)} (${p.ratingCount})', style: const TextStyle(fontSize: 12, color: Brand.mutedFg)),
                ]),
                const SizedBox(height: 4),
                Pill('مستوى ${tier.name}', icon: tierIcon(loyaltyTiers.indexOf(tier)), color: Brand.coral, background: const Color(0xFFFDECEA)),
              ]),
            ),
            IconButton(onPressed: () => push(const ProfileEditPage(showBio: true)), icon: const Icon(Icons.edit_rounded, color: Brand.primaryDeep)),
          ]),
        ),
        const SizedBox(height: 16),
        MenuGroup(children: [
          MenuTile(
            icon: Icons.account_balance_wallet_rounded,
            title: 'الرصيد والاشتراك',
            subtitle: session.hasActiveSubscription ? 'اشتراك فعّال حتى ${fmtDate(session.subscriptionEnd)}' : '${store.feed?.balance ?? p.coinBalance} كوين',
            onTap: () => push(const BillingPage()),
          ),
          MenuTile(icon: Icons.receipt_long_rounded, title: 'سجل العمليات', onTap: () => push(const TransactionsPage())),
          MenuTile(icon: Icons.star_rounded, title: 'تقييماتي', onTap: () => push(const RatingsPage())),
        ]),
        const SizedBox(height: 16),
        MenuGroup(children: [
          MenuTile(icon: Icons.notifications_rounded, title: 'الإشعارات', onTap: () => push(const NotificationsPage())),
          MenuTile(icon: Icons.policy_rounded, title: 'شروط مقدمي الخدمة', onTap: () => push(const PoliciesPage(audience: 'providers'))),
        ]),
        const SizedBox(height: 16),
        MenuGroup(children: [
          MenuTile(icon: Icons.lock_rounded, title: 'تغيير كلمة المرور', onTap: () => push(const ChangePasswordPage())),
          MenuTile(
            icon: Icons.logout_rounded,
            title: 'تسجيل خروج',
            onTap: () async {
              if (store.feed?.online == true) {
                try {
                  await store.setOnline(false);
                } catch (_) {}
              }
              if (context.mounted) await signOutFlow(context);
            },
          ),
          MenuTile(icon: Icons.delete_forever_rounded, title: 'حذف الحساب', color: Brand.danger, onTap: () => deleteAccountFlow(context)),
        ]),
        const SizedBox(height: 20),
        const Center(child: Text('مهمة شريك • الإصدار 1.0.0', style: TextStyle(color: Brand.mutedFg, fontSize: 12))),
      ]),
    );
  }
}

/// Picks a photo (camera or gallery, compressed on the device) and uploads it as the profile photo.
Future<void> _changePhoto(BuildContext context) async {
  final source = await showModalBottomSheet<ImageSource>(
    context: context,
    builder: (c) => SafeArea(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Text('الصورة الشخصية', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
        ListTile(leading: const Icon(Icons.photo_camera_rounded), title: const Text('التقاط صورة'), onTap: () => Navigator.pop(c, ImageSource.camera)),
        ListTile(leading: const Icon(Icons.photo_library_rounded), title: const Text('اختيار من الصور'), onTap: () => Navigator.pop(c, ImageSource.gallery)),
        const SizedBox(height: 8),
      ]),
    ),
  );
  if (source == null || !context.mounted) return;
  final s = SessionScope.read(context);
  try {
    final x = await ImagePicker().pickImage(source: source, maxWidth: 800, maxHeight: 800, imageQuality: 85, preferredCameraDevice: CameraDevice.front);
    if (x == null) return;
    final bytes = await x.readAsBytes();
    final png = x.name.toLowerCase().endsWith('.png');
    s.applyMe(await s.api.multipart('/api/me/avatar', const {}, [
      UploadFile(field: 'file', filename: png ? 'avatar.png' : 'avatar.jpg', bytes: bytes, contentType: png ? 'image/png' : 'image/jpeg'),
    ]));
    if (context.mounted) showSnack(context, 'تم تحديث صورتك');
  } catch (e) {
    if (context.mounted) showError(context, e);
  }
}

class MyServicesPage extends StatelessWidget {
  const MyServicesPage({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('خدماتي')),
        body: ListView(padding: const EdgeInsets.all(16), children: const [MyServicesPanel()]),
      );
}

class RatingsPage extends StatefulWidget {
  const RatingsPage({super.key});
  @override
  State<RatingsPage> createState() => _RatingsPageState();
}

class _RatingsPageState extends State<RatingsPage> {
  List<Map<String, dynamic>>? _items;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = jList(await ProviderScope.read(context).api.get('/api/provider/ratings'));
      if (mounted) setState(() => _items = list);
    } catch (e) {
      if (mounted) setState(() => _error = errMsg(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = _items;
    return Scaffold(
      appBar: AppBar(title: const Text('تقييماتي')),
      body: _error != null && items == null
          ? ErrorRetry(message: _error!, onRetry: _load)
          : items == null
              ? const Loading()
              : items.isEmpty
                  ? const EmptyState(icon: Icons.star_outline_rounded, title: 'لا توجد تقييمات بعد', message: 'تظهر هنا تقييمات العملاء بعد إكمال الطلبات.')
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: items.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (_, i) {
                        final r = items[i];
                        return AppCard(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Row(children: [
                              Stars(value: jDouble(r['rating']), size: 18),
                              const Spacer(),
                              Text(fmtDate(jDate(r['created_at'])), style: const TextStyle(color: Brand.mutedFg, fontSize: 12)),
                            ]),
                            if (jStr(r['review'])?.isNotEmpty == true) Padding(padding: const EdgeInsets.only(top: 6), child: Text(jS(r['review']), style: const TextStyle(height: 1.5))),
                          ]),
                        );
                      },
                    ),
    );
  }
}

class TransactionsPage extends StatefulWidget {
  const TransactionsPage({super.key});
  @override
  State<TransactionsPage> createState() => _TransactionsPageState();
}

class _TransactionsPageState extends State<TransactionsPage> {
  List<CoinTx>? _items;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = jList(await ProviderScope.read(context).api.get('/api/provider/transactions')).map(CoinTx.new).toList();
      if (mounted) setState(() => _items = list);
    } catch (e) {
      if (mounted) setState(() => _error = errMsg(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = _items;
    return Scaffold(
      appBar: AppBar(title: const Text('سجل العمليات')),
      body: _error != null && items == null
          ? ErrorRetry(message: _error!, onRetry: _load)
          : items == null
              ? const Loading()
              : items.isEmpty
                  ? const EmptyState(icon: Icons.receipt_long_outlined, title: 'لا توجد عمليات بعد')
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: items.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (_, i) {
                        final t = items[i];
                        final c = t.isDebit ? Brand.danger : Brand.success;
                        return AppCard(
                          padding: const EdgeInsets.all(12),
                          child: Row(children: [
                            CircleAvatar(
                              radius: 20,
                              backgroundColor: c.withValues(alpha: 0.12),
                              child: Icon(t.isDebit ? Icons.south_west_rounded : Icons.north_east_rounded, color: c, size: 20),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text(t.description, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                                Text('${fmtDateTime(t.createdAt)}${t.method != null ? ' • ${t.method}' : ''}', style: const TextStyle(color: Brand.mutedFg, fontSize: 11.5)),
                              ]),
                            ),
                            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                              Text('${t.isDebit ? '-' : '+'}${t.amount}', textDirection: TextDirection.ltr, style: TextStyle(color: c, fontWeight: FontWeight.w800, fontSize: 15)),
                              Text('الرصيد ${t.balanceAfter}', style: const TextStyle(color: Brand.mutedFg, fontSize: 11)),
                            ]),
                          ]),
                        );
                      },
                    ),
    );
  }
}
