import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mohemah_core/mohemah_core.dart';

import '../orders_store.dart';
import 'account_tab.dart';
import 'home_tab.dart';
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
        // With push enabled the notification itself announces the change.
        if (Push.configured) return;
        HapticFeedback.mediumImpact();
        SystemSound.play(SystemSoundType.alert);
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

  @override
  Widget build(BuildContext context) {
    final openCount = OrdersScope.of(context).open.length;
    return ValueListenableBuilder<int>(
      valueListenable: CustomerShell.tab,
      builder: (context, index, _) => Scaffold(
        body: IndexedStack(index: index, children: const [HomeTab(), ServicesTab(), OrdersTab(), AccountTab()]),
        // Five slots: the middle one is the (+) "request a service" button.
        bottomNavigationBar: NavigationBar(
          selectedIndex: index >= 2 ? index + 1 : index,
          onDestinationSelected: (i) {
            if (i == 2) {
              showRequestSheet(context);
              return;
            }
            CustomerShell.tab.value = i > 2 ? i - 1 : i;
          },
          destinations: [
            const NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'الرئيسية'),
            const NavigationDestination(icon: Icon(Icons.grid_view_outlined), selectedIcon: Icon(Icons.grid_view), label: 'الخدمات'),
            NavigationDestination(
              icon: Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  gradient: Brand.gradient,
                  shape: BoxShape.circle,
                  boxShadow: [BoxShadow(color: Brand.primary.withValues(alpha: 0.35), blurRadius: 12, offset: const Offset(0, 5))],
                ),
                child: const Icon(Icons.add, color: Colors.white, size: 30),
              ),
              label: 'اطلب خدمة',
            ),
            NavigationDestination(
              icon: Badge(isLabelVisible: openCount > 0, label: Text('$openCount'), child: const Icon(Icons.receipt_long_outlined)),
              selectedIcon: Badge(isLabelVisible: openCount > 0, label: Text('$openCount'), child: const Icon(Icons.receipt_long)),
              label: 'طلباتي',
            ),
            const NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'حسابي'),
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
