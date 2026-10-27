import 'package:flutter/material.dart' hide Text;
import 'package:mohemah_core/mohemah_core.dart';

import '../docs.dart';
import '../provider_store.dart';

/// Uniform service tile: icon, name and an on/off badge.
class ServiceToggleTile extends StatelessWidget {
  const ServiceToggleTile({super.key, required this.name, this.icon, this.color, required this.on, this.onTap});
  final String name;
  final String? icon;
  final String? color;
  final bool on;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final (fg, bg) = serviceColors(color);
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: on ? Brand.success : const Color(0xFFD9DEE5), width: on ? 1.6 : 1),
            color: on ? Brand.success.withValues(alpha: 0.05) : Colors.white,
          ),
          padding: const EdgeInsets.fromLTRB(8, 12, 8, 10),
          child: Stack(clipBehavior: Clip.none, children: [
            Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(color: on ? bg : const Color(0xFFF1F3F6), borderRadius: BorderRadius.circular(14)),
                child: Icon(serviceIcon(icon), color: on ? fg : Brand.mutedFg, size: 25),
              ),
              const SizedBox(height: 8),
              Text(name, maxLines: 2, textAlign: TextAlign.center, overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12, height: 1.3, fontWeight: FontWeight.w700, color: on ? Brand.foreground : Brand.mutedFg)),
              const SizedBox(height: 4),
              Text(on ? 'مفعّلة' : 'موقوفة', style: TextStyle(fontSize: 10.5, color: on ? Brand.success : Brand.mutedFg, fontWeight: FontWeight.w600)),
            ]),
            PositionedDirectional(
              top: -4,
              end: -2,
              child: Icon(on ? Icons.check_circle : Icons.radio_button_unchecked, size: 18, color: on ? Brand.success : const Color(0xFFC3CAD4)),
            ),
          ]),
        ),
      ),
    );
  }
}

/// «خدماتي المعتمدة»: approved services (on/off), add-service requests and a form to request a new service.
class MyServicesPage extends StatefulWidget {
  const MyServicesPage({super.key, this.openRequest = false});

  /// Opens the "request a service" form right away.
  final bool openRequest;
  @override
  State<MyServicesPage> createState() => _MyServicesPageState();
}

class _MyServicesPageState extends State<MyServicesPage> {
  Map<String, dynamic>? _data;
  String? _error;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final first = _data == null;
      final d = jMap(await ProviderScope.read(context).api.get('/api/provider/my-services'));
      if (mounted) setState(() => _data = d);
      if (first && widget.openRequest && mounted) await _request();
    } catch (e) {
      if (mounted) setState(() => _error = errMsg(e));
    }
  }

  Future<void> _toggle(String id) async {
    final approved = jList(_data?['approved']);
    final on = approved.where((s) => s['enabled'] == true).map((s) => '${s['id']}').toSet();
    on.contains(id) ? on.remove(id) : on.add(id);
    setState(() => _saving = true);
    final store = ProviderScope.read(context);
    try {
      await store.api.put('/api/provider/services', {'ids': on.toList()});
      await _load();
      await store.refresh();
    } catch (e) {
      if (mounted) showError(context, e);
    }
    if (mounted) setState(() => _saving = false);
  }

  Future<void> _request() async {
    final options = jList(_data?['requestable']);
    if (options.isEmpty) {
      showSnack(context, 'لا توجد خدمات أخرى متاحة للطلب حالياً');
      return;
    }
    final ok = await Navigator.push<bool>(context, MaterialPageRoute(builder: (_) => _RequestServicePage(options: options)));
    if (ok == true) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final d = _data;
    final approved = jList(d?['approved']);
    final requests = jList(d?['requests']);
    return Scaffold(
      appBar: PageHeader.bar('خدماتي المعتمدة'),
      floatingActionButton: d == null
          ? null
          : FloatingActionButton.extended(onPressed: _request, icon: const Icon(Icons.add), label: const Text('طلب إضافة خدمة')),
      body: d == null
          ? (_error != null ? ErrorRetry(message: _error!, onRetry: _load) : const Loading())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 100), children: [
                // Request new services: choose them, attach the proof, the administration reviews.
                Material(
                  borderRadius: BorderRadius.circular(18),
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: _request,
                    child: Ink(
                      decoration: const BoxDecoration(gradient: Brand.providerGradient),
                      padding: const EdgeInsets.all(16),
                      child: const Row(children: [
                        Icon(Icons.add_business_outlined, color: Colors.white, size: 30),
                        SizedBox(width: 12),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('طلب خدمات جديدة', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16)),
                            Text('اختر الخدمة وأرفق الشهادة أو الإثبات لتراجعها الإدارة', style: TextStyle(color: Colors.white70, fontSize: 12)),
                          ]),
                        ),
                        Icon(Icons.chevron_left, color: Colors.white),
                      ]),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text('اضغط على الخدمة لتفعيلها أو إيقافها${_saving ? ' — جارٍ الحفظ…' : ''}', style: const TextStyle(fontSize: 12, color: Brand.mutedFg)),
                const SizedBox(height: 10),
                if (approved.isEmpty)
                  const EmptyState(icon: Icons.home_repair_service_outlined, title: 'لا توجد خدمات معتمدة بعد', message: 'اطلب إضافة خدمة مع إرفاق شهادة أو إثبات خبرة.')
                else
                  GridView.count(
                    crossAxisCount: 3,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    mainAxisSpacing: 10,
                    crossAxisSpacing: 10,
                    childAspectRatio: 0.82,
                    children: [
                      for (final s in approved)
                        ServiceToggleTile(name: jS(s['name']), icon: jStr(s['icon']), color: jStr(s['color']), on: s['enabled'] == true, onTap: _saving ? null : () => _toggle(jS(s['id']))),
                    ],
                  ),
                if (requests.isNotEmpty) ...[
                  const SectionTitle('طلبات الإضافة'),
                  for (final r in requests)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: AppCard(
                        child: Row(children: [
                          Icon(
                            r['status'] == 'approved' ? Icons.check_circle_outline : r['status'] == 'rejected' ? Icons.cancel_outlined : Icons.hourglass_top_outlined,
                            color: r['status'] == 'approved' ? Brand.success : r['status'] == 'rejected' ? Brand.danger : Brand.primary,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(jS(r['service_name']), style: const TextStyle(fontWeight: FontWeight.w800)),
                              Text(
                                r['status'] == 'approved' ? 'تمت الموافقة' : r['status'] == 'rejected' ? 'لم تُعتمد${jStr(r['admin_note']) != null ? ': ${r['admin_note']}' : ''}' : 'قيد المراجعة لدى الإدارة',
                                style: const TextStyle(fontSize: 12, color: Brand.mutedFg),
                              ),
                            ]),
                          ),
                        ]),
                      ),
                    ),
                ],
              ]),
            ),
    );
  }
}

