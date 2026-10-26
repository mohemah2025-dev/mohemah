import 'package:flutter/material.dart';
import 'package:mohemah_core/mohemah_core.dart';

import '../provider_store.dart';
import 'shell.dart';

class ProviderOrdersTab extends StatefulWidget {
  const ProviderOrdersTab({super.key});
  @override
  State<ProviderOrdersTab> createState() => _ProviderOrdersTabState();
}

class _ProviderOrdersTabState extends State<ProviderOrdersTab> {
  @override
  void initState() {
    super.initState();
    ProviderShell.ordersSection.addListener(_sectionChanged);
  }

  @override
  void dispose() {
    ProviderShell.ordersSection.removeListener(_sectionChanged);
    super.dispose();
  }

  void _sectionChanged() {
    if (ProviderShell.ordersSection.value == 2) _loadHistory();
    setState(() {});
  }

  Future<void> _loadHistory() async {
    try {
      await ProviderScope.read(context).loadHistory();
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final store = ProviderScope.of(context);
    final feed = store.feed;
    final section = ProviderShell.ordersSection.value;
    return Scaffold(
      appBar: PageHeader.bar('الطلبات'),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
          child: AuthTabs(
            index: section,
            labels: ['متاحة (${feed?.available.length ?? 0})', 'جارية (${feed?.active.length ?? 0})', 'سابقة'],
            onChanged: (i) => ProviderShell.ordersSection.value = i,
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () => section == 2 ? _loadHistory() : store.refresh(),
            child: feed == null
                ? (store.error != null ? ListView(children: [ErrorRetry(message: store.error!, onRetry: store.refresh)]) : const Loading())
                : switch (section) {
                    0 => _AvailableList(orders: feed.available, online: feed.online, servicesCount: feed.servicesCount, region: feed.region),
                    1 => _ActiveList(jobs: feed.active),
                    _ => _HistoryList(items: store.history, onLoad: _loadHistory),
                  },
          ),
        ),
      ]),
    );
  }
}

class _AvailableList extends StatelessWidget {
  const _AvailableList({required this.orders, required this.online, required this.servicesCount, this.region});
  final List<OfferedOrder> orders;
  final bool online;
  final int servicesCount;
  final String? region;

  @override
  Widget build(BuildContext context) {
    if (orders.isEmpty) {
      return ListView(children: [
        EmptyState(
          icon: Icons.inbox_outlined,
          title: 'لا توجد طلبات متاحة الآن',
          message: servicesCount == 0
              ? 'لم تفعّل أي خدمة بعد. من الرئيسية اضغط «خدماتي» وفعّل الخدمات التي تقدمها لتصلك طلباتها.'
              : online
                  ? 'ستظهر هنا الطلبات الجديدة في خدماتك ($servicesCount)${region != null ? ' داخل مدينة $region' : ''}.'
                  : 'اتصل من الصفحة الرئيسية لتصلك الطلبات الجديدة فور وصولها.',
        ),
      ]);
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
      itemCount: orders.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (_, i) => OfferCard(order: orders[i]),
    );
  }
}

class OfferCard extends StatelessWidget {
  const OfferCard({super.key, required this.order});
  final OfferedOrder order;

