import 'package:flutter/material.dart' hide Text;
import 'package:mohemah_core/mohemah_core.dart';

import '../provider_store.dart';
import 'account_tab.dart';

/// Coins balance, subscription plans and the billing mode used when accepting orders.
class BillingPage extends StatefulWidget {
  const BillingPage({super.key});
  @override
  State<BillingPage> createState() => _BillingPageState();
}

class _BillingPageState extends State<BillingPage> {
  Billing? _b;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final b = Billing(jMap(await ProviderScope.read(context).api.get('/api/provider/billing')));
      if (mounted) setState(() => _b = b);
    } catch (e) {
      if (mounted) setState(() => _error = errMsg(e));
    }
  }

  Future<String?> _pickGateway(Billing b) async {
    final gws = b.gateways;
    if (gws.isEmpty) {
      showSnack(context, 'لا توجد وسيلة دفع مفعّلة حالياً', error: true);
      return null;
    }
    if (gws.length == 1) return gws.first.id;
    return showModalBottomSheet<String>(
      context: context,
      builder: (c) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('وسيلة الدفع', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          for (final g in gws)
            ListTile(
              leading: const Icon(Icons.credit_card_outlined),
              title: Text(g.name),
              trailing: g.testMode ? const Pill('تجريبي') : null,
              onTap: () => Navigator.pop(c, g.id),
            ),
          const SizedBox(height: 8),
        ]),
      ),
    );
  }

  Future<void> _after(String message) async {
    final store = ProviderScope.read(context);
    await _load();
    await store.refresh();
    await store.session.refresh().catchError((_) {});
    if (mounted) showSnack(context, message);
  }

  /// Real gateway (Moyasar / Tap): opens the payment page, then the provider confirms from a dialog.
  Future<bool> _maybePayOnline(dynamic r, String successMessage) async {
    if (r is! Map || r['payment_url'] == null) return false;
    final id = '${r['payment_id']}';
    if (!mounted) return true;
    await openUrl(context, '${r['payment_url']}');
    if (!mounted) return true;
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        var checking = false;
        return StatefulBuilder(
          builder: (ctx, setD) => AlertDialog(
            title: const Text('إتمام الدفع'),
            content: Text('أكمل الدفع (${r['amount']} ريال) في الصفحة التي فُتحت، ثم ارجع واضغط «تحقق من الدفع».'),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('لاحقاً')),
              FilledButton(
                onPressed: checking
                    ? null
                    : () async {
                        setD(() => checking = true);
                        try {
                          final p = await ProviderScope.read(context).api.get('/api/provider/payments/$id');
                          final st = p is Map ? p['status'] : null;
                          if (st == 'paid') {
                            if (ctx.mounted) Navigator.pop(ctx);
                            await _after(successMessage);
                            return;
                          }
                          if (ctx.mounted) showSnack(ctx, st == 'failed' ? 'لم تتم عملية الدفع' : 'لم يصل تأكيد الدفع بعد، حاول بعد لحظات', error: st == 'failed');
                          if (st == 'failed' && ctx.mounted) Navigator.pop(ctx);
                        } catch (e) {
                          if (ctx.mounted) showError(ctx, e);
                        }
                        if (ctx.mounted) setD(() => checking = false);
                      },
                child: Text(checking ? 'جارٍ التحقق…' : 'تحقق من الدفع'),
              ),
            ],
          ),
        );
      },
    );
    return true;
  }

  Future<void> _topup(Billing b, int coins) async {
    final gw = await _pickGateway(b);
    if (gw == null || !mounted) return;
    try {
      final r = await ProviderScope.read(context).api.post('/api/provider/topup', {'coins': coins, 'gateway_id': gw});
      if (await _maybePayOnline(r, 'تمت إضافة $coins كوين لرصيدك')) return;
      await _after('تمت إضافة $coins كوين لرصيدك');
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  Future<void> _subscribe(Billing b, int months) async {
    final gw = await _pickGateway(b);
    if (gw == null || !mounted) return;
    try {
      final r = await ProviderScope.read(context).api.post('/api/provider/subscribe', {'months': months, 'gateway_id': gw});
      if (await _maybePayOnline(r, 'تم الدفع وتفعيل اشتراكك')) return;
      await _after('تم تفعيل اشتراكك');
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  Future<void> _setMode(String mode) async {
    try {
      await ProviderScope.read(context).api.post('/api/provider/billing-mode', {'mode': mode});
      await _after(mode == 'coins' ? 'سيتم الخصم من الكوينز عند قبول الطلبات' : 'سيُستخدم الاشتراك عند قبول الطلبات');
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final b = _b;
    return Scaffold(
      appBar: PageHeader.bar(
        'الرصيد والاشتراك',
        trailing: IconButton(
          tooltip: tr('سجل العمليات'),
          onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const TransactionsPage())),
          icon: const Icon(Icons.receipt_long_outlined),
        ),
      ),
      body: _error != null && b == null
          ? ErrorRetry(message: _error!, onRetry: _load)
          : b == null
              ? const Loading()
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 30), children: [
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(gradient: Brand.providerGradient, borderRadius: BorderRadius.circular(24)),
                      child: Row(children: [
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            const Text('رصيد الكوينز', style: TextStyle(color: Colors.white70)),
                            Text('${b.balance}', style: const TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.w800, height: 1.2)),
                            Text(
                              b.subscriptionEnd != null ? 'اشتراك فعّال حتى ${fmtDate(b.subscriptionEnd)}' : 'لا يوجد اشتراك فعّال',
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                            ),
                          ]),
                        ),
                        const Icon(Icons.toll_outlined, color: Colors.white, size: 54),
                      ]),
                    ),
                    if (b.testPayments) ...[
                      const SizedBox(height: 10),
                      const AppCard(
                        color: Color(0xFFFBF1DA),
                        padding: EdgeInsets.all(12),
                        child: Row(children: [
                          Icon(Icons.science_outlined, color: Brand.warning),
                          SizedBox(width: 8),
                          Expanded(child: Text('وضع الدفع التجريبي: لا يتم خصم أي مبلغ حقيقي.', style: TextStyle(fontSize: 12.5))),
                        ]),
                      ),
                    ],
                    if (b.coinsEnabled && b.subscriptionEnabled) ...[
                      const SectionTitle('طريقة الدفع عند قبول الطلبات'),
                      SegmentedButton<String>(
                        showSelectedIcon: false,
                        segments: const [
                          ButtonSegment(value: 'coins', label: Text('الكوينز'), icon: Icon(Icons.toll_outlined)),
                          ButtonSegment(value: 'subscription', label: Text('الاشتراك'), icon: Icon(Icons.event_available_outlined)),
                        ],
                        selected: {b.mode},
                        onSelectionChanged: (v) => _setMode(v.first),
                      ),
                      const Padding(
                        padding: EdgeInsets.only(top: 6),
                        child: Text('الاشتراك الفعّال يغطي قبول الطلبات دائماً.', style: TextStyle(fontSize: 11.5, color: Brand.mutedFg)),
                      ),
                    ],
                    if (b.promotions.isNotEmpty) ...[const SizedBox(height: 12), PromoBanner(promos: b.promotions)],
                    if (b.coinsEnabled) ...[
                      const SectionTitle('شحن الكوينز'),
                      GridView.count(
                        crossAxisCount: 2,
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        mainAxisSpacing: 10,
                        crossAxisSpacing: 10,
                        childAspectRatio: 2.2,
                        children: [
                          for (final c in const [50, 100, 250, 500])
                            AppCard(
                              onTap: () => _topup(b, c),
                              padding: const EdgeInsets.all(12),
                              child: Row(children: [
                                const Icon(Icons.add_circle_outlined, color: Brand.primaryDeep),
                                const SizedBox(width: 8),
                                Text('$c كوين', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                              ]),
                            ),
                        ],
                      ),
                    ],
                    if (b.subscriptionEnabled) ...[
                      const SectionTitle('باقات الاشتراك'),
                      for (final e in b.plans.entries.where((e) => (b.plansOriginal[e.key] ?? 0) > 0))
                        Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: AppCard(
                            onTap: () => _subscribe(b, e.key),
                            child: Row(children: [
                              CircleAvatar(
                                radius: 22,
                                backgroundColor: Brand.primaryDeep.withValues(alpha: 0.1),
                                child: Text('${e.key}', style: const TextStyle(fontWeight: FontWeight.w800, color: Brand.primaryDeep, fontSize: 17)),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Text(e.key == 1 ? 'شهر واحد' : e.key == 12 ? 'سنة كاملة' : '${e.key} أشهر', style: const TextStyle(fontWeight: FontWeight.w800)),
                                  if (e.key > 1 && (b.plans[1] ?? 0) > 0 && e.value < b.plans[1]! * e.key)
                                    Text('وفّر ${((1 - e.value / (b.plans[1]! * e.key)) * 100).round()}%', style: const TextStyle(fontSize: 11.5, color: Brand.success, fontWeight: FontWeight.w700)),
                                ]),
                              ),
                              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                                if ((b.plansOriginal[e.key] ?? 0) > e.value)
                                  Text('${fmtNum(b.plansOriginal[e.key]!)} ر.س', style: const TextStyle(fontSize: 11.5, color: Brand.mutedFg, decoration: TextDecoration.lineThrough)),
                                Text(e.value == 0 ? 'مجاناً' : '${fmtNum(e.value)} ر.س', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Brand.primaryDeep)),
                              ]),
                            ]),
                          ),
                        ),
                    ],
                    if (!b.coinsEnabled && !b.subscriptionEnabled)
                      const EmptyState(icon: Icons.money_off_outlined, title: 'قبول الطلبات مجاني حالياً'),
                    const PolicyLink(audience: 'providers', placement: 'billing', prefix: 'بالشحن أو الاشتراك أنت توافق على '),
                  ]),
                ),
    );
  }
}
