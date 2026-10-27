import 'dart:math' as math;

import 'package:flutter/material.dart' hide Text;
import 'package:mohemah_core/mohemah_core.dart';

import '../provider_store.dart';
import 'account_tab.dart';
import 'home_tab.dart';

/// Performance from real orders: counts, rating, work hours, last 7 days, services.
class ActivityTab extends StatelessWidget {
  const ActivityTab({super.key});

  @override
  Widget build(BuildContext context) {
    final store = ProviderScope.of(context);
    final s = store.stats;
    return Scaffold(
      appBar: PageHeader.bar('نشاطي'),
      body: RefreshIndicator(
        onRefresh: store.loadStats,
        child: s == null
            ? ListView(children: const [Loading()])
            : ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 30), children: [
                GridView.count(
                  crossAxisCount: 2,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 10,
                  crossAxisSpacing: 10,
                  childAspectRatio: 1.75,
                  children: [
                    _Stat(icon: Icons.task_alt_outlined, color: Brand.success, value: fmtNum(s.completed), label: 'طلب مكتمل'),
                    _Stat(
                      icon: Icons.star_rounded,
                      color: const Color(0xFFE0A100),
                      value: s.ratingCount == 0 ? '—' : s.rating.toStringAsFixed(1),
                      label: 'التقييم (${s.ratingCount})',
                      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const RatingsPage())),
                    ),
                    _Stat(icon: Icons.timer_outlined, color: Brand.primaryDeep, value: fmtNum(s.workHours), label: 'ساعة عمل'),
                    _Stat(icon: Icons.handyman_outlined, color: Brand.sky, value: fmtNum(s.active), label: 'طلب جارٍ'),
                  ],
                ),
                const SizedBox(height: 14),
                _WeeklyChart(weekly: s.weekly),
                const SizedBox(height: 14),
                if (s.servicesBreakdown.isNotEmpty) ...[
                  AppCard(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Text('الطلبات المكتملة حسب الخدمة', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                      const SizedBox(height: 10),
                      for (final r in s.servicesBreakdown)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 5),
                          child: Row(children: [
                            Expanded(flex: 3, child: Text(jS(r['name']), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
                            Expanded(
                              flex: 4,
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(6),
                                child: LinearProgressIndicator(
                                  value: s.completed == 0 ? 0.0 : jInt(r['count']) / s.completed,
                                  minHeight: 8,
                                  backgroundColor: Brand.muted,
                                ),
                              ),
                            ),
                            SizedBox(width: 34, child: Text('${jInt(r['count'])}', textAlign: TextAlign.end, style: const TextStyle(fontWeight: FontWeight.w800))),
                          ]),
                        ),
                    ]),
                  ),
                  const SizedBox(height: 14),
                ],
                DemandChart(data: s.demandByHour),
                const SizedBox(height: 14),
                if (s.cancelled > 0)
                  Text('الطلبات الملغاة: ${s.cancelled}', textAlign: TextAlign.center, style: const TextStyle(color: Brand.mutedFg, fontSize: 12)),
                if (s.joinedAt != null)
                  Text('مقدم خدمة منذ ${fmtDate(s.joinedAt)}', textAlign: TextAlign.center, style: const TextStyle(color: Brand.mutedFg, fontSize: 12)),
              ]),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.icon, required this.color, required this.value, required this.label, this.onTap});
  final IconData icon;
  final Color color;
  final String value;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => AppCard(
        onTap: onTap,
        padding: const EdgeInsets.all(14),
        child: Row(children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(13)),
            child: Icon(icon, color: color),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
              FittedBox(child: Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, height: 1.1))),
              Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11.5, color: Brand.mutedFg)),
            ]),
          ),
        ]),
      );
}

class _WeeklyChart extends StatelessWidget {
  const _WeeklyChart({required this.weekly});
  final Map<String, int> weekly;

  @override
  Widget build(BuildContext context) {
    // Riyadh is UTC+3 all year; the server groups completed orders by Riyadh day.
    final today = DateTime.now().toUtc().add(const Duration(hours: 3));
    final days = [for (var i = 6; i >= 0; i--) today.subtract(Duration(days: i))];
    final values = [for (final d in days) weekly['${d.year}-${two(d.month)}-${two(d.day)}'] ?? 0];
    final maxV = values.fold<int>(0, math.max);
    final total = values.fold<int>(0, (a, b) => a + b);
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Expanded(child: Text('آخر 7 أيام', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15))),
          Text('$total طلب مكتمل', style: const TextStyle(color: Brand.mutedFg, fontSize: 12)),
        ]),
        const SizedBox(height: 14),
        SizedBox(
          height: 130,
          child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
            for (var i = 0; i < days.length; i++)
              Expanded(
                child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
                  Text('${values[i]}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 3),
                  Container(
                    width: 22,
                    height: maxV == 0 ? 4.0 : math.max(4.0, 84.0 * values[i] / maxV),
                    decoration: BoxDecoration(
                      color: i == days.length - 1 ? Brand.primaryDeep : Brand.primary.withValues(alpha: 0.4),
                      borderRadius: BorderRadius.circular(6),
                    ),
                  ),
                  const SizedBox(height: 5),
                  FittedBox(child: Text(weekdays[days[i].weekday - 1], style: const TextStyle(fontSize: 10.5, color: Brand.mutedFg))),
                ]),
              ),
          ]),
        ),
      ]),
    );
  }
}
