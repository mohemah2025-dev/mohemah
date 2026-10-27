import 'package:flutter/material.dart' hide Text;

import 'i18n.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'app_root.dart';
import 'config.dart';
import 'format.dart';
import 'models.dart';
import 'theme.dart';

void showSnack(BuildContext context, String message, {bool error = false}) {
  final m = ScaffoldMessenger.maybeOf(context) ?? rootMessenger.currentState;
  if (m == null) return;
  m.hideCurrentSnackBar();
  m.showSnackBar(SnackBar(
    content: Row(children: [
      Icon(error ? Icons.error_outline : Icons.check_circle_outline, color: Colors.white, size: 22),
      const SizedBox(width: 10),
      Expanded(child: Text(message, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700, height: 1.4))),
    ]),
    backgroundColor: error ? Brand.danger : Brand.primaryDeep,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    duration: Duration(milliseconds: error ? 3800 : 2600),
  ));
}

void showError(BuildContext context, Object e) => showSnack(context, errMsg(e), error: true);

Future<bool> confirm(BuildContext context, {required String title, String? message, String ok = 'تأكيد', bool danger = false}) async {
  final r = await showDialog<bool>(
    context: context,
    builder: (c) => AlertDialog(
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
      content: message == null ? null : Text(message),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')),
        FilledButton(
          style: FilledButton.styleFrom(minimumSize: const Size(96, 44), backgroundColor: danger ? Brand.danger : null),
          onPressed: () => Navigator.pop(c, true),
          child: Text(ok),
        ),
      ],
    ),
  );
  return r ?? false;
}

/// Asks for a short text (cancel reason, password confirmation...).
Future<String?> promptText(BuildContext context,
    {required String title, String? hint, String ok = 'تأكيد', bool obscure = false, bool required = false, bool danger = false}) async {
  final ctrl = TextEditingController();
  final r = await showDialog<String>(
    context: context,
    builder: (c) => AlertDialog(
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
      content: TextField(controller: ctrl, obscureText: obscure, autofocus: true, maxLines: obscure ? 1 : 3, minLines: 1, decoration: InputDecoration(hintText: hint)),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c), child: const Text('إلغاء')),
        FilledButton(
          style: FilledButton.styleFrom(minimumSize: const Size(96, 44), backgroundColor: danger ? Brand.danger : null),
          onPressed: () {
            if (required && ctrl.text.trim().isEmpty) return;
            Navigator.pop(c, ctrl.text.trim());
          },
          child: Text(ok),
        ),
      ],
    ),
  );
  return r;
}

Future<void> openUrl(BuildContext context, String url) async {
  final ok = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  if (!ok && context.mounted) showSnack(context, 'تعذّر فتح الرابط', error: true);
}

Future<void> callPhone(BuildContext context, String phone) => openUrl(context, 'tel:$phone');

String mapsUrl({double? lat, double? lng, String? address}) {
  if (lat != null && lng != null) return 'https://www.google.com/maps/search/?api=1&query=$lat,$lng';
  return 'https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(address ?? '')}';
}

/// Rounded white card with the brand border.
class AppCard extends StatelessWidget {
  const AppCard({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.onTap, this.color, this.radius = 20});
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color? color;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final r = BorderRadius.circular(radius);
    return Material(
      color: color ?? Colors.white,
      shape: RoundedRectangleBorder(borderRadius: r, side: const BorderSide(color: Brand.border)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(onTap: onTap, child: Padding(padding: padding, child: child)),
    );
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.trailing, this.padding = const EdgeInsets.fromLTRB(4, 18, 4, 10)});
  final String text;
  final Widget? trailing;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) => Padding(
        padding: padding,
        child: Row(children: [
          Expanded(child: Text(text, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800))),
          if (trailing != null) trailing!,
        ]),
      );
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.title, this.message, this.action});
  final IconData icon;
  final String title;
  final String? message;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 40),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 72,
            height: 72,
            decoration: const BoxDecoration(color: Brand.muted, shape: BoxShape.circle),
            child: Icon(icon, size: 34, color: Brand.mutedFg),
          ),
          const SizedBox(height: 14),
          Text(title, textAlign: TextAlign.center, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          if (message != null) ...[
            const SizedBox(height: 6),
            Text(message!, textAlign: TextAlign.center, style: const TextStyle(color: Brand.mutedFg, height: 1.5)),
          ],
          if (action != null) ...[const SizedBox(height: 16), action!],
        ]),
      );
}

class ErrorRetry extends StatelessWidget {
  const ErrorRetry({super.key, required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => EmptyState(
        icon: Icons.wifi_off_outlined,
        title: 'تعذّر التحميل',
        message: message,
        action: OutlinedButton.icon(
          style: OutlinedButton.styleFrom(minimumSize: const Size(140, 44)),
          onPressed: onRetry,
          icon: const Icon(Icons.refresh_outlined),
          label: const Text('إعادة المحاولة'),
        ),
      );
}

class Loading extends StatelessWidget {
  const Loading({super.key});
  @override
  Widget build(BuildContext context) => const Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator()));
}

