import 'package:flutter/material.dart';
import 'package:mohemah_core/mohemah_core.dart';

import '../orders_store.dart';
import 'new_order_page.dart';

/// Live order details: timeline, provider contact, chat, cancel, rating, complaint.
class OrderDetailPage extends StatelessWidget {
  const OrderDetailPage({super.key, required this.orderId});
  final String orderId;

  @override
  Widget build(BuildContext context) {
    final store = OrdersScope.of(context);
    CustomerOrder? order;
    for (final o in store.orders ?? const <CustomerOrder>[]) {
      if (o.id == orderId) order = o;
    }
    if (order == null) {
      return Scaffold(appBar: AppBar(title: const Text('تفاصيل الطلب')), body: const Loading());
    }
    final o = order;
    final svc = PublicScope.of(context).serviceById(o.serviceId);
    return Scaffold(
      appBar: AppBar(title: Text('طلب #${o.orderNo}')),
      body: RefreshIndicator(
        onRefresh: store.refresh,
        child: ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 30), children: [
          _StatusHeader(order: o),
          const SizedBox(height: 12),
          if (o.status != 'cancelled') _Timeline(order: o),
          if (o.status == 'cancelled')
            AppCard(
              color: const Color(0xFFFBEDEC),
              child: Text(
                o.cancelledBy == 'customer' ? 'ألغيت هذا الطلب${o.cancelReason != null ? ': ${o.cancelReason}' : ''}' : 'أُلغي الطلب${o.cancelReason != null ? ': ${o.cancelReason}' : ''}',
                style: const TextStyle(color: Brand.danger, fontWeight: FontWeight.w600),
              ),
            ),
          if (o.providerName != null) ...[
            const SectionTitle('مقدم الخدمة'),
            _ProviderCard(order: o),
          ],
          const SectionTitle('تفاصيل الطلب'),
          AppCard(
            child: Column(children: [
              Row(children: [
                ServiceIcon(icon: svc?.icon, color: svc?.color, size: 44),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(o.title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                    Text(o.serviceName, style: const TextStyle(color: Brand.mutedFg, fontSize: 12)),
                  ]),
                ),
                Pill(modeLabel(o.mode), icon: o.mode == 'remote' ? Icons.videocam_rounded : Icons.home_work_rounded),
              ]),
              const SizedBox(height: 8),
              const Divider(),
              if ((o.description ?? '').isNotEmpty) InfoRow(icon: Icons.notes_rounded, label: 'شرح الطلب', value: o.description!),
              if (o.region != null) InfoRow(icon: Icons.location_city_rounded, label: 'المدينة', value: o.region!),
              if ((o.address ?? '').isNotEmpty) InfoRow(icon: Icons.place_rounded, label: 'العنوان', value: o.address!),
              InfoRow(icon: Icons.schedule_rounded, label: 'موعد التنفيذ', value: o.scheduledAt == null ? 'في أقرب وقت' : fmtDateTime(o.scheduledAt)),
              InfoRow(icon: Icons.event_rounded, label: 'تاريخ الطلب', value: fmtDateTime(o.createdAt)),
            ]),
          ),
          if (o.rating != null) ...[
            const SectionTitle('تقييمك للخدمة'),
            AppCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Stars(value: o.rating!.toDouble(), size: 22),
                if ((o.review ?? '').isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text(o.review!, style: const TextStyle(height: 1.5))),
              ]),
            ),
          ],
          const SizedBox(height: 18),
          _Actions(order: o),
        ]),
      ),
    );
  }
}

class _StatusHeader extends StatelessWidget {
  const _StatusHeader({required this.order});
  final CustomerOrder order;

  @override
  Widget build(BuildContext context) {
    final c = statusColor(order.status);
    final hint = switch (order.status) {
      'pending' => 'طلبك ظاهر لمقدمي الخدمة في مدينتك، وسنُشعرك فور قبوله.',
      'accepted' => order.mode == 'remote' ? 'تواصل مع مقدم الخدمة لبدء التنفيذ.' : 'مقدم الخدمة في الطريق إليك.',
      'arrived' => 'مقدم الخدمة عند الباب.',
      'in_progress' => 'يجري تنفيذ طلبك الآن.',
      'completed' => order.rating == null ? 'اكتمل الطلب، شاركنا تقييمك.' : 'شكراً لتقييمك.',
      _ => '',
    };
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(color: c.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(22)),
      child: Row(children: [
        Container(width: 54, height: 54, decoration: BoxDecoration(color: c, shape: BoxShape.circle), child: Icon(statusIcon(order.status), color: Colors.white, size: 28)),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(statusLabel(order.status, mode: order.mode), style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: c)),
            if (hint.isNotEmpty) Text(hint, style: const TextStyle(fontSize: 13, height: 1.5)),
          ]),
        ),
      ]),
    );
  }
}

class _Timeline extends StatelessWidget {
  const _Timeline({required this.order});
  final CustomerOrder order;

  @override
  Widget build(BuildContext context) {
    final steps = statusSteps(order.mode);
    final current = steps.indexOf(order.status);
    final times = {
      'pending': order.createdAt,
      'accepted': order.acceptedAt,
      'arrived': order.arrivedAt,
      'in_progress': order.startedAt,
      'completed': order.completedAt,
    };
    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 14),
      child: Row(children: [
        for (var i = 0; i < steps.length; i++) ...[
          Expanded(
            child: Column(children: [
              Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(color: i <= current ? Brand.primary : Brand.muted, shape: BoxShape.circle),
                child: Icon(i < current ? Icons.check_rounded : statusIcon(steps[i]), size: 16, color: i <= current ? Colors.white : Brand.mutedFg),
              ),
              const SizedBox(height: 5),
              Text(_short(steps[i], order.mode), textAlign: TextAlign.center, style: TextStyle(fontSize: 10.5, fontWeight: i == current ? FontWeight.w800 : FontWeight.w500)),
              if (times[steps[i]] != null && i <= current) Text(fmtTime(times[steps[i]]!), style: const TextStyle(fontSize: 9.5, color: Brand.mutedFg)),
            ]),
          ),
        ],
      ]),
    );
  }

  static String _short(String s, String mode) => switch (s) {
        'pending' => 'أُرسل',
        'accepted' => 'قُبل',
        'arrived' => 'وصل',
        'in_progress' => 'التنفيذ',
        'completed' => 'اكتمل',
        _ => s,
      };
}

