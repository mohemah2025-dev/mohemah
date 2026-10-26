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
                  const Icon(Icons.workspace_premium_outlined, size: 15, color: Brand.mint),
                  const SizedBox(width: 3),
                  Text('مستوى ${tier.name}', style: TextStyle(fontSize: 12.5, color: Colors.white.withValues(alpha: 0.88))),
                ]),
                CurrentLocationLine(fallback: p.region),
              ]),
            ),
            IconButton(
              onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationsPage())),
              icon: const Icon(Icons.notifications_outlined, size: 27),
            ),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          child: Column(children: [
            if (store.error != null && store.feed == null) ErrorRetry(message: store.error!, onRetry: store.refresh),
            if ((store.feed?.promotions ?? const []).isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: PromoBanner(promos: store.feed!.promotions, onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const BillingPage()))),
              ),
            for (final o in store.incoming.where((x) => store.minimized.contains(x.id)))
              Padding(padding: const EdgeInsets.only(bottom: 12), child: _MinimizedIncoming(order: o)),
            const _ConnectionCard(),
            const SizedBox(height: 14),
            if (store.feed != null && store.feed!.active.isNotEmpty)
              AppCard(
                color: const Color(0xFFEAF1FF),
                onTap: () => ProviderShell.goTo(1, section: 1),
                child: Row(children: [
                  const Icon(Icons.handyman_outlined, color: Brand.primaryDeep),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text('لديك ${store.feed!.active.length} طلب جارٍ — تابع التنفيذ',
                        style: const TextStyle(fontWeight: FontWeight.w800, color: Brand.primaryDeep)),
                  ),
                  const Icon(Icons.chevron_left_outlined, color: Brand.primaryDeep),
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
  String? _panel;
  bool _toggling = false;
  late final AnimationController _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 2200))..repeat();

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

    // The card fills the screen down to the tab bar; the demand chart appears when scrolling down.
    final mq = MediaQuery.of(context);
    final cardHeight = math.max(440.0, mq.size.height - mq.padding.top - mq.padding.bottom - 84 - 16 - 66 - 14);

    return AppCard(
      padding: EdgeInsets.zero,
      child: Column(children: [
        SizedBox(
          height: cardHeight,
          child: Column(children: [
            if (subActive)
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 14, 14, 0),
                child: InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const BillingPage())),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                    decoration: BoxDecoration(
                      color: Brand.success.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: Brand.success.withValues(alpha: 0.35)),
                    ),
                    child: Row(children: [
                      const Icon(Icons.verified_outlined, color: Brand.success, size: 20),
                      const SizedBox(width: 8),
                      const Expanded(child: Text('الاشتراك فعّال', style: TextStyle(color: Brand.success, fontWeight: FontWeight.w800, fontSize: 14))),
                      Text('حتى ${subEnd!.year}/${subEnd.month.toString().padLeft(2, '0')}/${subEnd.day.toString().padLeft(2, '0')}',
                          style: const TextStyle(color: Brand.success, fontSize: 12, fontWeight: FontWeight.w600)),
                    ]),
                  ),
                ),
              ),
            // The connection circle in the middle.
            Expanded(
              child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                SizedBox(
                  width: 230,
                  height: 230,
                  child: AnimatedBuilder(
                    animation: _pulse,
                    builder: (context, child) => CustomPaint(painter: _PulsePainter(online ? _pulse.value : null), child: Center(child: child)),
                    child: GestureDetector(
                  onTap: feed == null ? null : () => _toggle(online),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 300),
                    width: 178,
                    height: 178,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: online ? Brand.providerGradient : null,
                      color: online ? null : Brand.muted,
                      boxShadow: [
                        BoxShadow(
                          color: (online ? Brand.primaryDeep : Colors.black).withValues(alpha: online ? 0.35 : 0.1),
                          blurRadius: 26,
                          offset: const Offset(0, 12),
                        ),
                      ],
                    ),
                    child: _toggling
                        ? Center(child: CircularProgressIndicator(color: online ? Colors.white : Brand.primaryDeep))
                        : Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                            Icon(Icons.power_settings_new_outlined, size: 54, color: online ? Colors.white : Brand.mutedFg),
                            const SizedBox(height: 6),
                            Text(online ? 'متصل' : 'غير متصل',
                                style: TextStyle(fontSize: 21, fontWeight: FontWeight.w800, color: online ? Colors.white : Brand.mutedFg)),
                          ]),
                  ),
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  online ? 'أنت متاح لاستقبال الطلبات الآن' : 'اضغط على الدائرة لبدء استقبال الطلبات',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Brand.mutedFg, fontSize: 12.5),
                ),
              ]),
            ),
            // Services and loyalty in the bottom corners.
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 4, 10, 10),
              child: Row(children: [
                _CornerIcon(
                  icon: Icons.home_repair_service_outlined,
                  label: 'الخدمات المتاحة',
                  sub: '${feed?.servicesCount ?? 0} مختارة',
                  color: const Color(0xFF2B6CD9),
                  active: _panel == 'services',
                  onTap: () => setState(() => _panel = _panel == 'services' ? null : 'services'),
                ),
                const Spacer(),
                _CornerIcon(
                  icon: Icons.workspace_premium_outlined,
                  label: 'برنامج الولاء',
                  sub: loyaltyTiers[tierIdx].name,
                  color: const Color(0xFFD99A0B),
                  active: _panel == 'loyalty',
                  onTap: () => setState(() => _panel = _panel == 'loyalty' ? null : 'loyalty'),
                ),
              ]),
            ),
            const Divider(),
            IntrinsicHeight(
              child: Row(children: [
                _MiniStat(icon: Icons.assignment_outlined, value: '${feed?.available.length ?? 0}', label: 'طلبات متاحة', onTap: () => ProviderShell.goTo(1, section: 0)),
                const VerticalDivider(width: 1),
                _MiniStat(icon: Icons.handyman_outlined, value: '${feed?.active.length ?? 0}', label: 'طلبات جارية', onTap: () => ProviderShell.goTo(1, section: 1)),
                const VerticalDivider(width: 1),
                subActive
                    ? _MiniStat(
                        icon: Icons.event_available_outlined,
                        value: '${math.max(0, (subEnd!.difference(DateTime.now()).inHours / 24).ceil())}',
                        label: 'يوم اشتراك',
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const BillingPage())),
                      )
                    : _MiniStat(
                        icon: Icons.toll_outlined,
                        value: '${feed?.balance ?? 0}',
                        label: 'كوينز',
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const BillingPage())),
                      ),
              ]),
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