/// Filled button that shows a spinner while [onPressed] runs.
class BusyButton extends StatefulWidget {
  const BusyButton({super.key, required this.label, required this.onPressed, this.icon, this.color, this.outlined = false});
  final String label;
  final Future<void> Function()? onPressed;
  final IconData? icon;
  final Color? color;
  final bool outlined;

  @override
  State<BusyButton> createState() => _BusyButtonState();
}

class _BusyButtonState extends State<BusyButton> {
  bool _busy = false;

  Future<void> _tap() async {
    if (_busy || widget.onPressed == null) return;
    setState(() => _busy = true);
    try {
      await widget.onPressed!();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final child = _busy
        ? SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4, color: widget.outlined ? Brand.primary : Colors.white))
        : Row(mainAxisSize: MainAxisSize.min, children: [
            if (widget.icon != null) ...[Icon(widget.icon, size: 20), const SizedBox(width: 8)],
            Flexible(child: Text(widget.label, overflow: TextOverflow.ellipsis)),
          ]);
    final enabled = widget.onPressed != null && !_busy;
    if (widget.outlined) {
      return OutlinedButton(
        style: OutlinedButton.styleFrom(foregroundColor: widget.color),
        onPressed: enabled ? _tap : null,
        child: child,
      );
    }
    return FilledButton(style: FilledButton.styleFrom(backgroundColor: widget.color), onPressed: enabled ? _tap : null, child: child);
  }
}

class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.status, this.mode = 'in_person', this.provider = false});
  final String status;
  final String mode;
  final bool provider;

  @override
  Widget build(BuildContext context) {
    final c = statusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: c.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(30)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(statusIcon(status), size: 14, color: c),
        const SizedBox(width: 4),
        Text(statusLabel(status, mode: mode, provider: provider), style: TextStyle(color: c, fontSize: 12, fontWeight: FontWeight.w700)),
      ]),
    );
  }
}

class Pill extends StatelessWidget {
  const Pill(this.text, {super.key, this.icon, this.color = Brand.mutedFg, this.background = Brand.muted});
  final String text;
  final IconData? icon;
  final Color color;
  final Color background;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
        decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(30)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          if (icon != null) ...[Icon(icon, size: 13, color: color), const SizedBox(width: 4)],
          Text(text, style: TextStyle(fontSize: 11.5, color: color, fontWeight: FontWeight.w600)),
        ]),
      );
}

class Stars extends StatelessWidget {
  const Stars({super.key, required this.value, this.size = 16});
  final double value;
  final double size;
  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: List.generate(5, (i) {
          final filled = value >= i + 0.75;
          final half = !filled && value >= i + 0.25;
          return Icon(filled ? Icons.star_rounded : (half ? Icons.star_half_rounded : Icons.star_outline_rounded), size: size, color: const Color(0xFFF2B01E));
        }),
      );
}

/// Tap-to-rate row of stars.
class StarPicker extends StatelessWidget {
  const StarPicker({super.key, required this.value, required this.onChanged, this.size = 40});
  final int value;
  final ValueChanged<int> onChanged;
  final double size;
  @override
  Widget build(BuildContext context) => Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: List.generate(5, (i) {
          final n = i + 1;
          return IconButton(
            iconSize: size,
            onPressed: () {
              HapticFeedback.selectionClick();
              onChanged(n);
            },
            icon: Icon(n <= value ? Icons.star_rounded : Icons.star_outline_rounded, color: const Color(0xFFF2B01E)),
          );
        }),
      );
}

/// A labelled row inside a details card.
class InfoRow extends StatelessWidget {
  const InfoRow({super.key, required this.icon, required this.label, required this.value, this.trailing});
  final IconData icon;
  final String label;
  final String value;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 7),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(icon, size: 19, color: Brand.primary),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(label, style: const TextStyle(fontSize: 11.5, color: Brand.mutedFg)),
              Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, height: 1.45)),
            ]),
          ),
          if (trailing != null) trailing!,
        ]),
      );
}

/// Gradient header used at the top of the home tabs.
class GradientHeader extends StatelessWidget {
  const GradientHeader({super.key, required this.child, this.gradient = Brand.gradient, this.bottomRadius = 30});
  final Widget child;
  final Gradient gradient;
  final double bottomRadius;