class _ProviderCard extends StatelessWidget {
  const _ProviderCard({required this.order});
  final CustomerOrder order;

  @override
  Widget build(BuildContext context) {
    final name = order.providerName ?? '';
    final chatOpen = order.isActive || order.status == 'completed';
    return AppCard(
      child: Column(children: [
        Row(children: [
          Avatar(name: name, url: order.providerAvatar, radius: 26),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
              Row(children: [
                Stars(value: order.providerRating, size: 14),
                const SizedBox(width: 4),
                Text('${order.providerRating.toStringAsFixed(1)} (${order.providerRatingCount})', style: const TextStyle(fontSize: 11.5, color: Brand.mutedFg)),
              ]),
            ]),
          ),
        ]),
        if (chatOpen) ...[
          const SizedBox(height: 12),
          Row(children: [
            if (order.providerPhone != null) ...[
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => callPhone(context, order.providerPhone!),
                  icon: const Icon(Icons.call_rounded),
                  label: const Text('اتصال'),
                ),
              ),
              const SizedBox(width: 10),
            ],
            Expanded(
              child: FilledButton.icon(
                onPressed: () async {
                  await Navigator.push(context, MaterialPageRoute(builder: (_) => OrderChatPage(orderId: order.id, title: 'محادثة مع $name')));
                  if (context.mounted) await OrdersScope.read(context).refresh();
                },
                icon: Badge(isLabelVisible: order.unread > 0, label: Text('${order.unread}'), child: const Icon(Icons.chat_rounded)),
                label: const Text('مراسلة'),
              ),
            ),
          ]),
        ],
      ]),
    );
  }
}

class _Actions extends StatelessWidget {
  const _Actions({required this.order});
  final CustomerOrder order;

  Future<void> _cancel(BuildContext context) async {
    final reason = await promptText(context, title: 'إلغاء الطلب', hint: 'سبب الإلغاء (اختياري)', ok: 'تأكيد الإلغاء', danger: true);
    if (reason == null || !context.mounted) return;
    final store = OrdersScope.read(context);
    try {
      await store.session.api.post('/api/orders/${order.id}/cancel', {if (reason.isNotEmpty) 'reason': reason});
      await store.refresh();
      if (context.mounted) showSnack(context, 'تم إلغاء الطلب');
    } catch (e) {
      if (context.mounted) showError(context, e);
    }
  }

  Future<void> _rate(BuildContext context) async {
    final r = await askRating(context, title: 'كيف كانت الخدمة؟');
    if (r == null || !context.mounted) return;
    final store = OrdersScope.read(context);
    try {
      await store.session.api.post('/api/orders/${order.id}/rate', {'rating': r.$1, if (r.$2 != null) 'review': r.$2});
      await store.refresh();
      if (context.mounted) showSnack(context, 'شكراً لتقييمك');
    } catch (e) {
      if (context.mounted) showError(context, e);
    }
  }

  Future<void> _complain(BuildContext context) async {
    final text = await promptText(context, title: 'شكوى على الطلب #${order.orderNo}', hint: 'اكتب تفاصيل الشكوى', ok: 'إرسال الشكوى', required: true);
    if (text == null || !context.mounted) return;
    try {
      await OrdersScope.read(context).session.api.post('/api/me/messages', {'subject': 'شكوى على الطلب #${order.orderNo}', 'body': text});
      if (context.mounted) showSnack(context, 'وصلت شكواك للإدارة، وسيتم الرد عليك في الرسائل');
    } catch (e) {
      if (context.mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = PublicScope.of(context);
    SubService? sub;
    for (final s in data.subServices) {
      if (s.name == order.subServiceName && s.serviceId == order.serviceId) sub = s;
    }
    final canCancel = order.status == 'pending' || order.status == 'accepted';
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (order.status == 'completed' && order.rating == null) ...[
        FilledButton.icon(onPressed: () => _rate(context), icon: const Icon(Icons.star_rounded), label: const Text('قيّم الخدمة')),
        const SizedBox(height: 10),
      ],
      if (canCancel) ...[
        OutlinedButton.icon(
          style: OutlinedButton.styleFrom(foregroundColor: Brand.danger),
          onPressed: () => _cancel(context),
          icon: const Icon(Icons.close_rounded),
          label: const Text('إلغاء الطلب'),
        ),
        const SizedBox(height: 10),
      ],
      if (!order.isOpen && sub != null) ...[
        OutlinedButton.icon(
          onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => NewOrderPage(sub: sub!, initialDescription: order.description))),
          icon: const Icon(Icons.replay_rounded),
          label: const Text('إعادة الطلب'),
        ),
        const SizedBox(height: 10),
      ],
      if (order.providerName != null)
        TextButton.icon(
          style: TextButton.styleFrom(foregroundColor: Brand.mutedFg),
          onPressed: () => _complain(context),
          icon: const Icon(Icons.report_outlined),
          label: const Text('شكوى'),
        ),
    ]);
  }
}
