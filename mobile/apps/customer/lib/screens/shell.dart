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
        bottomNavigationBar: NavigationBar(
          selectedIndex: index,
          onDestinationSelected: (i) => CustomerShell.tab.value = i,
          destinations: [
            const NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home_rounded), label: 'الرئيسية'),
            const NavigationDestination(icon: Icon(Icons.grid_view_outlined), selectedIcon: Icon(Icons.grid_view_rounded), label: 'الخدمات'),
            NavigationDestination(
              icon: Badge(isLabelVisible: openCount > 0, label: Text('$openCount'), child: const Icon(Icons.receipt_long_outlined)),
              selectedIcon: Badge(isLabelVisible: openCount > 0, label: Text('$openCount'), child: const Icon(Icons.receipt_long_rounded)),
              label: 'طلباتي',
            ),
            const NavigationDestination(icon: Icon(Icons.person_outline_rounded), selectedIcon: Icon(Icons.person_rounded), label: 'حسابي'),
          ],
        ),
      ),
    );
  }
}