class _RequestServicePage extends StatefulWidget {
  const _RequestServicePage({required this.options});
  final List<dynamic> options;
  @override
  State<_RequestServicePage> createState() => _RequestServicePageState();
}

class _RequestServicePageState extends State<_RequestServicePage> {
  String? _serviceId;
  PickedDoc? _doc;
  final _note = TextEditingController();

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_serviceId == null) {
      showSnack(context, 'اختر الخدمة', error: true);
      return;
    }
    if (_doc == null) {
      showSnack(context, 'أرفق الشهادة أو إثبات الخبرة', error: true);
      return;
    }
    try {
      await ProviderScope.read(context).api.multipart(
        '/api/provider/service-requests',
        {'service_id': _serviceId!, 'note': _note.text.trim()},
        [_doc!.upload('doc_file')],
      );
      if (!mounted) return;
      showSnack(context, 'تم إرسال الطلب للإدارة، سيصلك إشعار بالنتيجة');
      Navigator.pop(context, true);
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: PageHeader.bar('طلب إضافة خدمة'),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        const Text('1. اختر الخدمة', style: TextStyle(fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        GridView.count(
          crossAxisCount: 3,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 0.82,
          children: [
            for (final s in widget.options)
              ServiceToggleTile(
                name: jS(s['name']),
                icon: jStr(s['icon']),
                color: jStr(s['color']),
                on: _serviceId == jS(s['id']),
                onTap: () => setState(() => _serviceId = jS(s['id'])),
              ),
          ],
        ),
        const SizedBox(height: 18),
        const Text('2. أرفق الشهادة أو إثبات الخبرة', style: TextStyle(fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: () async {
            final d = await pickDocument(context, 'الشهادة أو الإثبات');
            if (d != null) setState(() => _doc = d);
          },
          icon: Icon(_doc == null ? Icons.upload_file_outlined : Icons.check_circle_outline, color: _doc == null ? null : Brand.success),
          label: Text(_doc == null ? 'إرفاق صورة الشهادة' : 'تم الإرفاق: ${_doc!.name}', overflow: TextOverflow.ellipsis),
        ),
        const SizedBox(height: 18),
        const Text('3. ملاحظة للإدارة (اختياري)', style: TextStyle(fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        TextField(controller: _note, maxLines: 3, maxLength: 500, decoration: InputDecoration(hintText: tr('سنوات الخبرة، جهة الشهادة…'))),
        const SizedBox(height: 8),
        BusyButton(label: 'إرسال الطلب للإدارة', icon: Icons.send_outlined, onPressed: _submit),
      ]),
    );
  }
}

/// Asks for the letter period (whole period, a from–to range or up to a date), then opens the printable letter.
/// The letter carries a reference number and a QR code that verifies it.
Future<void> openExperienceLetter(BuildContext context) async {
  final range = await showModalBottomSheet<(DateTime?, DateTime?)>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => const _LetterPeriodSheet(),
  );
  if (range == null || !context.mounted) return;
  String d(DateTime x) => '${x.year.toString().padLeft(4, '0')}-${x.month.toString().padLeft(2, '0')}-${x.day.toString().padLeft(2, '0')}';
  final q = [if (range.$1 != null) 'from=${d(range.$1!)}', if (range.$2 != null) 'to=${d(range.$2!)}'].join('&');
  try {
    final r = jMap(await ProviderScope.read(context).api.get('/api/provider/experience-letter${q.isEmpty ? '' : '?$q'}'));
    if (context.mounted) {
      showSnack(context, 'صدر الخطاب برقم مرجعي ${jS(r['ref'])}');
      await openUrl(context, jS(r['url']));
    }
  } catch (e) {
    if (context.mounted) showError(context, e);
  }
}