  @override
  Widget build(BuildContext context) {
    final store = ProviderScope.of(context);
    final o = order;
    final subscribed = store.feed?.subscriptionEnd != null;
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(o.title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15.5)),
              Text('#${o.orderNo} • ${timeAgo(o.createdAt)}', style: const TextStyle(color: Brand.mutedFg, fontSize: 12)),
            ]),
          ),
          if (!subscribed) Pill('${o.coinCost} كوين', icon: Icons.toll_outlined, color: Brand.warning, background: const Color(0xFFFBF1DA)),
        ]),
        const SizedBox(height: 8),
        Wrap(spacing: 6, runSpacing: 6, children: [
          Pill(modeLabel(o.mode), icon: o.mode == 'remote' ? Icons.videocam_outlined : Icons.home_work_outlined),
          if (o.region != null) Pill(o.region!, icon: Icons.location_on_outlined),
          Pill(o.scheduledAt == null ? 'في أقرب وقت' : fmtDateTime(o.scheduledAt), icon: Icons.schedule_outlined),
        ]),
        if ((o.description ?? '').isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(o.description!, maxLines: 3, overflow: TextOverflow.ellipsis, style: const TextStyle(height: 1.55, fontSize: 13.5)),
        ],
        if (o.attachments.isNotEmpty) ...[const SizedBox(height: 8), AttachmentStrip(items: o.attachments)],
        const SizedBox(height: 8),
        Row(children: [
          const Icon(Icons.person_outlined, size: 17, color: Brand.mutedFg),
          const SizedBox(width: 4),
          Text(o.customerName, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
          const SizedBox(width: 6),
          if (o.customerRatingCount > 0) Stars(value: o.customerRating, size: 13),
        ]),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(
            child: BusyButton(
              outlined: true,
              color: Brand.danger,
              label: 'رفض',
              onPressed: () async {
                try {
                  await store.reject(o.id);
                } catch (e) {
                  if (context.mounted) showError(context, e);
                }
              },
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            flex: 2,
            child: BusyButton(
              color: Brand.success,
              icon: Icons.check_outlined,
              label: 'قبول الطلب',
              onPressed: () async {
                try {
                  await store.accept(o.id);
                  if (context.mounted) showSnack(context, 'تم قبول الطلب');
                  ProviderShell.ordersSection.value = 1;
                } on ApiException catch (e) {
                  if (!context.mounted) return;
                  if (e.status == 402) {
                    await showBillingPrompt(context, e.code);
                  } else {
                    showSnack(context, e.message, error: true);
                  }
                }
              },
            ),
          ),
        ]),
      ]),
    );
  }
}

class _ActiveList extends StatelessWidget {
  const _ActiveList({required this.jobs});
  final List<ActiveJob> jobs;

  @override
  Widget build(BuildContext context) {
    if (jobs.isEmpty) {
      return ListView(children: const [EmptyState(icon: Icons.handyman_outlined, title: 'لا توجد طلبات جارية', message: 'الطلبات التي تقبلها تظهر هنا حتى اكتمالها.')]);
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
      itemCount: jobs.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, i) {
        final j = jobs[i];
        return AppCard(
          onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => JobDetailPage(jobId: j.id))),
          child: Row(children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(color: statusColor(j.status).withValues(alpha: 0.12), shape: BoxShape.circle),
              child: Icon(statusIcon(j.status), color: statusColor(j.status)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(j.title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                Text('${j.customerName} • #${j.orderNo}', style: const TextStyle(color: Brand.mutedFg, fontSize: 12)),
                const SizedBox(height: 4),
                StatusChip(status: j.status, mode: j.mode, provider: true),
              ]),
            ),
            if (j.unread > 0) Badge(label: Text('${j.unread}'), child: const Icon(Icons.chat_outlined, color: Brand.primary)),
            const Icon(Icons.chevron_left_outlined, color: Brand.mutedFg),
          ]),
        );
      },
    );
  }
}

/// Accepted job: customer contact, address, chat and the next step button.
class JobDetailPage extends StatelessWidget {
  const JobDetailPage({super.key, required this.jobId});
  final String jobId;

