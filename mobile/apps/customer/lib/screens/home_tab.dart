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
    // Distinct tasks from the customer's past orders, newest first (max 6).
    final previous = <(SubService, CustomerOrder)>[];
    for (final o in store.orders ?? const <CustomerOrder>[]) {
      final id = o.subServiceId;
      if (id == null || previous.any((p) => p.$1.id == id)) continue;
      final sub = subs.where((x) => x.id == id).firstOrNull;
      if (sub != null) previous.add((sub, o));
      if (previous.length == 6) break;
    }

    return RefreshIndicator(
      onRefresh: () async {
        await Future.wait([data.load(), store.refresh()]);
      },
      child: CustomScrollView(slivers: [
        SliverToBoxAdapter(child: _Header(session: session, unread: store.unreadNotifications)),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          sliver: SliverList.list(children: [
            // Accepted orders are announced first so the customer sees it right away.
            for (final o in open.where((x) => x.status == 'accepted'))
              Padding(padding: const EdgeInsets.only(bottom: 12), child: _ActiveOrderCard(order: o)),
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
            // 2) Ads: top banner 3:1 (auto-sliding) and the popup card once per launch.
            const PopupAdHost(),
            const AdBanner(placement: 'top_banner', padding: EdgeInsets.only(top: 18)),
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
            // 4) Services ordered before, with one-tap re-order.
            if (previous.isNotEmpty) ...[
              const SectionTitle('طلبتها سابقاً'),
              SizedBox(
                height: 128,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: previous.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 10),
                  itemBuilder: (_, i) => _ReorderCard(sub: previous[i].$1, last: previous[i].$2),
                ),
              ),
            ],
            if (open.any((x) => x.status != 'accepted')) ...[
              const SectionTitle('طلبك الجاري'),
              for (final o in open.where((x) => x.status != 'accepted').take(2)) Padding(padding: const EdgeInsets.only(bottom: 10), child: _ActiveOrderCard(order: o)),
            ],
            // 5) Bottom ad space (4:1).
            const AdBanner(placement: 'bottom_banner', padding: EdgeInsets.only(top: 18)),
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
          const AppLogo(height: 34),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(p == null ? 'أهلاً بك في مهمة' : 'مرحباً، ${p.firstName}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
              CurrentLocationLine(fallback: p?.region),
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

class _ActiveOrderCard extends StatelessWidget {
  const _ActiveOrderCard({required this.order});
  final CustomerOrder order;

  @override
  Widget build(BuildContext context) {
    final c = statusColor(order.status);
    if (order.status == 'accepted') {
      return Material(
        borderRadius: BorderRadius.circular(20),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => OrderDetailPage(orderId: order.id))),
          child: Ink(
            decoration: BoxDecoration(gradient: LinearGradient(colors: [Brand.success, Brand.success.withValues(alpha: 0.82)])),
            padding: const EdgeInsets.all(14),
            child: Row(children: [
              const CircleAvatar(radius: 24, backgroundColor: Colors.white, child: Icon(Icons.check_rounded, color: Brand.success, size: 30)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('تم قبول طلبك', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16)),
                  Text('${order.title}${order.providerName != null ? ' • ${order.providerName}' : ''}', maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: Colors.white, fontSize: 13)),
                  const Text('اضغط لمتابعة الطلب ومراسلة مقدم الخدمة', style: TextStyle(color: Colors.white70, fontSize: 11.5)),
                ]),
              ),
              if (order.unread > 0) Badge(label: Text('${order.unread}'), child: const Icon(Icons.chat_outlined, color: Colors.white)),
              const Icon(Icons.chevron_left_outlined, color: Colors.white),
            ]),
          ),
        ),
      );
    }
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

class _ReorderCard extends StatelessWidget {
  const _ReorderCard({required this.sub, required this.last});
  final SubService sub;
  final CustomerOrder last;

  @override
  Widget build(BuildContext context) {
    final parent = PublicScope.of(context).serviceById(sub.serviceId);
    final (fg, bg) = serviceColors(sub.color ?? parent?.color);
    void reorder() => Navigator.push(context, MaterialPageRoute(builder: (_) => NewOrderPage(sub: sub)));
    return AccentBox(
      width: 190,
      accent: fg,
      padding: const EdgeInsets.fromLTRB(12, 14, 12, 10),
      onTap: reorder,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(color: bg.withValues(alpha: 0.6), shape: BoxShape.circle),
            child: Icon(serviceIcon(sub.icon ?? parent?.icon), color: fg, size: 21),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(sub.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
              Text(statusLabel(last.status, mode: last.mode), maxLines: 1, style: const TextStyle(fontSize: 11, color: Brand.mutedFg)),
            ]),
          ),
        ]),
        const Spacer(),
        SizedBox(
          width: double.infinity,
          height: 34,
          child: OutlinedButton.icon(
            onPressed: reorder,
            style: OutlinedButton.styleFrom(
              padding: EdgeInsets.zero,
              foregroundColor: fg,
              side: BorderSide(color: fg.withValues(alpha: 0.5)),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              minimumSize: const Size(0, 34),
            ),
            icon: const Icon(Icons.replay_outlined, size: 17),
            label: const Text('اطلبها مجدداً', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
          ),
        ),
      ]),
    );
  }
}
