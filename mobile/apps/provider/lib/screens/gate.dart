import 'package:flutter/material.dart' hide Text;
import 'package:mohemah_core/mohemah_core.dart';

import 'application_page.dart';
import 'auth_page.dart';
import 'shell.dart';

/// Routes the provider app: sign-in → application status (until approved) → main tabs.
class ProviderGate extends StatelessWidget {
  const ProviderGate({super.key});

  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    if (!s.signedIn) return const ProviderAuthPage();
    if (!s.isProvider) return const ApplicationPage();
    return const ProviderShell();
  }
}
