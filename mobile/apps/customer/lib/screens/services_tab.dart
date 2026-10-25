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
      body: Column(children: [
        PageHeader(
          title: 'الخدمات',
          subtitle: 'اختر القسم ثم المهمة التي تحتاجها',
          bottom: TextField(
            controller: _q,
            onChanged: (v) => setState(() => _query = v),
            style: const TextStyle(color: Brand.foreground),
            decoration: InputDecoration(
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
              hintText: 'ابحث عن خدمة',
              prefixIcon: const Icon(Icons.search_outlined, color: Brand.mutedFg),
              suffixIcon: _query.isEmpty
                  ? null
                  : IconButton(
                      onPressed: () => setState(() {
                        _q.clear();
                        _query = '';
                      }),
                      icon: const Icon(Icons.close_outlined, color: Brand.mutedFg),
                    ),
            ),
          ),
        ),
        Expanded(
          child: RefreshIndicator(
        onRefresh: data.load,
        child: ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 24), children: [
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
        ),
      ]),
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
    return Scaffold(
      body: ListView(padding: EdgeInsets.zero, children: [
        // Full-width gradient banner like the home header: name, icon and description.
        PageHeader(
          title: service.name,
          subtitle: service.description?.isNotEmpty == true ? service.description! : 'اختر المهمة المطلوبة وسيصل طلبك لمقدمي الخدمة فوراً',
          watermark: serviceIcon(service.icon),
          bottom: Align(
            alignment: AlignmentDirectional.centerStart,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
              decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.18), borderRadius: BorderRadius.circular(20)),
              child: Text('${subs.length} مهمة متاحة', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const SectionTitle('اختر المهمة المطلوبة'),
        if (subs.isEmpty)
          const EmptyState(icon: Icons.hourglass_empty_outlined, title: 'لا توجد مهام في هذا القسم بعد')
        else
          for (final s in subs) Padding(padding: const EdgeInsets.only(bottom: 10), child: SubServiceTile(sub: s, parent: service)),
          ]),
        ),
      ]),
    );
  }
}

/// A main service as a white rectangle: coloured line on top, icon, then the name.
class ServiceBox extends StatelessWidget {
  const ServiceBox({super.key, required this.service, required this.onTap, this.subtitle, this.width});
  final Service service;
  final VoidCallback onTap;
  final String? subtitle;
  final double? width;

  @override
  Widget build(BuildContext context) {
    final (fg, bg) = serviceColors(service.color);
    return AccentBox(
      accent: fg,
      width: width,
      onTap: onTap,
      child: Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(color: bg.withValues(alpha: 0.6), shape: BoxShape.circle),
            child: Icon(serviceIcon(service.icon), color: fg, size: 25),
          ),
          const SizedBox(height: 8),
          Text(service.name, maxLines: 2, textAlign: TextAlign.center, overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, height: 1.3)),
          if (subtitle != null) Text(subtitle!, style: const TextStyle(fontSize: 11, color: Brand.mutedFg)),
        ]),
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
    final (fg, _) = serviceColors(sub.color ?? p?.color);
    return AccentBox(
      accent: fg,
      padding: const EdgeInsets.fromLTRB(14, 14, 6, 10),
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
