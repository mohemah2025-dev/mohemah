import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mohemah_core/mohemah_core.dart';

import '../provider_store.dart';
import 'billing_page.dart';
import 'shell.dart';

class ProviderHomeTab extends StatelessWidget {
  const ProviderHomeTab({super.key});

  @override
  Widget build(BuildContext context) {
    final session = SessionScope.of(context);
    final store = ProviderScope.of(context);
    final p = session.profile!;
    final stats = store.stats;
    final tier = loyaltyTiers[currentTierIndex(stats?.completed ?? 0, stats?.rating ?? 0)];

    return RefreshIndicator(
      onRefresh: () async {
        await Future.wait([store.refresh(), store.loadStats()]);
      },
      child: ListView(padding: EdgeInsets.zero, children: [
        GradientHeader(
          gradient: Brand.providerGradient,
          child: Row(children: [
            Avatar(name: p.fullName, url: p.avatarUrl, radius: 24, color: Colors.white),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('مرحباً، ${p.firstName}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                Row(children: [
                  const Icon(Icons.workspace_premium_rounded, size: 15, color: Brand.mint),
                  const SizedBox(width: 3),
                  Text('مستوى ${tier.name}', style: TextStyle(fontSize: 12.5, color: Colors.white.withValues(alpha: 0.88))),
                  if (p.region != null) ...[
                    const SizedBox(width: 10),
                    const Icon(Icons.location_on_rounded, size: 15),
                    Text(p.region!, style: TextStyle(fontSize: 12.5, color: Colors.white.withValues(alpha: 0.88))),
                  ],
                ]),
              ]),
            ),
            IconButton(
              onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationsPage())),
              icon: const Icon(Icons.notifications_rounded, size: 27),
            ),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          child: Column(children: [
            if (store.error != null && store.feed == null) ErrorRetry(message: store.error!, onRetry: store.refresh),
            const _ConnectionCard(),
            const SizedBox(height: 14),
            if (store.feed != null && store.feed!.active.isNotEmpty)
              AppCard(
                color: const Color(0xFFEAF1FF),
                onTap: () => ProviderShell.goTo(1, section: 1),
                child: Row(children: [
                  const Icon(Icons.handyman_rounded, color: Brand.primaryDeep),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text('لديك ${store.feed!.active.length} طلب جارٍ — تابع التنفيذ',
                        style: const TextStyle(fontWeight: FontWeight.w800, color: Brand.primaryDeep)),
                  ),
                  const Icon(Icons.chevron_left_rounded, color: Brand.primaryDeep),
                ]),
              ),
            if (stats != null) ...[const SizedBox(height: 14), DemandChart(data: stats.demandByHour)],
          ]),
        ),
      ]),
    );
  }
}

/// The card with the connection circle in the middle and services / loyalty as icons on both sides.
class _ConnectionCard extends StatefulWidget {
  const _ConnectionCard();
  @override
  State<_ConnectionCard> createState() => _ConnectionCardState();
}

