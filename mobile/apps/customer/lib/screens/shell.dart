import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mohemah_core/mohemah_core.dart';

import '../orders_store.dart';
import 'account_tab.dart';
import 'home_tab.dart';
import 'order_detail_page.dart';
import 'orders_tab.dart';
import 'services_tab.dart';

/// Bottom tabs of the customer app.
class CustomerShell extends StatefulWidget {
  const CustomerShell({super.key});

  static final ValueNotifier<int> tab = ValueNotifier<int>(0);

  /// Closes pushed pages and switches tab (0 home, 1 services, 2 orders, 3 account).
  static void goTo(int index) {
    rootNavigator.currentState?.popUntil((r) => r.isFirst);
    tab.value = index;
  }

  @override
  State<CustomerShell> createState() => _CustomerShellState();
}

class _CustomerShellState extends State<CustomerShell> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      OrdersScope.read(context).onStatusChange = (o) {
        HapticFeedback.mediumImpact();
        SystemSound.play(SystemSoundType.alert);
        // Acceptance is the moment the customer waits for: announce it clearly on screen.
        if (o.status == 'accepted') {
          _showAccepted(o);
          return;
        }
        final msg = switch (o.status) {
          'accepted' => 'تم قبول طلبك «${o.title}»',
          'arrived' => 'وصل مقدم الخدمة لطلب «${o.title}»',
          'in_progress' => 'بدأ تنفيذ طلبك «${o.title}»',
          'completed' => 'اكتمل طلبك «${o.title}»، قيّم الخدمة',
          'pending' => 'اعتذر مقدم الخدمة، طلبك متاح لمقدمي الخدمة الآخرين',
          _ => 'تحديث على طلبك «${o.title}»',
        };
        rootMessenger.currentState?.showSnackBar(SnackBar(content: Text(msg)));
      };
    });
  }

  void _showAccepted(CustomerOrder o) {
    final nav = rootNavigator.currentContext;
    if (nav == null) return;
    showDialog<void>(
      context: nav,
      builder: (ctx) => Dialog(
        insetPadding: const EdgeInsets.all(24),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
        clipBehavior: Clip.antiAlias,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(20, 26, 20, 22),
            decoration: const BoxDecoration(gradient: Brand.gradient),
            child: Column(children: [
              Container(
                width: 76,
                height: 76,
                decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                child: const Icon(Icons.check_rounded, color: Brand.success, size: 48),
              ),
              const SizedBox(height: 12),
              const Text('تم قبول طلبك', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800)),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 8),
            child: Column(children: [
              Text('«${o.title}»', textAlign: TextAlign.center, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
              const SizedBox(height: 6),
              Text(
                o.providerName != null ? 'قبل ${o.providerName} طلبك، ويمكنك متابعته ومراسلته من صفحة الطلب.' : 'قبل مقدم الخدمة طلبك، ويمكنك متابعته ومراسلته من صفحة الطلب.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Brand.mutedFg, height: 1.6),
              ),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            child: Row(children: [
              Expanded(child: TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('لاحقاً'))),
              const SizedBox(width: 8),
              Expanded(
                flex: 2,
                child: FilledButton(
                  onPressed: () {
                    Navigator.pop(ctx);
                    CustomerShell.goTo(2);
                    rootNavigator.currentState?.push(MaterialPageRoute(builder: (_) => OrderDetailPage(orderId: o.id)));
                  },
                  child: const Text('عرض الطلب'),
                ),
              ),
            ]),
          ),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final openCount = OrdersScope.of(context).open.length;
    return ValueListenableBuilder<int>(
      valueListenable: CustomerShell.tab,
      builder: (context, index, _) => Scaffold(
        body: IndexedStack(index: index, children: const [HomeTab(), ServicesTab(), OrdersTab(), AccountTab()]),
        // Five slots: the middle one is the (+) "request a service" button.
        bottomNavigationBar: MohemahNavBar(
          index: index >= 2 ? index + 1 : index,
          onTap: (i) {
            if (i == 2) {
              showRequestSheet(context);
              return;
            }
            CustomerShell.tab.value = i > 2 ? i - 1 : i;
          },
          items: [
            const NavItem(icon: Icons.home_outlined, activeIcon: Icons.home_rounded, label: 'الرئيسية'),
            const NavItem(icon: Icons.grid_view_outlined, activeIcon: Icons.grid_view_rounded, label: 'الخدمات'),
            const NavItem(icon: Icons.add_rounded, activeIcon: Icons.add_rounded, label: 'اطلب خدمة', action: true),
            NavItem(icon: Icons.receipt_long_outlined, activeIcon: Icons.receipt_long_rounded, label: 'طلباتي', badge: openCount),
            const NavItem(icon: Icons.person_outline, activeIcon: Icons.person_rounded, label: 'حسابي'),
          ],
        ),
      ),
    );
  }
}

/// Quick "request a service" sheet opened from the (+) button: pick a main service.
void showRequestSheet(BuildContext context) {
  final services = PublicScope.of(context).services;
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (ctx) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('ماذا تحتاج اليوم؟', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          const Text('اختر الخدمة الرئيسية ثم المهمة المطلوبة', style: TextStyle(color: Brand.mutedFg, fontSize: 12.5)),
          const SizedBox(height: 14),
          if (services.isEmpty)
            const EmptyState(icon: Icons.design_services_outlined, title: 'لا توجد خدمات متاحة حالياً')
          else
            Flexible(
              child: GridView.count(
                crossAxisCount: 3,
                shrinkWrap: true,
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 0.95,
                children: [
                  for (final s in services)
                    ServiceBox(
                      service: s,
                      onTap: () {
                        Navigator.pop(ctx);
                        Navigator.push(context, MaterialPageRoute(builder: (_) => ServiceDetailPage(service: s)));
                      },
                    ),
                ],
              ),
            ),
        ]),
      ),
    ),
  );
}
