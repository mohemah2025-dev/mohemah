import 'package:flutter/material.dart';
import 'package:mohemah_core/mohemah_core.dart';

import '../orders_store.dart';
import 'auth_page.dart';
import 'new_order_page.dart';

/// All services with a search box; each opens its sub-services.
class ServicesTab extends StatefulWidget {
  const ServicesTab({super.key});
  @override
  State<ServicesTab> createState() => _ServicesTabState();
}

class _ServicesTabState extends State<ServicesTab> {
  final _q = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final data = PublicScope.of(context);
    final q = _query.trim();
    final services = data.services;
    final subs = data.subServices;
    final matchingSubs = q.isEmpty ? <SubService>[] : subs.where((s) => s.name.contains(q) || (s.description ?? '').contains(q)).toList();
    final matchingServices = q.isEmpty ? services : services.where((s) => s.name.contains(q) || matchingSubs.any((x) => x.serviceId == s.id)).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('الخدمات')),
      body: RefreshIndicator(
        onRefresh: data.load,
        child: ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 24), children: [
          TextField(
            controller: _q,
            onChanged: (v) => setState(() => _query = v),
            decoration: InputDecoration(
              hintText: 'ابحث عن خدمة',
              prefixIcon: const Icon(Icons.search_outlined),
              suffixIcon: _query.isEmpty
                  ? null
                  : IconButton(
                      onPressed: () => setState(() {
                        _q.clear();
                        _query = '';
                      }),
                      icon: const Icon(Icons.close_outlined),
                    ),
            ),
          ),
          const SizedBox(height: 14),
          if (!data.loaded)
            const Loading()
          else if (services.isEmpty)
            const EmptyState(icon: Icons.design_services_outlined, title: 'لا توجد خدمات متاحة حالياً', message: 'عُد قريباً')
          else if (matchingServices.isEmpty)
            const EmptyState(icon: Icons.search_off_outlined, title: 'لا توجد نتائج', message: 'جرّب كلمة أخرى')
          else ...[
            if (matchingSubs.isNotEmpty) ...[
              const SectionTitle('مهام مطابقة', padding: EdgeInsets.fromLTRB(4, 0, 4, 8)),
              for (final s in matchingSubs.take(6)) Padding(padding: const EdgeInsets.only(bottom: 8), child: SubServiceTile(sub: s)),
              const SectionTitle('الأقسام'),
            ],
            // Main services as rectangles, two per row.
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 1.25,
              children: [
                for (final s in matchingServices)
                  ServiceBox(
                    service: s,
                    subtitle: '${data.subsOf(s.id).length} مهمة',
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ServiceDetailPage(service: s))),
                  ),
              ],
            ),
          ],
        ]),
      ),
    );
  }
}

/// Sub-services of one service.
class ServiceDetailPage extends StatelessWidget {
  const ServiceDetailPage({super.key, required this.service});
  final Service service;

  @override
  Widget build(BuildContext context) {
    final subs = PublicScope.of(context).subsOf(service.id);
    final (fg, bg) = serviceColors(service.color);
    return Scaffold(
      appBar: AppBar(title: Text(service.name)),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 24), children: [
        // Banner: main service name, short description and its icon.
        Container(
          padding: const EdgeInsets.fromLTRB(20, 22, 20, 22),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            gradient: LinearGradient(begin: Alignment.topRight, end: Alignment.bottomLeft, colors: [bg, Color.lerp(bg, fg, 0.18)!]),
          ),
          child: Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(service.name, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 21, color: fg)),
                const SizedBox(height: 6),
                Text(service.description?.isNotEmpty == true ? service.description! : 'اختر المهمة المطلوبة وسيصل طلبك لمقدمي الخدمة فوراً',
                    style: const TextStyle(color: Brand.foreground, fontSize: 13, height: 1.6)),
                const SizedBox(height: 10),
                Pill('${subs.length} مهمة', icon: Icons.checklist_outlined),
              ]),
            ),
            const SizedBox(width: 12),
            Container(
              width: 84,
              height: 84,
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: [BoxShadow(color: fg.withValues(alpha: 0.15), blurRadius: 16, offset: const Offset(0, 6))],
              ),
              child: Icon(serviceIcon(service.icon), color: fg, size: 42),
            ),
          ]),
        ),
        const SectionTitle('اختر المهمة المطلوبة'),
        if (subs.isEmpty)
          const EmptyState(icon: Icons.hourglass_empty_outlined, title: 'لا توجد مهام في هذا القسم بعد')
        else
          for (final s in subs) Padding(padding: const EdgeInsets.only(bottom: 8), child: SubServiceTile(sub: s, parent: service)),
      ]),
    );
  }
}

/// A main service as a soft rectangle: icon on top, name below.
class ServiceBox extends StatelessWidget {
  const ServiceBox({super.key, required this.service, required this.onTap, this.subtitle, this.width});
  final Service service;
  final VoidCallback onTap;
  final String? subtitle;
  final double? width;

  @override
  Widget build(BuildContext context) {
    final (fg, bg) = serviceColors(service.color);
    return SizedBox(
      width: width,
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: onTap,
          child: Ink(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: bg, width: 1.4),
              gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [bg.withValues(alpha: 0.55), Colors.white]),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(serviceIcon(service.icon), color: fg, size: 32),
              const SizedBox(height: 8),
              Text(service.name, maxLines: 2, textAlign: TextAlign.center, overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, height: 1.3)),
              if (subtitle != null) Text(subtitle!, style: const TextStyle(fontSize: 11, color: Brand.mutedFg)),
            ]),
          ),
        ),
      ),
    );
  }
}

class SubServiceTile extends StatelessWidget {
  const SubServiceTile({super.key, required this.sub, this.parent});
  final SubService sub;
  final Service? parent;

  @override
  Widget build(BuildContext context) {
    final store = OrdersScope.of(context);
    final p = parent ?? PublicScope.of(context).serviceById(sub.serviceId);
    final fav = store.favorites.contains(sub.id);
    return AppCard(
      padding: const EdgeInsets.fromLTRB(14, 10, 6, 10),
      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => NewOrderPage(sub: sub))),
      child: Row(children: [
        ServiceIcon(icon: sub.icon ?? p?.icon, color: sub.color ?? p?.color, size: 44),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(sub.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5)),
            if ((sub.description ?? '').isNotEmpty)
              Text(sub.description!, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Brand.mutedFg, fontSize: 12)),
            const SizedBox(height: 4),
            Wrap(spacing: 6, children: [
              if (sub.deliveryMode != 'remote') const Pill('حضوري', icon: Icons.home_work_outlined),
              if (sub.deliveryMode != 'in_person') const Pill('عن بُعد', icon: Icons.videocam_outlined),
            ]),
          ]),
        ),
        IconButton(
          tooltip: fav ? 'إزالة من المفضلة' : 'إضافة للمفضلة',
          onPressed: () async {
            if (!await ensureSignedIn(context, reason: 'سجّل دخولك لحفظ خدماتك المفضلة') || !context.mounted) return;
            await OrdersScope.read(context).toggleFavorite(sub.id);
          },
          icon: Icon(fav ? Icons.star_rounded : Icons.star_outline_rounded, color: fav ? const Color(0xFFF2B01E) : Brand.mutedFg),
        ),
      ]),
    );
  }
}