class _ConnectionCardState extends State<_ConnectionCard> with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 2200))..repeat();
  String? _panel;
  bool _toggling = false;

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  Future<void> _toggle(bool online) async {
    if (_toggling) return;
    HapticFeedback.mediumImpact();
    setState(() => _toggling = true);
    try {
      await ProviderScope.read(context).setOnline(!online);
      if (mounted) showSnack(context, !online ? 'أنت متصل الآن، ستصلك الطلبات الجديدة' : 'تم إيقاف استقبال الطلبات');
    } catch (e) {
      if (mounted) showError(context, e);
    }
    if (mounted) setState(() => _toggling = false);
  }

  @override
  Widget build(BuildContext context) {
    final store = ProviderScope.of(context);
    final feed = store.feed;
    final stats = store.stats;
    final online = feed?.online ?? false;
    final tierIdx = currentTierIndex(stats?.completed ?? 0, stats?.rating ?? 0);
    final subEnd = feed?.subscriptionEnd;
    final subActive = subEnd != null && subEnd.isAfter(DateTime.now());

    return AppCard(
      padding: EdgeInsets.zero,
      child: Column(children: [
        // The connection switch: a wide rectangle.
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 16, 14, 6),
          child: GestureDetector(
            onTap: feed == null ? null : () => _toggle(online),
            child: AnimatedBuilder(
              animation: _pulse,
              builder: (_, __) => CustomPaint(
                painter: _RectPainter(online: online, t: _pulse.value),
                child: Padding(
                  padding: const EdgeInsets.all(7),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 300),
                    height: 132,
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(24),
                      gradient: online ? Brand.providerGradient : null,
                      color: online ? null : Brand.muted,
                      boxShadow: [
                        BoxShadow(
                          color: (online ? Brand.primaryDeep : Colors.black).withValues(alpha: online ? 0.3 : 0.05),
                          blurRadius: 22,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: _toggling
                        ? Center(child: CircularProgressIndicator(color: online ? Colors.white : Brand.primaryDeep))
                        : Row(children: [
                            Container(
                              width: 64,
                              height: 64,
                              decoration: BoxDecoration(color: online ? Colors.white24 : Colors.white, shape: BoxShape.circle),
                              child: Icon(online ? Icons.wifi_tethering_rounded : Icons.portable_wifi_off_rounded, size: 34, color: online ? Colors.white : Brand.mutedFg),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text(online ? 'متصل' : 'غير متصل',
                                    style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: online ? Colors.white : Brand.foreground)),
                                const SizedBox(height: 2),
                                Text(online ? 'أنت متاح لاستقبال الطلبات الآن' : 'اضغط هنا لبدء استقبال الطلبات',
                                    style: TextStyle(fontSize: 12.5, color: online ? Colors.white70 : Brand.mutedFg)),
                              ]),
                            ),
                            Switch(value: online, onChanged: feed == null ? null : (_) => _toggle(online)),
                          ]),
                  ),
                ),
              ),
            ),
          ),
        ),
        // Services and loyalty as plain icons in the bottom corners.
        Padding(
          padding: const EdgeInsets.fromLTRB(10, 4, 10, 10),
          child: Row(children: [
            _CornerIcon(
              icon: Icons.build_circle_rounded,
              label: 'الخدمات المتاحة',
              sub: '${feed?.servicesCount ?? 0} مختارة',
              color: Brand.primary,
              active: _panel == 'services',
              onTap: () => setState(() => _panel = _panel == 'services' ? null : 'services'),
            ),
            const Spacer(),
            _CornerIcon(
              icon: tierIcon(tierIdx),
              label: 'برنامج الولاء',
              sub: loyaltyTiers[tierIdx].name,
              color: Brand.coral,
              active: _panel == 'loyalty',
              onTap: () => setState(() => _panel = _panel == 'loyalty' ? null : 'loyalty'),
            ),
          ]),
        ),
        const Divider(),
        IntrinsicHeight(
          child: Row(children: [
            _MiniStat(icon: Icons.assignment_rounded, value: '${feed?.available.length ?? 0}', label: 'طلبات متاحة', onTap: () => ProviderShell.goTo(1, section: 0)),
            const VerticalDivider(width: 1),
            _MiniStat(icon: Icons.handyman_rounded, value: '${feed?.active.length ?? 0}', label: 'طلبات جارية', onTap: () => ProviderShell.goTo(1, section: 1)),
            const VerticalDivider(width: 1),
            subActive
                ? _MiniStat(
                    icon: Icons.event_available_rounded,
                    value: '${math.max(0, (subEnd!.difference(DateTime.now()).inHours / 24).ceil())}',
                    label: 'يوم اشتراك',
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const BillingPage())),
                  )
                : _MiniStat(
                    icon: Icons.toll_rounded,
                    value: '${feed?.balance ?? 0}',
                    label: 'كوينز',
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const BillingPage())),
                  ),
          ]),
        ),
        AnimatedSize(
          duration: const Duration(milliseconds: 220),
          alignment: Alignment.topCenter,
          child: _panel == null
              ? const SizedBox(width: double.infinity)
              : Column(children: [
                  const Divider(),
                  Padding(
                    padding: const EdgeInsets.all(14),
                    child: _panel == 'services' ? const MyServicesPanel() : _LoyaltyPanel(current: tierIdx, completed: stats?.completed ?? 0, rating: stats?.rating ?? 0),
                  ),
                ]),
        ),
      ]),
    );
  }
}

IconData tierIcon(int i) => const [Icons.verified_rounded, Icons.military_tech_rounded, Icons.workspace_premium_rounded, Icons.emoji_events_rounded][math.min(math.max(i, 0), 3)];