  static (String, IconData)? nextStep(ActiveJob j) {
    if (j.status == 'accepted' && j.mode == 'in_person') return ('وصلت إلى الموقع', Icons.door_front_door_outlined);
    if (j.status == 'accepted' || j.status == 'arrived') return ('بدء التنفيذ', Icons.play_arrow_outlined);
    if (j.status == 'in_progress') return ('إنهاء المهمة', Icons.task_alt_outlined);
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final store = ProviderScope.of(context);
    ActiveJob? job;
    for (final j in store.feed?.active ?? const <ActiveJob>[]) {
      if (j.id == jobId) job = j;
    }
    if (job == null) {
      return Scaffold(
        appBar: PageHeader.bar('الطلب'),
        body: EmptyState(
          icon: Icons.task_alt_outlined,
          title: 'لم يعد هذا الطلب ضمن الطلبات الجارية',
          message: 'اكتمل أو أُلغي. تجده في الطلبات السابقة.',
          action: FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size(200, 48)),
            onPressed: () => ProviderShell.goTo(1, section: 2),
            child: const Text('الطلبات السابقة'),
          ),
        ),
      );
    }
    final j = job;
    final step = nextStep(j);
    final canRelease = j.status == 'accepted' || j.status == 'arrived';

    return Scaffold(
      appBar: PageHeader.bar('طلب #${j.orderNo}'),
      body: RefreshIndicator(
        onRefresh: store.refresh,
        child: ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 30), children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(gradient: Brand.providerGradient, borderRadius: BorderRadius.circular(22)),
            child: Row(children: [
              Icon(statusIcon(j.status), color: Colors.white, size: 34),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(j.title, style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800)),
                  Text(statusLabel(j.status, mode: j.mode, provider: true), style: const TextStyle(color: Colors.white70)),
                ]),
              ),
              Pill(modeLabel(j.mode), color: Colors.white, background: Colors.white24),
            ]),
          ),
          const SectionTitle('العميل'),
          AppCard(
            child: Column(children: [
              Row(children: [
                CircleAvatar(
                  radius: 22,
                  backgroundColor: Brand.primary.withValues(alpha: 0.12),
                  child: Text(j.customerName.characters.first, style: const TextStyle(color: Brand.primary, fontWeight: FontWeight.w800)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(j.customerName, style: const TextStyle(fontWeight: FontWeight.w800)),
                    if (j.customerRating > 0) Stars(value: j.customerRating, size: 13),
                  ]),
                ),
              ]),
              const SizedBox(height: 12),
              Row(children: [
                if (j.customerPhone != null) ...[
                  Expanded(
                    child: OutlinedButton.icon(onPressed: () => callPhone(context, j.customerPhone!), icon: const Icon(Icons.call_outlined), label: const Text('اتصال')),
                  ),
                  const SizedBox(width: 10),
                ],
                Expanded(
                  child: FilledButton.icon(
                    onPressed: () async {
                      await Navigator.push(context, MaterialPageRoute(builder: (_) => OrderChatPage(orderId: j.id, title: 'محادثة مع ${j.customerName}')));
                      await store.refresh();
                    },
                    icon: Badge(isLabelVisible: j.unread > 0, label: Text('${j.unread}'), child: const Icon(Icons.chat_outlined)),
                    label: const Text('مراسلة'),
                  ),
                ),
              ]),
            ]),
          ),
          const SectionTitle('تفاصيل الطلب'),
          AppCard(
            child: Column(children: [
              if ((j.description ?? '').isNotEmpty) InfoRow(icon: Icons.notes_outlined, label: 'شرح الطلب', value: j.description!),
              if (j.attachments.isNotEmpty) Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: AttachmentStrip(items: j.attachments)),
              if (j.region != null) InfoRow(icon: Icons.location_city_outlined, label: 'المدينة', value: j.region!),
              if ((j.address ?? '').isNotEmpty)
                InfoRow(
                  icon: Icons.place_outlined,
                  label: 'العنوان',
                  value: j.address!,
                  trailing: TextButton.icon(
                    onPressed: () => openUrl(context, mapsUrl(lat: j.lat, lng: j.lng, address: j.address)),
                    icon: const Icon(Icons.map_outlined, size: 18),
                    label: const Text('الخريطة'),
                  ),
                ),
              InfoRow(icon: Icons.schedule_outlined, label: 'موعد التنفيذ', value: j.scheduledAt == null ? 'في أقرب وقت' : fmtDateTime(j.scheduledAt)),
              InfoRow(icon: Icons.check_circle_outline_rounded, label: 'قُبل في', value: fmtDateTime(j.acceptedAt)),
              if (j.chargedCoins > 0) InfoRow(icon: Icons.toll_outlined, label: 'الكوينز المخصومة', value: '${j.chargedCoins} كوين'),
            ]),
          ),
          const SizedBox(height: 18),
          if (step != null)
            BusyButton(
              label: step.$1,
              icon: step.$2,
              color: j.status == 'in_progress' ? Brand.success : null,
              onPressed: () async {
                if (j.status == 'in_progress' && !await confirm(context, title: 'إنهاء المهمة', message: 'هل أنهيت تنفيذ المهمة؟', ok: 'نعم، أنهيتها')) return;
                try {
                  final next = await store.advance(j.id);
                  if (!context.mounted) return;
                  if (next == 'completed') {
                    showSnack(context, 'أحسنت! اكتملت المهمة');
                    final r = await askRating(context, title: 'قيّم العميل', withReview: false);
                    if (r != null) {
                      try {
                        await store.rateCustomer(j.id, r.$1);
                      } catch (_) {}
                    }
                    if (context.mounted) Navigator.pop(context);
                  }
                } catch (e) {
                  if (context.mounted) showError(context, e);
                }
              },
            ),
          if (canRelease) ...[
            const SizedBox(height: 10),
            TextButton.icon(
              style: TextButton.styleFrom(foregroundColor: Brand.danger),
              onPressed: () async {
                final reason = await promptText(context, title: 'إلغاء الطلب بعد القبول', hint: 'اكتب سبب الإلغاء (إلزامي)', ok: 'تأكيد الإلغاء', danger: true);
                if (reason == null || !context.mounted) return;
                if (reason.trim().length < 3) {
                  showSnack(context, 'سبب الإلغاء إلزامي، اكتبه ليُعرض على الإدارة', error: true);
                  return;
                }
                try {
                  await store.release(j.id, reason);
                  if (context.mounted) {
                    showSnack(context, 'تم إلغاء الطلب، وعاد لمقدمي الخدمة الآخرين');
                    Navigator.pop(context);
                  }
                } catch (e) {
                  if (context.mounted) showError(context, e);
                }
              },
              icon: const Icon(Icons.undo_outlined),
              label: const Text('إلغاء الطلب'),
            ),
            const Text('عند الإلغاء يعود الطلب لمقدمي الخدمة الآخرين ولا تُسترجع الكوينز، ويُسجَّل السبب لدى الإدارة.', textAlign: TextAlign.center, style: TextStyle(fontSize: 11.5, color: Brand.mutedFg)),
          ],
        ]),
      ),
    );
  }
}