class _LetterPeriodSheet extends StatefulWidget {
  const _LetterPeriodSheet();
  @override
  State<_LetterPeriodSheet> createState() => _LetterPeriodSheetState();
}

class _LetterPeriodSheetState extends State<_LetterPeriodSheet> {
  int _mode = 0; // 0 whole period, 1 from–to, 2 up to a date
  DateTimeRange? _range;
  DateTime? _date;

  String _fmt(DateTime x) => '${x.day}/${x.month}/${x.year}';

  Future<void> _pickRange() async {
    final now = DateTime.now();
    final r = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year - 10),
      lastDate: now,
      initialDateRange: _range,
      helpText: tr('فترة الخطاب'),
      saveText: tr('تم'),
    );
    if (r != null) setState(() => _range = r);
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final r = await showDatePicker(context: context, firstDate: DateTime(now.year - 10), lastDate: now, initialDate: _date ?? now, helpText: tr('حتى تاريخ'));
    if (r != null) setState(() => _date = r);
  }

  @override
  Widget build(BuildContext context) {
    Widget option(int v, IconData icon, String title, String sub, {VoidCallback? onTap}) => Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Material(
            color: _mode == v ? Brand.primary.withValues(alpha: 0.07) : Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: _mode == v ? Brand.primary : Brand.border, width: _mode == v ? 1.5 : 1)),
            child: InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: () {
                setState(() => _mode = v);
                onTap?.call();
              },
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(children: [
                  Icon(icon, color: _mode == v ? Brand.primary : Brand.mutedFg),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
                      Text(sub, style: const TextStyle(fontSize: 12, color: Brand.mutedFg)),
                    ]),
                  ),
                  Icon(_mode == v ? Icons.radio_button_checked : Icons.radio_button_off, color: _mode == v ? Brand.primary : Brand.border),
                ]),
              ),
            ),
          ),
        );
    final ready = _mode == 0 || (_mode == 1 && _range != null) || (_mode == 2 && _date != null);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('خطاب خبرة', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const Text('اختر الفترة التي يغطيها الخطاب، ويُحسب عدد الطلبات والتقييم خلالها فقط.', style: TextStyle(fontSize: 12.5, color: Brand.mutedFg)),
          const SizedBox(height: 12),
          option(0, Icons.all_inclusive, 'كامل فترة العمل', 'من تاريخ انضمامك حتى اليوم'),
          option(1, Icons.date_range_outlined, 'فترة محددة', _range == null ? 'اختر تاريخ البداية والنهاية' : 'من ${_fmt(_range!.start)} إلى ${_fmt(_range!.end)}', onTap: _pickRange),
          option(2, Icons.event_outlined, 'حتى تاريخ محدد', _date == null ? 'من تاريخ انضمامك حتى التاريخ الذي تختاره' : 'حتى ${_fmt(_date!)}', onTap: _pickDate),
          const SizedBox(height: 6),
          FilledButton.icon(
            onPressed: ready
                ? () => Navigator.pop<(DateTime?, DateTime?)>(context, switch (_mode) {
                      1 => (_range!.start, _range!.end),
                      2 => (null, _date),
                      _ => (null, null),
                    })
                : null,
            icon: const Icon(Icons.workspace_premium_outlined),
            label: const Text('إصدار الخطاب'),
          ),
          const SizedBox(height: 6),
          const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(Icons.qr_code_2, size: 16, color: Brand.mutedFg),
            SizedBox(width: 4),
            Text('يحمل الخطاب رقماً مرجعياً وباركود للتحقق من صحته', style: TextStyle(fontSize: 11.5, color: Brand.mutedFg)),
          ]),
        ]),
      ),
    );
  }
}
