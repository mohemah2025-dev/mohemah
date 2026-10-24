import 'package:flutter/material.dart';
import 'package:mohemah_core/mohemah_core.dart';

import 'orders_store.dart';
import 'screens/shell.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(MohemahApp(
    kind: AppKind.customer,
    title: 'مهمة',
    subtitle: 'كل مهامك اليومية بضغطة واحدة',
    palette: SplashPalette.customer,
    scope: (context, child) => CustomerScope(child: child),
    home: (_) => const CustomerShell(),
  ));
}
