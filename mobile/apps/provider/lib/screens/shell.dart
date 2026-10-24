import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mohemah_core/mohemah_core.dart';

import '../provider_store.dart';
import 'account_tab.dart';
import 'activity_tab.dart';
import 'billing_page.dart';
import 'home_tab.dart';
import 'orders_tab.dart';

/// Bottom tabs of the provider app + the pop-up for newly arrived orders.
class ProviderShell extends StatefulWidget {
  const ProviderShell({super.key});

  static final ValueNotifier<int> tab = ValueNotifier<int>(0);

  /// Orders tab sub-section to open (0 available, 1 active, 2 history).
  static final ValueNotifier<int> ordersSection = ValueNotifier<int>(0);

  static void goTo(int index, {int? section}) {
    rootNavigator.currentState?.popUntil((r) => r.isFirst);
    if (section != null) ordersSection.value = section;
    tab.value = index;
  }

  @override
  State<ProviderShell> createState() => _ProviderShellState();
}

class _ProviderShellState extends State<ProviderShell> {
  bool _dialogOpen = false;
  ProviderStore? _store;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final store = ProviderScope.read(context);
    if (!identical(store, _store)) {
      _store?.removeListener(_maybeShowIncoming);
      _store = store;
      store.addListener(_maybeShowIncoming);
      store.onIncoming = (_) {
        HapticFeedback.heavyImpact();
        SystemSound.play(SystemSoundType.alert);
      };
    }
  }

  @override
  void dispose() {
    _store?.removeListener(_maybeShowIncoming);
    super.dispose();
  }

  void _maybeShowIncoming() {
    final store = _store;
    if (store == null || _dialogOpen || store.incoming.isEmpty || !mounted) return;
    final nav = rootNavigator.currentContext;
    if (nav == null) return;
    _dialogOpen = true;
    final order = store.incoming.first;
    showGeneralDialog<void>(
      context: nav,
      barrierDismissible: false,
      barrierColor: Colors.black54,
      transitionDuration: const Duration(milliseconds: 280),
      pageBuilder: (_, __, ___) => IncomingOrderDialog(order: order, store: store),
      transitionBuilder: (_, a, __, child) => SlideTransition(
        position: Tween(begin: const Offset(0, 0.25), end: Offset.zero).animate(CurvedAnimation(parent: a, curve: Curves.easeOutCubic)),
        child: FadeTransition(opacity: a, child: child),
      ),
    ).whenComplete(() {
      _dialogOpen = false;
      store.dismissIncoming(order.id);
    });
  }

  @override
  Widget build(BuildContext context) {
    final feed = ProviderScope.of(context).feed;
    final available = feed?.available.length ?? 0;
    final active = feed?.active.length ?? 0;
    return ValueListenableBuilder<int>(
      valueListenable: ProviderShell.tab,
      builder: (context, index, _) => Scaffold(
        body: IndexedStack(index: index, children: const [ProviderHomeTab(), ProviderOrdersTab(), ActivityTab(), ProviderAccountTab()]),
        bottomNavigationBar: NavigationBar(
          selectedIndex: index,
          onDestinationSelected: (i) => ProviderShell.tab.value = i,
          destinations: [
            const NavigationDestination(icon: Icon(Icons.radio_button_checked_outlined), selectedIcon: Icon(Icons.radio_button_checked_rounded), label: 'الرئيسية'),
            NavigationDestination(
              icon: Badge(isLabelVisible: available + active > 0, label: Text('${available + active}'), child: const Icon(Icons.assignment_outlined)),
              selectedIcon: Badge(isLabelVisible: available + active > 0, label: Text('${available + active}'), child: const Icon(Icons.assignment_rounded)),
              label: 'الطلبات',
            ),
            const NavigationDestination(icon: Icon(Icons.insights_outlined), selectedIcon: Icon(Icons.insights_rounded), label: 'نشاطي'),
            const NavigationDestination(icon: Icon(Icons.person_outline_rounded), selectedIcon: Icon(Icons.person_rounded), label: 'حسابي'),
          ],
        ),
      ),
    );
  }
}

/// Full-screen card for a new order with a 60-second countdown.
class IncomingOrderDialog extends StatefulWidget {
  const IncomingOrderDialog({super.key, required this.order, required this.store});
  final OfferedOrder order;
  final ProviderStore store;

  @override
  State<IncomingOrderDialog> createState() => _IncomingOrderDialogState();
}

class _IncomingOrderDialogState extends State<IncomingOrderDialog> {
  late final DateTime _start = widget.store.incomingAt[widget.order.id] ?? DateTime.now();
  Timer? _timer;
  bool _busy = false;

