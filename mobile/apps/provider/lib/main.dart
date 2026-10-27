import 'package:flutter/material.dart';
import 'package:mohemah_core/mohemah_core.dart';

import 'provider_store.dart';
import 'screens/gate.dart';
import 'screens/orders_tab.dart';
import 'screens/shell.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(MohemahApp(
    kind: AppKind.provider,
    title: 'مهمة شريك',
    subtitle: 'استقبل الطلبات وابدأ العمل',
    palette: SplashPalette.provider,
    seed: Brand.primaryDeep,
    scope: (context, child) => ProviderStoreHost(child: child),
    home: (_) => const ProviderGate(),
    onPushMessage: (data) {
      final store = ProviderStore.instance;
      store?.refresh(background: true);
      // A new order opens the incoming-order card by itself; no extra banner.
      return Push.orderIdOf(data) != null && data['chat'] == null && store?.session.isProvider == true;
    },
    onPushOpen: (data) async {
      // Replies from the administration open the conversation (also before the account is approved).
      if ((data['link'] ?? '').toString().startsWith('/support')) {
        rootNavigator.currentState?.push(MaterialPageRoute(builder: (_) => const SupportMessagesPage()));
        return;
      }
      final store = ProviderStore.instance;
      if (store == null || !store.session.isProvider) return;
      await store.refresh(background: true);
      final id = Push.orderIdOf(data);
      final active = store.feed?.active.any((j) => j.id == id) ?? false;
      if (id != null && active) {
        ProviderShell.goTo(1, section: 1);
        rootNavigator.currentState?.push(MaterialPageRoute(builder: (_) => JobDetailPage(jobId: id)));
      } else if ((data['link'] ?? '').toString().startsWith('/provider/orders')) {
        ProviderShell.goTo(1, section: 0);
      } else {
        rootNavigator.currentState?.push(MaterialPageRoute(builder: (_) => const NotificationsPage()));
      }
    },
  ));
}