class _HistoryList extends StatefulWidget {
  const _HistoryList({required this.items, required this.onLoad});
  final List<HistoryOrder>? items;
  final Future<void> Function() onLoad;
  @override
  State<_HistoryList> createState() => _HistoryListState();
}

class _HistoryListState extends State<_HistoryList> {
  @override
  void initState() {
    super.initState();
    if (widget.items == null) widget.onLoad();
  }

  @override
  Widget build(BuildContext context) {
    final items = widget.items;
    if (items == null) return const Loading();
    if (items.isEmpty) return ListView(children: const [EmptyState(icon: Icons.history_outlined, title: 'لا توجد طلبات سابقة بعد')]);
    final store = ProviderScope.read(context);
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
      itemCount: items.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, i) {
        final o = items[i];
        return AppCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(o.title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                  Text('${o.customerName} • #${o.orderNo} • ${fmtDate(o.completedAt ?? o.cancelledAt ?? o.createdAt)}', style: const TextStyle(color: Brand.mutedFg, fontSize: 12)),
                ]),
              ),
              StatusChip(status: o.status, mode: o.mode, provider: true),
            ]),
            if (o.rating != null) ...[
              const SizedBox(height: 8),
              Row(children: [
                const Text('تقييم العميل لك: ', style: TextStyle(fontSize: 12.5, color: Brand.mutedFg)),
                Stars(value: o.rating!.toDouble(), size: 14),
              ]),
              if ((o.review ?? '').isNotEmpty) Text('«${o.review}»', style: const TextStyle(fontSize: 12.5, height: 1.5)),
            ],
            if (o.status == 'completed' && o.customerRating == null)
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: TextButton.icon(
                  onPressed: () async {
                    final r = await askRating(context, title: 'قيّم العميل', withReview: false);
                    if (r == null) return;
                    try {
                      await store.rateCustomer(o.id, r.$1);
                      if (context.mounted) showSnack(context, 'تم تقييم العميل');
                    } catch (e) {
                      if (context.mounted) showError(context, e);
                    }
                  },
                  icon: const Icon(Icons.star_outline_rounded),
                  label: const Text('قيّم العميل'),
                ),
              ),
          ]),
        );
      },
    );
  }
}
