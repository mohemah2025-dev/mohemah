import 'dart:async';

import 'package:flutter/material.dart';
import 'package:mohemah_core/mohemah_core.dart';

import '../orders_store.dart';
import 'auth_page.dart';
import 'new_order_page.dart';
import 'order_detail_page.dart';
import 'services_tab.dart';
import 'shell.dart';

class HomeTab extends StatelessWidget {
  const HomeTab({super.key});

  @override
  Widget build(BuildContext context) {
    final session = SessionScope.of(context);
    final data = PublicScope.of(context);
    final store = OrdersScope.of(context);
    final services = data.services;
    final open = store.open;
    final subs = data.subServices;
    final favs = subs.where((s) => store.favorites.contains(s.id)).toList();
    final ads = data.ads.where((a) => a.placement != 'popup_card' && (a.imageUrl ?? '').isNotEmpty).toList();

    return RefreshIndicator(
      onRefresh: () async {
        await Future.wait([data.load(), store.refresh()]);
      },
      child: CustomScrollView(slivers: [
        SliverToBoxAdapter(child: _Header(session: session, unread: store.unreadNotifications)),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          sliver: SliverList.list(children: [
            // 1) Favorites (search is in the header above).
            const SectionTitle('خدماتي المفضلة', padding: EdgeInsets.fromLTRB(4, 0, 4, 10)),
            if (favs.isEmpty)
              AccentBox(
                accent: const Color(0xFFF2B01E),
                padding: const EdgeInsets.fromLTRB(14, 16, 14, 12),
                child: Row(children: const [
                  Icon(Icons.star_outline_rounded, color: Color(0xFFF2B01E)),
                  SizedBox(width: 10),
                  Expanded(child: Text('اضغط النجمة بجانب أي مهمة لتظهر هنا وتطلبها بسرعة', style: TextStyle(fontSize: 12.5, color: Brand.mutedFg))),
                ]),
              )
            else
              SizedBox(
                height: 72,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: favs.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 10),
                  itemBuilder: (_, i) {
                    final sub = favs[i];
                    final parent = data.serviceById(sub.serviceId);
                    final (fg, bg) = serviceColors(sub.color ?? parent?.color);
                    return AccentBox(
                      width: 165,
                      accent: fg,
                      padding: const EdgeInsets.fromLTRB(10, 12, 10, 8),
                      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => NewOrderPage(sub: sub))),
                      child: Row(children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(color: bg.withValues(alpha: 0.6), shape: BoxShape.circle),
                          child: Icon(serviceIcon(sub.icon ?? parent?.icon), color: fg, size: 22),
                        ),
                        const SizedBox(width: 8),
                        Expanded(child: Text(sub.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700))),
                      ]),
                    );
                  },
                ),
              ),
            // 2) Ads (several, auto-sliding).
            if (ads.isNotEmpty) ...[const SizedBox(height: 18), _AdsCarousel(ads: ads)],
            // 3) Services: rectangles side by side, scrolling sideways, up to 6.
            SectionTitle(
              'عرض الخدمات',
              trailing: TextButton(onPressed: () => CustomerShell.goTo(1), child: const Text('عرض الكل')),
            ),
            if (!data.loaded)
              const Loading()
            else if (services.isEmpty)
              const EmptyState(icon: Icons.design_services_outlined, title: 'لا توجد خدمات متاحة حالياً', message: 'عُد قريباً، نضيف خدمات جديدة باستمرار.')
            else
              SizedBox(
                height: 122,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: services.take(6).length,
                  separatorBuilder: (_, __) => const SizedBox(width: 10),
                  itemBuilder: (_, i) {
                    final s = services[i];
                    return ServiceBox(
                      service: s,
                      width: 104,
                      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ServiceDetailPage(service: s))),
                    );
                  },
                ),
              ),
            if (open.isNotEmpty) ...[
              const SectionTitle('طلبك الجاري'),
              for (final o in open.take(2)) Padding(padding: const EdgeInsets.only(bottom: 10), child: _ActiveOrderCard(order: o)),
            ],
            const SizedBox(height: 18),
            const _HowItWorks(),
          ]),
        ),
      ]),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.session, required this.unread});
  final Session session;
  final int unread;

  @override
  Widget build(BuildContext context) {
    final p = session.profile;
    return GradientHeader(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Image.asset('assets/logo.png', package: 'mohemah_core', height: 34),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(p == null ? 'أهلاً بك في مهمة' : 'مرحباً، ${p.firstName}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
              Row(children: [
                const Icon(Icons.location_on_outlined, size: 15),
                const SizedBox(width: 3),
                Text(p?.region ?? 'المملكة العربية السعودية', style: TextStyle(fontSize: 12.5, color: Colors.white.withValues(alpha: 0.88))),
              ]),
            ]),
          ),
          IconButton(
            onPressed: () async {
              if (!await ensureSignedIn(context) || !context.mounted) return;
              OrdersScope.read(context).markNotificationsSeen();
              await Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationsPage()));
            },
            icon: Badge(isLabelVisible: unread > 0, label: Text('$unread'), child: const Icon(Icons.notifications_outlined, size: 27)),
          ),
        ]),
        const SizedBox(height: 16),
        Material(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: () => CustomerShell.goTo(1),
            child: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 14, vertical: 13),
              child: Row(children: [
                Icon(Icons.search_outlined, color: Brand.mutedFg),
                SizedBox(width: 8),
                Text('ابحث عن خدمة… سباكة، كهرباء، تدريس', style: TextStyle(color: Brand.mutedFg, fontSize: 13.5)),
              ]),
            ),
          ),
        ),
      ]),
    );
  }
}

