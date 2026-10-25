import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:mohemah_core/mohemah_core.dart';

import '../orders_store.dart';
import 'addresses_page.dart';
import 'auth_page.dart';
import 'shell.dart';

/// Create an order for one sub-service. Cost and matching are decided by the server.
class NewOrderPage extends StatefulWidget {
  const NewOrderPage({super.key, required this.sub, this.initialDescription});
  final SubService sub;
  final String? initialDescription;

  @override
  State<NewOrderPage> createState() => _NewOrderPageState();
}

class _NewOrderPageState extends State<NewOrderPage> {
  final _form = GlobalKey<FormState>();
  late final _desc = TextEditingController(text: widget.initialDescription ?? '');
  final _address = TextEditingController();
  late String _mode = widget.sub.deliveryMode == 'remote' ? 'remote' : 'in_person';
  String? _region;
  Address? _picked;
  List<Address> _addresses = const [];
  bool _scheduled = false;
  DateTime? _date;
  TimeOfDay? _time;
  PickedLocation? _gps;

  DateTime? get _when => !_scheduled || _date == null || _time == null ? null : DateTime(_date!.year, _date!.month, _date!.day, _time!.hour, _time!.minute);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadAddresses());
  }

  @override
  void dispose() {
    _desc.dispose();
    _address.dispose();
    super.dispose();
  }

  Future<void> _loadAddresses() async {
    final s = SessionScope.read(context);
    setState(() => _region ??= s.profile?.region);
    if (!s.signedIn) return;
    try {
      final list = jList(await s.api.get('/api/me/addresses')).map(Address.new).toList();
      if (!mounted) return;
      setState(() {
        _addresses = list;
        final def = list.where((a) => a.isDefault).toList();
        if (_picked == null && def.isNotEmpty) _pick(def.first);
      });
    } catch (_) {}
  }

  void _pick(Address? a) {
    _picked = a;
    if (a != null) {
      _address.text = a.address;
      if (a.region != null) _region = a.region;
    } else {
      _address.clear();
    }
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: _date ?? now,
      firstDate: DateTime(now.year, now.month, now.day),
      lastDate: now.add(const Duration(days: 59)),
      helpText: 'تاريخ التنفيذ',
    );
    if (date != null) setState(() => _date = date);
  }

  Future<void> _pickTimeOnly() async {
    final t = await showTimePicker(context: context, initialTime: _time ?? TimeOfDay.fromDateTime(DateTime.now().add(const Duration(hours: 1))), helpText: 'وقت التنفيذ');
    if (t != null) setState(() => _time = t);
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    if (_scheduled && (_date == null || _time == null)) {
      showSnack(context, 'حدد تاريخ ووقت التنفيذ', error: true);
      return;
    }
    if (_when != null && _when!.isBefore(DateTime.now())) {
      showSnack(context, 'اختر موعداً لاحقاً', error: true);
      return;
    }
    if (!await ensureSignedIn(context, reason: 'سجّل دخولك لإرسال طلبك') || !mounted) return;
    final s = SessionScope.read(context);
    final store = OrdersScope.read(context);
    try {
      final res = jMap(await s.api.post('/api/orders', {
        'sub_service_id': widget.sub.id,
        'mode': _mode,
        'description': _desc.text.trim(),
        'region': _region,
        if (_mode == 'in_person') 'address': _address.text.trim(),
        if (_mode == 'in_person' && (_picked?.lat ?? _gps?.lat) != null) 'lat': _picked?.lat ?? _gps!.lat,
        if (_mode == 'in_person' && (_picked?.lng ?? _gps?.lng) != null) 'lng': _picked?.lng ?? _gps!.lng,
        if (_when != null) 'scheduled_at': _when!.toUtc().toIso8601String(),
      }));
      unawaited(store.refresh());
      if (!mounted) return;
      await showModalBottomSheet<void>(
        context: context,
        isDismissible: false,
        enableDrag: false,
        builder: (_) => _MatchingSheet(orderNo: jInt(res['order_no']), title: widget.sub.name),
      );
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = PublicScope.of(context);
    final parent = data.serviceById(widget.sub.serviceId);
    final both = widget.sub.deliveryMode == 'both';
    return Scaffold(
      body: Column(children: [
        // Gradient banner: task name, its icon and description.
        PageHeader(
          title: widget.sub.name,
          subtitle: (widget.sub.description ?? '').isNotEmpty ? widget.sub.description! : (parent != null ? 'من خدمات ${parent.name}' : 'حدد التفاصيل وأرسل طلبك'),
          watermark: serviceIcon(widget.sub.icon ?? parent?.icon),
          bottom: parent == null
              ? null
              : Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                    decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.18), borderRadius: BorderRadius.circular(20)),
                    child: Text(parent.name, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                  ),
                ),
        ),
        Expanded(
          child: Form(
        key: _form,
        child: ListView(padding: const EdgeInsets.fromLTRB(16, 0, 16, 30), children: [
          const SizedBox(height: 18),
          const _Label('نوع الخدمة'),
          if (both)
            SegmentedButton<String>(
              showSelectedIcon: false,
              segments: const [
                ButtonSegment(value: 'in_person', label: Text('حضوري'), icon: Icon(Icons.home_work_outlined)),
                ButtonSegment(value: 'remote', label: Text('عن بُعد'), icon: Icon(Icons.videocam_outlined)),
              ],
              selected: {_mode},
              onSelectionChanged: (v) => setState(() => _mode = v.first),
            )
          else
            Pill(_mode == 'remote' ? 'هذه الخدمة عن بُعد فقط' : 'هذه الخدمة حضورية فقط', icon: _mode == 'remote' ? Icons.videocam_outlined : Icons.home_work_outlined),
          const SizedBox(height: 18),
          Field(
            controller: _desc,
            label: 'شرح الطلب',
            hint: 'اكتب تفاصيل المهمة المطلوبة…',
            maxLines: 5,
            maxLength: 1000,
            validator: (v) => v.length < 5 ? 'اكتب شرحاً مختصراً للطلب' : null,
          ),
          RegionField(value: _region, onChanged: (v) => setState(() => _region = v)),
          if (_mode == 'in_person') ...[
            const _Label('عنوان تنفيذ الخدمة'),
            LocationPicker(
              picked: _gps,
              onPicked: (l) => setState(() {
                _gps = l;
                _picked = null;
                _address.text = l.address;
                if (l.region != null) _region = l.region;
              }),
            ),
            if (_addresses.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Wrap(spacing: 8, runSpacing: 8, children: [
                  for (final a in _addresses)
                    ChoiceChip(
                      label: Text(a.label),
                      avatar: const Icon(Icons.place_outlined, size: 17),
                      selected: _picked?.id == a.id,
                      onSelected: (_) => setState(() => _pick(a)),
                    ),
                  ChoiceChip(label: const Text('عنوان آخر…'), selected: _picked == null, onSelected: (_) => setState(() => _pick(null))),
                ]),
              ),
            TextFormField(
              controller: _address,
              minLines: 1,
              maxLines: 3,
              maxLength: 300,
              onChanged: (_) {
                if (_picked != null && _address.text != _picked!.address) setState(() => _picked = null);
              },
              validator: (v) => _mode == 'in_person' && (v ?? '').trim().isEmpty ? 'حدد عنوان تنفيذ الخدمة' : null,
              decoration: const InputDecoration(hintText: 'الحي، الشارع، رقم المبنى…', prefixIcon: Icon(Icons.place_outlined, color: Brand.mutedFg)),
            ),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: TextButton.icon(
                onPressed: () async {
                  if (!await ensureSignedIn(context) || !context.mounted) return;
                  await Navigator.push(context, MaterialPageRoute(builder: (_) => const AddressesPage()));
                  if (mounted) await _loadAddresses();
                },
                icon: const Icon(Icons.add_location_alt_outlined, size: 19),
                label: const Text('إدارة عناويني المحفوظة'),
              ),
            ),
          ],
          const SizedBox(height: 6),
          const _Label('موعد التنفيذ'),
          Row(children: [
            Expanded(
              child: ChoiceChip(
                label: const SizedBox(width: double.infinity, child: Text('في أقرب وقت', textAlign: TextAlign.center)),
                selected: !_scheduled,
                onSelected: (_) => setState(() => _scheduled = false),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: ChoiceChip(
                label: const SizedBox(width: double.infinity, child: Text('تحديد موعد', textAlign: TextAlign.center)),
                selected: _scheduled,
                onSelected: (_) => setState(() => _scheduled = true),
              ),
            ),
          ]),
          if (_scheduled) ...[
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: _PickBox(icon: Icons.event_outlined, label: 'التاريخ', value: _date == null ? null : fmtDate(_date), onTap: _pickDate)),
              const SizedBox(width: 10),
              Expanded(
                child: _PickBox(
                  icon: Icons.schedule_outlined,
                  label: 'الوقت',
                  value: _time == null ? null : fmtTime(DateTime(2000, 1, 1, _time!.hour, _time!.minute)),
                  onTap: _pickTimeOnly,
                ),
              ),
            ]),
          ],
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Brand.accent, borderRadius: BorderRadius.circular(14)),
            child: const Row(children: [
              Icon(Icons.info_outline_rounded, color: Brand.accentFg, size: 20),
              SizedBox(width: 8),
              Expanded(child: Text('قيمة التنفيذ: تتفق عليها مع مقدم الخدمة عبر المراسلة. لا يأخذ التطبيق أي رسوم منك.', style: TextStyle(fontSize: 12.5, color: Brand.accentFg))),
            ]),
          ),
          const SizedBox(height: 18),
          BusyButton(label: 'إرسال الطلب', icon: Icons.send_outlined, onPressed: _submit),
        ]),
          ),
        ),
      ]),
    );
  }
}