/// Dashed outline while offline ("not connected"), a soft pulse while online.
class _RectPainter extends CustomPainter {
  _RectPainter({required this.online, required this.t});
  final bool online;
  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    if (online) {
      final grow = 6 * t;
      final r = RRect.fromRectAndRadius(rect.deflate(6 - grow), Radius.circular(28 + grow));
      canvas.drawRRect(r, Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3
        ..color = Brand.primaryDeep.withValues(alpha: 0.35 * (1 - t)));
    } else {
      final path = Path()..addRRect(RRect.fromRectAndRadius(rect.deflate(1.5), const Radius.circular(30)));
      final paint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.2
        ..strokeCap = StrokeCap.round
        ..color = Brand.mutedFg.withValues(alpha: 0.45);
      for (final m in path.computeMetrics()) {
        const dash = 10.0, gap = 8.0;
        var d = (t * (dash + gap)) % (dash + gap);
        while (d < m.length) {
          canvas.drawPath(m.extractPath(d, math.min(d + dash, m.length)), paint);
          d += dash + gap;
        }
      }
    }
  }

  @override
  bool shouldRepaint(_RectPainter old) => old.online != online || old.t != t;
}

/// An icon without a box, used in the card corners.
class _CornerIcon extends StatelessWidget {
  const _CornerIcon({required this.icon, required this.label, required this.sub, required this.color, required this.active, required this.onTap});
  final IconData icon;
  final String label;
  final String sub;
  final Color color;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, color: color, size: 30),
          const SizedBox(width: 6),
          Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Text(label, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: active ? color : Brand.foreground)),
            Text(sub, style: const TextStyle(fontSize: 11, color: Brand.mutedFg)),
          ]),
          Icon(active ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded, size: 18, color: Brand.mutedFg),
        ]),
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({required this.icon, required this.value, required this.label, required this.onTap});
  final IconData icon;
  final String value;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Expanded(
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Column(children: [
              Icon(icon, size: 19, color: Brand.primaryDeep),
              Text(value, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
              Text(label, style: const TextStyle(fontSize: 10.5, color: Brand.mutedFg)),
            ]),
          ),
        ),
      );
}

/// Services the provider receives orders for (toggle to save immediately).
class MyServicesPanel extends StatefulWidget {
  const MyServicesPanel({super.key});
  @override
  State<MyServicesPanel> createState() => _MyServicesPanelState();
}

class _MyServicesPanelState extends State<MyServicesPanel> {
  Set<String>? _mine;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final ids = jStrings(await ProviderScope.read(context).api.get('/api/provider/services'));
      if (mounted) setState(() => _mine = ids.toSet());
    } catch (_) {
      if (mounted) setState(() => _mine = <String>{});
    }
  }

  Future<void> _toggle(String id) async {
    final mine = _mine;
    if (mine == null || _saving) return;
    final next = {...mine};
    next.contains(id) ? next.remove(id) : next.add(id);
    setState(() {
      _mine = next;
      _saving = true;
    });
    final store = ProviderScope.read(context);
    try {
      final saved = jStrings(await store.api.put('/api/provider/services', {'ids': next.toList()}));
      if (mounted) setState(() => _mine = saved.toSet());
      await store.refresh();
    } catch (e) {
      if (mounted) {
        setState(() => _mine = mine);
        showError(context, e);
      }
    }
    if (mounted) setState(() => _saving = false);
  }

  @override
  Widget build(BuildContext context) {
    final services = PublicScope.of(context).services;
    final mine = _mine;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text('اضغط على الخدمة لتفعيلها أو إيقافها${_saving ? ' — جارٍ الحفظ…' : ''}',
          style: const TextStyle(fontSize: 12, color: Brand.mutedFg)),
      const SizedBox(height: 10),
      if (mine == null)
        const Loading()
      else if (services.isEmpty)
        const Text('لا توجد خدمات بعد.', style: TextStyle(color: Brand.mutedFg))
      else
        Wrap(
          spacing: 14,
          runSpacing: 14,
          alignment: WrapAlignment.center,
          children: [for (final sv in services) _ServiceCheck(service: sv, on: mine.contains(sv.id), onTap: () => _toggle(sv.id))],
        ),
    ]);
  }
}

/// A service icon with a check mark when selected.
class _ServiceCheck extends StatelessWidget {
  const _ServiceCheck({required this.service, required this.on, required this.onTap});
  final Service service;
  final bool on;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: service.name,
      child: GestureDetector(
        onTap: onTap,
        child: SizedBox(
          width: 64,
          child: Column(children: [
            Stack(clipBehavior: Clip.none, children: [
              AnimatedOpacity(duration: const Duration(milliseconds: 200), opacity: on ? 1 : 0.4, child: ServiceIcon(icon: service.icon, color: service.color, size: 54)),
              if (on)
                const Positioned(
                  top: -4,
                  left: -4,
                  child: CircleAvatar(radius: 11, backgroundColor: Brand.success, child: Icon(Icons.check_rounded, size: 15, color: Colors.white)),
                ),
            ]),
            const SizedBox(height: 4),
            Text(service.name, maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center, style: const TextStyle(fontSize: 10.5)),
          ]),
        ),
      ),
    );
  }
}

