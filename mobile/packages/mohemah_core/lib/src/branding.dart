import 'package:flutter/material.dart';

import 'config.dart';
import 'public_data.dart';

/// The app logo: the one uploaded in the admin panel (Settings → logo) when set, otherwise the bundled logo.
/// Changing the logo in the admin panel is reflected in both apps on the next data refresh.
class AppLogo extends StatelessWidget {
  const AppLogo({super.key, this.height, this.width, this.fit = BoxFit.contain});
  final double? height;
  final double? width;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<PublicScope>();
    final url = scope?.notifier?.settings.logoUrl;
    final fallback = Image.asset('assets/logo.png', package: 'mohemah_core', height: height, width: width, fit: fit);
    if (url == null || url.isEmpty) return fallback;
    return Image.network(absUrl(url), height: height, width: width, fit: fit, errorBuilder: (_, __, ___) => fallback);
  }
}
