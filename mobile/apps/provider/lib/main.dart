import 'package:flutter/material.dart';
import 'package:mohemah_core/mohemah_core.dart';

import 'provider_store.dart';
import 'screens/gate.dart';

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
  ));
}
