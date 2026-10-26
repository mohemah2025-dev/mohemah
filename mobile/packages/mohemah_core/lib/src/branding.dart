import 'package:flutter/material.dart';

import 'config.dart';
import 'public_data.dart';
import 'theme.dart';
import 'widgets.dart';

/// The app logo: the one uploaded in the admin panel (Settings → «شعار التطبيقات») when set, otherwise the bundled logo.
/// Changing the logo in the admin panel is reflected in both apps on the next data refresh.
class AppLogo extends StatelessWidget {
  const AppLogo({super.key, this.height, this.width, this.fit = BoxFit.contain});
  final double? height;
  final double? width;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<PublicScope>();
    final url = scope?.notifier?.settings.appLogoUrl;
    final fallback = Image.asset('assets/logo.png', package: 'mohemah_core', height: height, width: width, fit: fit);
    if (url == null || url.isEmpty) return fallback;
    return Image.network(absUrl(url), height: height, width: width, fit: fit, errorBuilder: (_, __, ___) => fallback);
  }
}

/// Store buttons (App Store / Google Play / other) for the links set in the admin panel; links left empty are hidden.
class AppDownloadButtons extends StatelessWidget {
  const AppDownloadButtons({super.key, this.ios, this.android, this.other});
  final String? ios;
  final String? android;
  final String? other;

  bool get hasAny => [ios, android, other].any((x) => (x ?? '').isNotEmpty);

  @override
  Widget build(BuildContext context) {
    final items = <(IconData, String, String)>[
      if ((ios ?? '').isNotEmpty) (Icons.apple, 'آيفون', ios!),
      if ((android ?? '').isNotEmpty) (Icons.android, 'أندرويد', android!),
      if ((other ?? '').isNotEmpty) (Icons.download_rounded, 'رابط آخر', other!),
    ];
    if (items.isEmpty) {
      return const Text('روابط التحميل ستتوفر قريباً', textAlign: TextAlign.center, style: TextStyle(color: Brand.mutedFg, fontSize: 12.5));
    }
    return Wrap(alignment: WrapAlignment.center, spacing: 8, runSpacing: 8, children: [
      for (final it in items)
        FilledButton.icon(
          onPressed: () => openUrl(context, it.$3),
          style: FilledButton.styleFrom(backgroundColor: Brand.foreground, padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10)),
          icon: Icon(it.$1, size: 20),
          label: Text(it.$2),
        ),
    ]);
  }
}