/// A tappable field showing a chosen date or time.
class _PickBox extends StatelessWidget {
  const _PickBox({required this.icon, required this.label, required this.value, required this.onTap});
  final IconData icon;
  final String label;
  final String? value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: InputDecorator(
          decoration: InputDecoration(labelText: label, prefixIcon: Icon(icon, color: Brand.mutedFg)),
          child: Text(value ?? 'اختر', style: TextStyle(color: value == null ? Brand.mutedFg : Brand.foreground, fontWeight: FontWeight.w600)),
        ),
      );
}

class _Label extends StatelessWidget {
  const _Label(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 8, right: 2),
        child: Text(text, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
      );
}

/// Shown after the order is published: an animated search while providers are notified.
class _MatchingSheet extends StatefulWidget {
  const _MatchingSheet({required this.orderNo, required this.title});
  final int orderNo;
  final String title;
  @override
  State<_MatchingSheet> createState() => _MatchingSheetState();
}

class _MatchingSheetState extends State<_MatchingSheet> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1800))..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(22, 0, 22, 18),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          SizedBox(
            width: 150,
            height: 150,
            child: AnimatedBuilder(
              animation: _c,
              builder: (_, __) => CustomPaint(
                painter: _RipplePainter(_c.value, primary),
                child: Center(
                  child: Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(color: primary, shape: BoxShape.circle),
                    child: const Icon(Icons.person_search_outlined, color: Colors.white, size: 32),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          const Text('طلبك منشور لمقدمي الخدمة', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text('«${widget.title}» • رقم الطلب #${widget.orderNo}', style: const TextStyle(color: Brand.mutedFg)),
          const SizedBox(height: 8),
          const Text('جارٍ البحث عن مقدم خدمة في مدينتك، وسنُشعرك فور قبول طلبك.', textAlign: TextAlign.center, style: TextStyle(height: 1.6)),
          const SizedBox(height: 18),
          FilledButton.icon(
            onPressed: () => CustomerShell.goTo(2),
            icon: const Icon(Icons.receipt_long_outlined),
            label: const Text('متابعة الطلب والمراسلة'),
          ),
        ]),
      ),
    );
  }
}

class _RipplePainter extends CustomPainter {
  _RipplePainter(this.t, this.color);
  final double t;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final maxR = math.min(size.width, size.height) / 2;
    for (var i = 0; i < 3; i++) {
      final p = (t + i / 3) % 1;
      canvas.drawCircle(c, 32 + (maxR - 32) * p, Paint()..color = color.withValues(alpha: 0.28 * (1 - p)));
    }
  }

  @override
  bool shouldRepaint(_RipplePainter old) => old.t != t;
}