class _AdsCarousel extends StatefulWidget {
  const _AdsCarousel({required this.ads});
  final List<Ad> ads;
  @override
  State<_AdsCarousel> createState() => _AdsCarouselState();
}

class _AdsCarouselState extends State<_AdsCarousel> {
  final _page = PageController(viewportFraction: 0.94);
  Timer? _timer;
  int _index = 0;

  @override
  void initState() {
    super.initState();
    if (widget.ads.length > 1) {
      _timer = Timer.periodic(const Duration(seconds: 5), (_) {
        if (!_page.hasClients) return;
        _page.animateToPage((_index + 1) % widget.ads.length, duration: const Duration(milliseconds: 500), curve: Curves.easeOutCubic);
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _page.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      AspectRatio(
        aspectRatio: 2.2,
        child: PageView.builder(
          controller: _page,
          itemCount: widget.ads.length,
          onPageChanged: (i) => setState(() => _index = i),
          itemBuilder: (_, i) {
            final ad = widget.ads[i];
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: InkWell(
                  onTap: (ad.link ?? '').startsWith('http') ? () => openUrl(context, ad.link!) : null,
                  child: Image.network(
                    ad.imageUrl!,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      color: Brand.muted,
                      alignment: Alignment.center,
                      child: Text(ad.title, style: const TextStyle(fontWeight: FontWeight.w700)),
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
      if (widget.ads.length > 1)
        Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            for (var i = 0; i < widget.ads.length; i++)
              AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: i == _index ? 18 : 6,
                height: 6,
                decoration: BoxDecoration(color: i == _index ? Brand.primary : Brand.border, borderRadius: BorderRadius.circular(6)),
              ),
          ]),
        ),
    ]);
  }
}

class _ActiveOrderCard extends StatelessWidget {
  const _ActiveOrderCard({required this.order});
  final CustomerOrder order;

  @override
  Widget build(BuildContext context) {
    final c = statusColor(order.status);
    return AppCard(
      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => OrderDetailPage(orderId: order.id))),
      child: Row(children: [
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(color: c.withValues(alpha: 0.12), shape: BoxShape.circle),
          child: Icon(statusIcon(order.status), color: c),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(order.title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
            const SizedBox(height: 2),
            Text(statusLabel(order.status, mode: order.mode), style: TextStyle(color: c, fontWeight: FontWeight.w700, fontSize: 12.5)),
            if (order.providerName != null) Text(order.providerName!, style: const TextStyle(color: Brand.mutedFg, fontSize: 12)),
          ]),
        ),
        if (order.unread > 0) Badge(label: Text('${order.unread}'), child: const Icon(Icons.chat_outlined, color: Brand.primary)),
        const SizedBox(width: 6),
        const Icon(Icons.chevron_left_outlined, color: Brand.mutedFg),
      ]),
    );
  }
}

class _HowItWorks extends StatelessWidget {
  const _HowItWorks();

  @override
  Widget build(BuildContext context) {
    const steps = [
      (Icons.touch_app_outlined, 'اختر الخدمة', 'حدد المهمة وهل هي حضورية أو عن بُعد'),
      (Icons.campaign_outlined, 'يصل طلبك', 'لمقدمي الخدمة في مدينتك فوراً'),
      (Icons.handshake_outlined, 'تابع التنفيذ', 'راسل مقدم الخدمة وقيّمه بعد الإنجاز'),
    ];
    return AppCard(
      color: Brand.accent,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('كيف تعمل مهمة؟', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Brand.accentFg)),
        const SizedBox(height: 10),
        for (final s in steps)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 5),
            child: Row(children: [
              Icon(s.$1, color: Brand.accentFg),
              const SizedBox(width: 10),
              Expanded(
                child: Text.rich(TextSpan(children: [
                  TextSpan(text: '${s.$2}: ', style: const TextStyle(fontWeight: FontWeight.w800)),
                  TextSpan(text: s.$3),
                ]), style: const TextStyle(fontSize: 13, color: Brand.foreground)),
              ),
            ]),
          ),
        const SizedBox(height: 4),
        const Text('لا يأخذ التطبيق أي رسوم من طالب الخدمة، وتتفق مع مقدم الخدمة على قيمة التنفيذ.', style: TextStyle(fontSize: 12, color: Brand.mutedFg)),
      ]),
    );
  }
}