class _LoyaltyPanel extends StatelessWidget {
  const _LoyaltyPanel({required this.current, required this.completed, required this.rating});
  final int current;
  final int completed;
  final double rating;

  @override
  Widget build(BuildContext context) {
    final next = current + 1 < loyaltyTiers.length ? loyaltyTiers[current + 1] : null;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(
        'أنجزت $completed طلب بتقييم ${rating.toStringAsFixed(1)}${next != null ? ' — المستوى التالي «${next.name}» بعد ${math.max(0, next.min - completed)} طلب' : ' — وصلت لأعلى مستوى'}',
        style: const TextStyle(fontSize: 12, color: Brand.mutedFg),
      ),
      const SizedBox(height: 10),
      for (var i = 0; i < loyaltyTiers.length; i++)
        Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: i == current ? Brand.coral.withValues(alpha: 0.06) : Brand.background,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: i == current ? Brand.coral : Brand.border, width: i == current ? 1.6 : 1),
          ),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            CircleAvatar(
              radius: 20,
              backgroundColor: (i <= current ? Brand.coral : Brand.mutedFg).withValues(alpha: 0.14),
              child: Icon(tierIcon(i), color: i <= current ? Brand.coral : Brand.mutedFg, size: 21),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text(loyaltyTiers[i].name, style: const TextStyle(fontWeight: FontWeight.w800))),
                  Text(loyaltyTiers[i].reward, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Brand.coral)),
                ]),
                Text(loyaltyTiers[i].requirement, style: const TextStyle(fontSize: 11.5, color: Brand.mutedFg)),
                Text(loyaltyTiers[i].perks.join(' · '), style: const TextStyle(fontSize: 11.5, color: Brand.mutedFg)),
              ]),
            ),
          ]),
        ),
    ]);
  }
}

/// Orders created per hour of day in the provider's services (last 30 days).
class DemandChart extends StatelessWidget {
  const DemandChart({super.key, required this.data});
  final Map<int, int> data;

  @override
  Widget build(BuildContext context) {
    final maxV = data.values.fold<int>(0, math.max);
    var peak = -1;
    data.forEach((h, v) {
      if (v == maxV && maxV > 0 && peak == -1) peak = h;
    });
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('أوقات الطلب في خدماتك', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
        Text(peak >= 0 ? 'الذروة حول الساعة ${peak % 12 == 0 ? 12 : peak % 12} ${peak < 12 ? 'صباحاً' : 'مساءً'} (آخر 30 يوماً)' : 'لا توجد طلبات كافية بعد لعرض أوقات الذروة',
            style: const TextStyle(fontSize: 12, color: Brand.mutedFg)),
        const SizedBox(height: 14),
        SizedBox(
          height: 110,
          child: Directionality(
            textDirection: TextDirection.ltr,
            child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
              for (var h = 0; h < 24; h++)
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 1),
                    child: Tooltip(
                      message: '$h:00 — ${data[h] ?? 0}',
                      child: Container(
                        height: maxV == 0 ? 4.0 : math.max(4.0, 104.0 * (data[h] ?? 0) / maxV),
                        decoration: BoxDecoration(
                          color: h == peak ? Brand.primaryDeep : Brand.primary.withValues(alpha: 0.35),
                          borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                        ),
                      ),
                    ),
                  ),
                ),
            ]),
          ),
        ),
        const SizedBox(height: 4),
        const Directionality(
          textDirection: TextDirection.ltr,
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text('12 ص', style: TextStyle(fontSize: 10, color: Brand.mutedFg)),
            Text('6 ص', style: TextStyle(fontSize: 10, color: Brand.mutedFg)),
            Text('12 م', style: TextStyle(fontSize: 10, color: Brand.mutedFg)),
            Text('6 م', style: TextStyle(fontSize: 10, color: Brand.mutedFg)),
            Text('11 م', style: TextStyle(fontSize: 10, color: Brand.mutedFg)),
          ]),
        ),
      ]),
    );
  }
}
