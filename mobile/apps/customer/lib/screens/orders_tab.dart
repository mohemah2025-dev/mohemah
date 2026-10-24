import 'package:flutter/material.dart';
import 'package:mohemah_core/mohemah_core.dart';

import '../orders_store.dart';
import 'auth_page.dart';
import 'order_detail_page.dart';
import 'shell.dart';

class OrdersTab extends StatefulWidget {
  const OrdersTab({super.key});
  @override
  State<OrdersTab> createState() => _OrdersTabState();
}

class _OrdersTabState extends State<OrdersTab> {
  int _seg = 0;

  @override
  Widget build(BuildContext context) {
    final session = SessionScope.of(context);
    final store = OrdersScope.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('طلباتي')),
      body: !session.signedIn
          ? EmptyState(
              icon: Icons.receipt_long_rounded,
              title: 'سجّل دخولك لعرض طلباتك ومتابعتها',
              action: FilledButton(
                style: FilledButton.styleFrom(minimumSize: const Size(180, 48)),
                onPressed: () => ensureSignedIn(context),
                child: const Text('تسجيل الدخول'),
              ),
            )
          : Column(children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                child: AuthTabs(
                  index: _seg,
                  labels: ['الجارية (${store.open.length})', 'السابقة'],
                  onChanged: (i) => setState(() => _seg = i),
                ),
              ),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: store.refresh,
                  child: store.orders == null
                      ? (store.error != null ? ListView(children: [ErrorRetry(message: store.error!, onRetry: store.refresh)]) : const Loading())
                      : _List(orders: _seg == 0 ? store.open : store.past, open: _seg == 0),
                ),
              ),
            ]),
    );
  }
}

class _List extends StatelessWidget {
  const _List({required this.orders, required this.open});
  final List<CustomerOrder> orders;
  final bool open;

  @override
  Widget build(BuildContext context) {
    if (orders.isEmpty) {
      return ListView(children: [
        EmptyState(
          icon: open ? Icons.inbox_rounded : Icons.history_rounded,
          title: open ? 'لا توجد طلبات جارية' : 'لا توجد طلبات سابقة',
          action: open
              ? FilledButton.icon(
                  style: FilledButton.styleFrom(minimumSize: const Size(200, 48)),
                  onPressed: () => CustomerShell.goTo(1),
                  icon: const Icon(Icons.add_rounded),
                  label: const Text('اطلب مهمة جديدة'),
                )
              : null,
        ),
      ]);
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
      itemCount: orders.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (_, i) => OrderCard(order: orders[i]),
    );
  }
}

class OrderCard extends StatelessWidget {
  const OrderCard({super.key, required this.order});
  final CustomerOrder order;

  @override
  Widget build(BuildContext context) {
    final data = PublicScope.of(context);
    final svc = data.serviceById(order.serviceId);
    return AppCard(
      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => OrderDetailPage(orderId: order.id))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          ServiceIcon(icon: svc?.icon, color: svc?.color, size: 44),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(order.title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
              Text('#${order.orderNo} • ${fmtDate(order.createdAt)}', style: const TextStyle(color: Brand.mutedFg, fontSize: 12)),
            ]),
          ),
          StatusChip(status: order.status, mode: order.mode),
        ]),
        if (order.providerName != null || order.unread > 0) ...[
          const SizedBox(height: 10),
          const Divider(),
          const SizedBox(height: 8),
          Row(children: [
            const Icon(Icons.engineering_rounded, size: 18, color: Brand.mutedFg),
            const SizedBox(width: 6),
            Expanded(child: Text(order.providerName ?? 'بانتظار مقدم خدمة', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
            if (order.rating != null) Stars(value: order.rating!.toDouble(), size: 14),
            if (order.unread > 0) Pill('${order.unread} رسالة جديدة', icon: Icons.chat_rounded, color: Brand.primary, background: const Color(0xFFE5EDFB)),
          ]),
        ],
      ]),
    );
  }
}