IconData tierIcon(int i) => const [Icons.verified_outlined, Icons.military_tech_outlined, Icons.workspace_premium_outlined, Icons.emoji_events_outlined][math.min(math.max(i, 0), 3)];

/// An icon without a box, used in the card corners.
/// Soft rings that spread out from the circle while the provider is online (nothing when offline).
class _PulsePainter extends CustomPainter {
  _PulsePainter(this.t);
  final double? t;

  @override
  void paint(Canvas canvas, Size size) {
    final t = this.t;
    if (t == null) return;
    final c = size.center(Offset.zero);
    final r = size.shortestSide / 2;
    for (var i = 0; i < 2; i++) {
      final p = (t + i / 2) % 1;
      canvas.drawCircle(c, 89 + (r - 89) * p, Paint()..color = Brand.primaryDeep.withValues(alpha: 0.22 * (1 - p)));
    }
  }

  @override
  bool shouldRepaint(_PulsePainter old) => old.t != t;
}

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
          Icon(icon, color: color, size: 36),
          const SizedBox(width: 6),
          Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Text(label, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: active ? color : Brand.foreground)),
            Text(sub, style: const TextStyle(fontSize: 11, color: Brand.mutedFg)),
          ]),
          Icon(active ? Icons.keyboard_arrow_up_outlined : Icons.keyboard_arrow_down_outlined, size: 18, color: Brand.mutedFg),
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
                  child: CircleAvatar(radius: 11, backgroundColor: Brand.success, child: Icon(Icons.check_outlined, size: 15, color: Colors.white)),
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

/// A minimised new order: a blinking bar at the top of the home page; tapping opens the full card again.
class _MinimizedIncoming extends StatefulWidget {
  const _MinimizedIncoming({required this.order});
  final OfferedOrder order;
  @override
  State<_MinimizedIncoming> createState() => _MinimizedIncomingState();
}

class _MinimizedIncomingState extends State<_MinimizedIncoming> with SingleTickerProviderStateMixin {
  late final AnimationController _blink = AnimationController(vsync: this, duration: const Duration(milliseconds: 700))..repeat(reverse: true);

  @override
  void dispose() {
    _blink.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final store = ProviderScope.of(context);
    final o = widget.order;
    final at = store.incomingAt[o.id] ?? DateTime.now();
    final left = math.max(0, (incomingTtl - DateTime.now().difference(at)).inSeconds);
    return AnimatedBuilder(
      animation: _blink,
      builder: (context, child) => Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          boxShadow: [BoxShadow(color: Brand.success.withValues(alpha: 0.25 + 0.35 * _blink.value), blurRadius: 8 + 10 * _blink.value, spreadRadius: 1)],
        ),
        child: child,
      ),
      child: Material(
        borderRadius: BorderRadius.circular(18),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => store.restore(o.id),
          child: Ink(
            decoration: const BoxDecoration(gradient: Brand.providerGradient),
            padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
            child: Row(children: [
              FadeTransition(
                opacity: Tween(begin: 0.35, end: 1.0).animate(_blink),
                child: const Icon(Icons.notifications_active_outlined, color: Colors.white, size: 26),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('طلب جديد: ${o.title}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15)),
                  Text('${o.region ?? ''}${o.region != null ? ' • ' : ''}متبقي $left ث — اضغط للعرض', style: const TextStyle(color: Colors.white70, fontSize: 12)),
                ]),
              ),
              const Icon(Icons.keyboard_double_arrow_down_rounded, color: Colors.white, size: 26),
            ]),
          ),
        ),
      ),
    );
  }
}