  @override
  Widget build(BuildContext context) => AnnotatedRegion<SystemUiOverlayStyle>(
        value: SystemUiOverlayStyle.light.copyWith(statusBarColor: Colors.transparent),
        child: Container(
          decoration: BoxDecoration(gradient: gradient, borderRadius: BorderRadius.vertical(bottom: Radius.circular(bottomRadius))),
          padding: EdgeInsets.fromLTRB(18, MediaQuery.paddingOf(context).top + 14, 18, 22),
          child: DefaultTextStyle.merge(
            style: const TextStyle(color: Colors.white),
            child: IconTheme.merge(data: const IconThemeData(color: Colors.white), child: child),
          ),
        ),
      );
}

/// Menu row used on account pages.
class MenuTile extends StatelessWidget {
  const MenuTile({super.key, required this.icon, required this.title, this.subtitle, this.onTap, this.color, this.trailing});
  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
  final Color? color;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final c = color ?? Brand.primary;
    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(color: c.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
        child: Icon(icon, color: c, size: 21),
      ),
      title: Text(title, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5, color: color ?? Brand.foreground)),
      subtitle: subtitle == null ? null : Text(subtitle!, style: const TextStyle(fontSize: 12, color: Brand.mutedFg)),
      trailing: trailing ?? const Icon(Icons.chevron_left_outlined, color: Brand.mutedFg),
    );
  }
}

/// Groups menu tiles in one card with dividers.
class MenuGroup extends StatelessWidget {
  const MenuGroup({super.key, required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => AppCard(
        padding: EdgeInsets.zero,
        child: Column(children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0) const Divider(indent: 66),
            children[i],
          ],
        ]),
      );
}

/// Round profile photo with the first letter of the name as a fallback.
class Avatar extends StatelessWidget {
  const Avatar({super.key, required this.name, this.url, this.radius = 24, this.color = Brand.primary, this.onLight = true});
  final String name;
  final String? url;
  final double radius;
  final Color color;

  /// true: tinted circle with a colored letter; false: solid circle with a white letter.
  final bool onLight;

  @override
  Widget build(BuildContext context) {
    final letter = Text(name.isEmpty ? '؟' : name.characters.first,
        style: TextStyle(color: onLight ? color : Colors.white, fontWeight: FontWeight.w800, fontSize: radius * 0.8));
    final u = url;
    return CircleAvatar(
      radius: radius,
      backgroundColor: onLight ? color.withValues(alpha: 0.12) : color,
      foregroundImage: (u != null && u.isNotEmpty) ? NetworkImage(absUrl(u)) : null,
      child: letter,
    );
  }
}

/// White box with a soft silver border and a thin coloured line on top (the service colour).
class AccentBox extends StatelessWidget {
  const AccentBox({super.key, required this.accent, required this.child, this.onTap, this.width, this.padding = const EdgeInsets.fromLTRB(10, 14, 10, 10), this.radius = 16});
  final Color accent;
  final Widget child;
  final VoidCallback? onTap;
  final double? width;
  final EdgeInsetsGeometry padding;
  final double radius;

  static const silver = Color(0xFFD9DEE5);

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(radius),
          border: Border.all(color: silver),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 10, offset: const Offset(0, 3))],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(radius),
          child: Material(
            color: Colors.white,
            child: InkWell(
              onTap: onTap,
              child: Stack(children: [
                Padding(padding: padding, child: child),
                Positioned(top: 0, left: 0, right: 0, child: Container(height: 4, color: accent)),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

/// Gradient page header in the same style as the home header: back button (when the page
/// can go back), title, optional icon + description and an optional widget at the bottom.
class PageHeader extends StatelessWidget {
  const PageHeader({super.key, required this.title, this.subtitle, this.icon, this.trailing, this.bottom, this.watermark});
  final String title;

  /// Large translucent icon blended into the bottom-left corner of the banner (no circle).
  final IconData? watermark;
  final String? subtitle;
  final Widget? icon;
  final Widget? trailing;
  final Widget? bottom;

  /// Title-only header used as a Scaffold `appBar`.
  static PreferredSizeWidget bar(String title, {Widget? trailing}) =>
      PreferredSize(preferredSize: const Size.fromHeight(84), child: PageHeader(title: title, trailing: trailing));

  @override
  Widget build(BuildContext context) {
    final canPop = Navigator.of(context).canPop();
    final header = GradientHeader(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          if (canPop)
            IconButton(onPressed: () => Navigator.maybePop(context), icon: const BackButtonIcon(), padding: EdgeInsets.zero, visualDensity: VisualDensity.compact),
          if (canPop) const SizedBox(width: 4),
          Expanded(child: Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800))),
          if (trailing != null) trailing!,
        ]),
        if (icon != null || subtitle != null) ...[
          const SizedBox(height: 14),
          Row(children: [
            if (icon != null) ...[icon!, const SizedBox(width: 14)],
            if (subtitle != null)
              Expanded(child: Text(subtitle!, style: TextStyle(fontSize: 13, height: 1.6, color: Colors.white.withValues(alpha: 0.92)))),
          ]),
        ],
        if (bottom != null) ...[const SizedBox(height: 14), bottom!],
        if (watermark != null) const SizedBox(height: 18),
      ]),
    );
    if (watermark == null) return header;
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(bottom: Radius.circular(30)),
      child: Stack(children: [
        header,
        PositionedDirectional(
          end: -14,
          bottom: -26,
          child: IgnorePointer(
            child: ShaderMask(
              shaderCallback: (r) => LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Colors.white.withValues(alpha: 0.34), Colors.white.withValues(alpha: 0.06)],
              ).createShader(r),
              blendMode: BlendMode.srcIn,
              child: Icon(watermark, size: 128, color: Colors.white),
            ),
          ),
        ),
      ]),
    );
  }
}

