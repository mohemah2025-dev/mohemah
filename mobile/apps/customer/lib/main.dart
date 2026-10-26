import 'package:flutter/material.dart';
import 'package:mohemah_core/mohemah_core.dart';

import 'orders_store.dart';
import 'screens/auth_page.dart';
import 'screens/order_detail_page.dart';
import 'screens/shell.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(MohemahApp(
    kind: AppKind.customer,
    title: 'مهمة',
    subtitle: 'كل مهامك اليومية بضغطة واحدة',
    palette: SplashPalette.customer,
    scope: (context, child) => CustomerScope(child: child),
    home: (_) => const CustomerGate(child: CustomerShell()),
    onPushMessage: (_) {
      OrdersStore.instance?.refresh(background: true);
      return false;
    },
    onPushOpen: (data) async {
      await OrdersStore.instance?.refresh(background: true);
      final id = Push.orderIdOf(data);
      if (id != null) {
        CustomerShell.goTo(2);
        rootNavigator.currentState?.push(MaterialPageRoute(builder: (_) => OrderDetailPage(orderId: id)));
      } else if ((data['link'] ?? '').toString().startsWith('/orders')) {
        CustomerShell.goTo(2);
      } else {
        rootNavigator.currentState?.push(MaterialPageRoute(builder: (_) => const NotificationsPage()));
      }
    },
  ));
}
