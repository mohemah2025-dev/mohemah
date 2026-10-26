import 'package:flutter/material.dart';

import 'theme.dart';

class NavItem {
  const NavItem({required this.icon, required this.activeIcon, required this.label, this.badge = 0, this.action = false});
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final int badge;

  /// An action button (e.g. "request a service"): drawn as a gradient tile, never "selected".
  final bool action;
}

/// Bottom bar: white rounded panel with a soft bump that rises under the selected tab,
/// whose icon sits in a raised gradient circle.
class MohemahNavBar extends StatelessWidget {
  const MohemahNavBar({super.key, required this.items, required this.index, required this.onTap, this.gradient = Brand.gradient});
  final List<NavItem> items;
  final int index;
  final ValueChanged<int> onTap;
  final Gradient gradient;

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    final accent = gradient is LinearGradient ? (gradient as LinearGradient).colors.last : Brand.primary;
    return SizedBox(
      height: 86 + bottom,
      child: TweenAnimationBuilder<double>(
        tween: Tween(end: index.toDouble()),
        duration: const Duration(milliseconds: 320),
        curve: Curves.easeOutCubic,
        builder: (context, pos, _) => Stack(clipBehavior: Clip.none, children: [
          Positioned.fill(
            top: 18,
            child: CustomPaint(painter: _BarPainter(position: pos, count: items.length, rtl: Directionality.of(context) == TextDirection.rtl)),
          ),
          Positioned.fill(
            top: 0,
            bottom: bottom,
            child: Row(children: [
              for (var i = 0; i < items.length; i++)
                Expanded(
                  child: _Tab(
                    item: items[i],
                    selected: i == index && !items[i].action,
                    gradient: gradient,
                    accent: accent,
                    onTap: () => onTap(i),
                  ),
                ),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _Tab extends StatelessWidget {
  const _Tab({required this.item, required this.selected, required this.gradient, required this.accent, required this.onTap});
  final NavItem item;
  final bool selected;
  final Gradient gradient;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final icon = AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOutBack,
      width: selected ? 54 : (item.action ? 46 : 40),
      height: selected ? 54 : (item.action ? 46 : 40),
      margin: EdgeInsets.only(top: selected ? 0 : (item.action ? 20 : 26)),
      decoration: BoxDecoration(
        gradient: selected || item.action ? gradient : null,
        shape: selected ? BoxShape.circle : BoxShape.rectangle,
        borderRadius: selected ? null : BorderRadius.circular(item.action ? 16 : 12),
        boxShadow: selected || item.action ? [BoxShadow(color: accent.withValues(alpha: 0.35), blurRadius: 14, offset: const Offset(0, 6))] : null,
      ),
      child: Badge(
        isLabelVisible: item.badge > 0,
        label: Text('${item.badge}'),
        child: Icon(selected ? item.activeIcon : item.icon, size: selected ? 27 : (item.action ? 28 : 24), color: selected || item.action ? Colors.white : const Color(0xFF5B6573)),
      ),
    );
    return Semantics(
      button: true,
      selected: selected,
      label: item.label,
      child: InkResponse(
        onTap: onTap,
        radius: 36,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          icon,
          const SizedBox(height: 4),
          AnimatedDefaultTextStyle(
            duration: const Duration(milliseconds: 250),
            style: TextStyle(
              fontFamily: kFont,
              fontSize: 11.5,
              fontWeight: selected || item.action ? FontWeight.w800 : FontWeight.w600,
              color: selected ? accent : (item.action ? Brand.foreground : const Color(0xFF7A8594)),
            ),
            child: Text(item.label, maxLines: 1, overflow: TextOverflow.ellipsis),
          ),
        ]),
      ),
    );
  }
}

/// White panel with rounded top corners and a smooth bump under the selected tab.
class _BarPainter extends CustomPainter {
  _BarPainter({required this.position, required this.count, required this.rtl});
  final double position;
  final int count;
  final bool rtl;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final slot = w / count;
    final cx = rtl ? w - slot * (position + 0.5) : slot * (position + 0.5);
    const r = 24.0; // top corners
    const bump = 18.0; // how high the bump rises
    const half = 46.0; // half width of the bump
    final path = Path()
      ..moveTo(0, r)
      ..quadraticBezierTo(0, 0, r, 0)
      ..lineTo(cx - half - 10, 0)
      ..cubicTo(cx - half + 8, 0, cx - 30, -bump, cx, -bump)
      ..cubicTo(cx + 30, -bump, cx + half - 8, 0, cx + half + 10, 0)
      ..lineTo(w - r, 0)
      ..quadraticBezierTo(w, 0, w, r)
      ..lineTo(w, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawShadow(path, const Color(0x55223355), 10, false);
    canvas.drawPath(path, Paint()..color = Colors.white);
  }

  @override
  bool shouldRepaint(_BarPainter old) => old.position != position || old.count != count || old.rtl != rtl;
}