  Duration get _left {
    final l = incomingTtl - DateTime.now().difference(_start);
    return l.isNegative ? Duration.zero : l;
  }

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(milliseconds: 250), (_) {
      if (!mounted || _busy) return;
      final gone = !widget.store.incoming.any((o) => o.id == widget.order.id);
      if (_left == Duration.zero || gone) {
        _timer?.cancel();
        Navigator.of(context).pop();
        return;
      }
      setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _accept() async {
    setState(() => _busy = true);
    _timer?.cancel();
    final nav = Navigator.of(context);
    try {
      await widget.store.accept(widget.order.id);
      nav.pop();
      rootMessenger.currentState?.showSnackBar(const SnackBar(content: Text('تم قبول الطلب، تابع التنفيذ من الطلبات الجارية')));
      ProviderShell.goTo(1, section: 1);
    } on ApiException catch (e) {
      nav.pop();
      final root = rootNavigator.currentContext;
      if (e.status == 402 && root != null && root.mounted) {
        await showBillingPrompt(root, e.code);
      } else {
        rootMessenger.currentState?.showSnackBar(SnackBar(content: Text(e.message), backgroundColor: Brand.danger));
      }
    }
  }

  Future<void> _reject() async {
    setState(() => _busy = true);
    _timer?.cancel();
    final nav = Navigator.of(context);
    try {
      await widget.store.reject(widget.order.id);
    } catch (_) {}
    nav.pop();
  }

  @override
  Widget build(BuildContext context) {
    final o = widget.order;
    final secs = _left.inSeconds;
    return SafeArea(
      child: Align(
        alignment: Alignment.bottomCenter,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(26),
            clipBehavior: Clip.antiAlias,
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Container(
                decoration: const BoxDecoration(gradient: Brand.providerGradient),
                padding: const EdgeInsets.fromLTRB(18, 16, 18, 14),
                child: Row(children: [
                  const Icon(Icons.notifications_active_rounded, color: Colors.white, size: 28),
                  const SizedBox(width: 10),
                  const Expanded(child: Text('طلب جديد', style: TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w800))),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(20)),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      const Icon(Icons.timer_rounded, color: Colors.white, size: 16),
                      const SizedBox(width: 4),
                      Text('${secs}ث', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
                    ]),
                  ),
                ]),
              ),
              LinearProgressIndicator(value: _left.inMilliseconds / incomingTtl.inMilliseconds, minHeight: 4, backgroundColor: Brand.muted),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 14, 18, 6),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(o.title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                  if (o.subServiceName != null) Text(o.serviceName, style: const TextStyle(color: Brand.mutedFg)),
                  const SizedBox(height: 8),
                  Wrap(spacing: 6, runSpacing: 6, children: [
                    Pill(modeLabel(o.mode), icon: o.mode == 'remote' ? Icons.videocam_rounded : Icons.home_work_rounded),
                    if (o.region != null) Pill(o.region!, icon: Icons.location_on_rounded),
                    Pill(o.scheduledAt == null ? 'في أقرب وقت' : fmtDateTime(o.scheduledAt), icon: Icons.schedule_rounded),
                    Pill('${o.customerName} • ${o.customerRating.toStringAsFixed(1)}', icon: Icons.person_rounded),
                  ]),
                  if ((o.description ?? '').isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Text(o.description!, maxLines: 4, overflow: TextOverflow.ellipsis, style: const TextStyle(height: 1.6)),
                  ],
                ]),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 8, 14, 14),
                child: Row(children: [
                  Expanded(
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(foregroundColor: Brand.danger),
                      onPressed: _busy ? null : _reject,
                      child: const Text('رفض'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(backgroundColor: Brand.success),
                      onPressed: _busy ? null : _accept,
                      icon: _busy
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.check_rounded),
                      label: Text(widget.store.feed?.subscriptionEnd != null ? 'قبول' : 'قبول (${o.coinCost} كوين)'),
                    ),
                  ),
                ]),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

/// Explains why an order could not be accepted and offers to open billing.
Future<void> showBillingPrompt(BuildContext context, String code) async {
  final sub = code == 'subscription_required';
  final go = await confirm(
    context,
    title: sub ? 'تحتاج اشتراكاً فعّالاً' : 'رصيد الكوينز غير كافٍ',
    message: sub ? 'فعّل اشتراكك لقبول الطلبات.' : 'اشحن رصيدك أو فعّل اشتراكاً لقبول هذا الطلب.',
    ok: sub ? 'الاشتراك' : 'شحن الرصيد',
  );
  if (go && context.mounted) {
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const BillingPage()));
  }
}
