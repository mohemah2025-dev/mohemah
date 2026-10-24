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
              prefixIcon: const Icon(Icons.search_rounded),
              suffixIcon: _query.isEmpty
                  ? null
                  : IconButton(
                      onPressed: () => setState(() {
                        _q.clear();
                        _query = '';
                      }),
                      icon: const Icon(Icons.close_rounded),
                    ),
            ),
          ),
          const SizedBox(height: 14),
          if (!data.loaded)
            const Loading()
          else if (services.isEmpty)
            const EmptyState(icon: Icons.design_services_outlined, title: 'لا توجد خدمات متاحة حالياً', message: 'عُد قريباً')
          else if (matchingServices.isEmpty)
            const EmptyState(icon: Icons.search_off_rounded, title: 'لا توجد نتائج', message: 'جرّب كلمة أخرى')
          else ...[
            if (matchingSubs.isNotEmpty) ...[
              const SectionTitle('مهام مطابقة', padding: EdgeInsets.fromLTRB(4, 0, 4, 8)),
              for (final s in matchingSubs.take(6)) Padding(padding: const EdgeInsets.only(bottom: 8), child: SubServiceTile(sub: s)),
              const SectionTitle('الأقسام'),
            ],
            for (final s in matchingServices)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: AppCard(
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ServiceDetailPage(service: s))),
                  child: Row(children: [
                    ServiceIcon(icon: s.icon, color: s.color, size: 52),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(s.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15.5)),
                        if ((s.description ?? '').isNotEmpty)
                          Text(s.description!, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Brand.mutedFg, fontSize: 12.5, height: 1.4)),
                        const SizedBox(height: 4),
                        Pill('${data.subsOf(s.id).length} مهمة', icon: Icons.checklist_rounded),
                      ]),
                    ),
                    const Icon(Icons.chevron_left_rounded, color: Brand.mutedFg),
                  ]),
                ),
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
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(22)),
          child: Row(children: [
            Container(
              width: 60,
              height: 60,
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18)),
              child: Icon(serviceIcon(service.icon), color: fg, size: 32),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(service.name, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: fg)),
                Text(service.description?.isNotEmpty == true ? service.description! : 'اختر المهمة المطلوبة',
                    style: const TextStyle(color: Brand.foreground, fontSize: 13, height: 1.5)),
              ]),
            ),
          ]),
        ),
        const SectionTitle('اختر المهمة المطلوبة'),
        if (subs.isEmpty)
          const EmptyState(icon: Icons.hourglass_empty_rounded, title: 'لا توجد مهام في هذا القسم بعد')
        else
          for (final s in subs) Padding(padding: const EdgeInsets.only(bottom: 8), child: SubServiceTile(sub: s, parent: service)),
      ]),
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
              if (sub.deliveryMode != 'remote') const Pill('حضوري', icon: Icons.home_work_rounded),
              if (sub.deliveryMode != 'in_person') const Pill('عن بُعد', icon: Icons.videocam_rounded),
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