/// Notification icon set shared with the admin panel (same keys), plus uploaded images and legacy emoji.
const Map<String, IconData> notifIconMap = {
  'bell': Icons.notifications_outlined,
  'megaphone': Icons.campaign_outlined,
  'gift': Icons.card_giftcard_outlined,
  'percent': Icons.percent_outlined,
  'tag': Icons.sell_outlined,
  'moon': Icons.nightlight_outlined,
  'mosque': Icons.mosque_outlined,
  'star': Icons.star_outline_rounded,
  'sparkles': Icons.auto_awesome_outlined,
  'party': Icons.celebration_outlined,
  'flag': Icons.flag_outlined,
  'palm': Icons.park_outlined,
  'calendar': Icons.event_available_outlined,
  'heart': Icons.favorite_outline,
  'trophy': Icons.emoji_events_outlined,
  'check': Icons.check_circle_outline,
  'sun': Icons.wb_sunny_outlined,
  'coffee': Icons.local_cafe_outlined,
  'alert': Icons.warning_amber_outlined,
  'wrench': Icons.build_outlined,
  // keys used by order notifications created by the server
  'CheckCircle2': Icons.check_circle_outline,
  'XCircle': Icons.cancel_outlined,
  'DoorOpen': Icons.door_front_door_outlined,
  'Wrench': Icons.build_outlined,
  'CircleCheck': Icons.task_alt_outlined,
  'RefreshCw': Icons.autorenew_outlined,
  'AlertTriangle': Icons.warning_amber_outlined,
};

Color _hex(String? v, Color fallback) {
  final h = (v ?? '').replaceAll('#', '');
  if (h.length != 6) return fallback;
  final n = int.tryParse(h, radix: 16);
  return n == null ? fallback : Color(0xFF000000 | n);
}

/// Round tinted badge for a notification (icon key, uploaded image or emoji) in its accent colour.
class NotifBadge extends StatelessWidget {
  const NotifBadge({super.key, this.icon, this.accent, this.size = 42});
  final String? icon;
  final String? accent;
  final double size;

  @override
  Widget build(BuildContext context) {
    final color = _hex(accent, Brand.primary);
    final v = (icon ?? '').trim();
    Widget child;
    if (v.startsWith('http') || v.startsWith('/api/files')) {
      child = ClipRRect(borderRadius: BorderRadius.circular(8), child: Image.network(absUrl(v), width: size * 0.62, height: size * 0.62, fit: BoxFit.contain,
          errorBuilder: (_, __, ___) => Icon(Icons.notifications_outlined, color: color, size: size * 0.5)));
    } else if (notifIconMap.containsKey(v)) {
      child = Icon(notifIconMap[v], color: color, size: size * 0.52);
    } else if (v.isNotEmpty && v.runes.length <= 4) {
      child = Text(v, style: TextStyle(fontSize: size * 0.45));
    } else {
      child = Icon(Icons.notifications_outlined, color: color, size: size * 0.52);
    }
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(size * 0.32)),
      alignment: Alignment.center,
      child: child,
    );
  }
}

/// Pink banner announcing active occasion discounts.
class PromoBanner extends StatelessWidget {
  const PromoBanner({super.key, required this.promos, this.onTap});
  final List<Promo> promos;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    if (promos.isEmpty) return const SizedBox.shrink();
    final p = promos.first;
    final end = p.endsAt?.toLocal();
    return Material(
      borderRadius: BorderRadius.circular(18),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Ink(
          decoration: const BoxDecoration(gradient: LinearGradient(colors: [Color(0xFFEC4899), Color(0xFFF97316)])),
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            const Icon(Icons.percent_outlined, color: Colors.white, size: 28),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(p.title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15)),
                Text(p.text, style: const TextStyle(color: Colors.white, fontSize: 12.5)),
                if (end != null) Text('حتى ${end.year}/${end.month}/${end.day}${promos.length > 1 ? ' • +${promos.length - 1} عرض آخر' : ''}', style: const TextStyle(color: Colors.white70, fontSize: 11)),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}
