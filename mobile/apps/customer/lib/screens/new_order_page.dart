import 'dart:async';
import 'dart:math' as math;
import 'dart:typed_data';

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
  final _extra = TextEditingController();
  String? _locSource; // gps | map | saved
  bool _locating = false;
  final List<PickedImage> _images = [];
  Uint8List? _voice;

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
    _extra.dispose();
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
        if (_picked == null && _gps == null && def.isNotEmpty) {
          _pick(def.first);
          _locSource = 'saved';
        }
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

  void _setLocation(PickedLocation l, String source) {
    setState(() {
      _locSource = source;
      _gps = l;
      _picked = null;
      _address.text = l.address;
      if (l.region != null) _region = l.region;
    });
  }

  Future<void> _useGps() async {
    setState(() => _locating = true);
    final regions = PublicScope.read(context).regions;
    final pos = await currentPosition(context);
    if (pos != null) _setLocation(await describeLocation(pos.latitude, pos.longitude, regions), 'gps');
    if (mounted) setState(() => _locating = false);
  }

  Future<void> _useMap() async {
    final l = await Navigator.push<PickedLocation>(context, MaterialPageRoute(builder: (_) => MapPickerPage(initial: _gps)));
    if (l != null) _setLocation(l, 'map');
  }

  Future<void> _useSaved() async {
    if (!await ensureSignedIn(context) || !mounted) return;
    if (_addresses.isEmpty) await _loadAddresses();
    if (!mounted) return;
    final a = await showModalBottomSheet<Object>(
      context: context,
      builder: (c) => SafeArea(
        child: ListView(shrinkWrap: true, padding: const EdgeInsets.fromLTRB(16, 0, 16, 16), children: [
          const Text('عناويني المحفوظة', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          if (_addresses.isEmpty) const Padding(padding: EdgeInsets.all(12), child: Text('لا توجد عناوين محفوظة بعد.', style: TextStyle(color: Brand.mutedFg))),
          for (final x in _addresses)
            ListTile(
              leading: const Icon(Icons.place_outlined, color: Brand.primary),
              title: Text(x.label, style: const TextStyle(fontWeight: FontWeight.w700)),
              subtitle: Text(x.address, maxLines: 2, overflow: TextOverflow.ellipsis),
              onTap: () => Navigator.pop(c, x),
            ),
          TextButton.icon(onPressed: () => Navigator.pop(c, 'manage'), icon: const Icon(Icons.add_location_alt_outlined), label: const Text('إضافة أو إدارة العناوين')),
        ]),
      ),
    );
    if (!mounted) return;
    if (a == 'manage') {
      await Navigator.push(context, MaterialPageRoute(builder: (_) => const AddressesPage()));
      if (mounted) await _loadAddresses();
      return;
    }
    if (a is Address) {
      setState(() {
        _locSource = 'saved';
        _gps = null;
        _pick(a);
      });
    }
  }

  Future<void> _addImage() async {
    if (_images.length >= 4) {
      showSnack(context, 'الحد الأقصى 4 صور', error: true);
      return;
    }
    final d = await pickPhoto(context);
    if (d != null) setState(() => _images.add(d));
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
    if (_mode == 'in_person' && _address.text.trim().isEmpty) {
      showSnack(context, 'حدد موقع تنفيذ الخدمة: موقعك الحالي أو موقع آخر أو عنوان محفوظ', error: true);
      return;
    }
    if (_region == null) {
      showSnack(context, 'اختر المدينة', error: true);
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
        if (_mode == 'in_person') 'address': [_address.text.trim(), _extra.text.trim()].where((x) => x.isNotEmpty).join(' — '),
        if (_mode == 'in_person' && (_picked?.lat ?? _gps?.lat) != null) 'lat': _picked?.lat ?? _gps!.lat,
        if (_mode == 'in_person' && (_picked?.lng ?? _gps?.lng) != null) 'lng': _picked?.lng ?? _gps!.lng,
        if (_when != null) 'scheduled_at': _when!.toUtc().toIso8601String(),
      }));
      // Photos and the voice note go up right after the order is created.
      if (_images.isNotEmpty || _voice != null) {
        try {
          await s.api.multipart('/api/orders/${jS(res['id'])}/attachments', const {}, [
            for (final img in _images) img.upload('files'),
            if (_voice != null) UploadFile(field: 'files', filename: 'voice.wav', bytes: _voice!, contentType: 'audio/wav'),
          ]);
        } catch (e) {
          if (mounted) showSnack(context, 'أُرسل الطلب لكن تعذّر رفع المرفقات: ${errMsg(e)}', error: true);
        }
      }
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
          // Photos and a voice note help the provider understand the job.
          const _Label('صور أو رسالة صوتية (اختياري)'),
          _AttachBox(
            images: _images,
            voice: _voice,
            onAddImage: _addImage,
            onRemoveImage: (i) => setState(() => _images.removeAt(i)),
            onVoice: (v) => setState(() => _voice = v),
          ),
          const SizedBox(height: 14),
          if (_mode == 'in_person') ...[
            const _Label('موقع تنفيذ الخدمة'),
            Row(children: [
              Expanded(child: _LocOption(icon: Icons.my_location_outlined, label: 'موقعي الحالي', selected: _locSource == 'gps', busy: _locating, onTap: _useGps)),
              const SizedBox(width: 8),
              if (mapsEnabled) ...[
                Expanded(child: _LocOption(icon: Icons.map_outlined, label: 'موقع آخر', selected: _locSource == 'map', onTap: _useMap)),
                const SizedBox(width: 8),
              ],
              Expanded(child: _LocOption(icon: Icons.bookmark_border_outlined, label: 'عنوان محفوظ', selected: _locSource == 'saved', onTap: _useSaved)),
            ]),
            if (_address.text.isNotEmpty) ...[
              const SizedBox(height: 10),
              AppCard(
                padding: const EdgeInsets.all(12),
                child: Row(children: [
                  const Icon(Icons.place_outlined, color: Brand.success),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(_address.text, style: const TextStyle(fontWeight: FontWeight.w700, height: 1.5)),
                      if (_region != null) Text(_region!, style: const TextStyle(fontSize: 12, color: Brand.mutedFg)),
                    ]),
                  ),
                ]),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _extra,
                maxLength: 120,
                decoration: const InputDecoration(hintText: 'تفاصيل إضافية: رقم المبنى، الدور، علامة مميزة… (اختياري)', prefixIcon: Icon(Icons.apartment_outlined, color: Brand.mutedFg)),
              ),
            ],
          ],
          // City is filled from the location; asked only when it could not be determined.
          if (_region == null) RegionField(value: _region, onChanged: (v) => setState(() => _region = v)),
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
          const PolicyLink(audience: 'customers', placement: 'order', prefix: 'بإرسال الطلب أنت توافق على '),
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

/// One of the location choices (current location / another place / saved address).
class _LocOption extends StatelessWidget {
  const _LocOption({required this.icon, required this.label, required this.selected, required this.onTap, this.busy = false});
  final IconData icon;
  final String label;
  final bool selected;
  final bool busy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
        color: selected ? Brand.primary.withValues(alpha: 0.08) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: busy ? null : onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), border: Border.all(color: selected ? Brand.primary : const Color(0xFFD9DEE5), width: selected ? 1.6 : 1)),
            child: Column(children: [
              busy ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2)) : Icon(icon, color: selected ? Brand.primary : Brand.mutedFg),
              const SizedBox(height: 6),
              Text(label, textAlign: TextAlign.center, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: selected ? Brand.primary : Brand.foreground)),
            ]),
          ),
        ),
      );
}

/// Photo thumbnails with an add button, and a hold-free record / stop voice note control.
class _AttachBox extends StatefulWidget {
  const _AttachBox({required this.images, required this.voice, required this.onAddImage, required this.onRemoveImage, required this.onVoice});
  final List<PickedImage> images;
  final Uint8List? voice;
  final VoidCallback onAddImage;
  final ValueChanged<int> onRemoveImage;
  final ValueChanged<Uint8List?> onVoice;
  @override
  State<_AttachBox> createState() => _AttachBoxState();
}

class _AttachBoxState extends State<_AttachBox> {
  final _rec = VoiceNoteRecorder();
  bool _recording = false;
  int _secs = 0;
  Timer? _tick;

  @override
  void dispose() {
    _tick?.cancel();
    _rec.dispose();
    super.dispose();
  }

  Future<void> _toggle() async {
    if (_recording) return _stop();
    final ok = await _rec.start(onLimit: _stop);
    if (!ok) {
      if (mounted) showSnack(context, 'اسمح للتطبيق باستخدام الميكروفون من إعدادات الجوال', error: true);
      return;
    }
    setState(() {
      _recording = true;
      _secs = 0;
    });
    _tick = Timer.periodic(const Duration(seconds: 1), (_) => setState(() => _secs++));
  }

  Future<void> _stop() async {
    _tick?.cancel();
    final bytes = await _rec.stop();
    if (!mounted) return;
    setState(() => _recording = false);
    if (bytes != null) widget.onVoice(bytes);
  }

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SizedBox(
        height: 78,
        child: ListView(scrollDirection: Axis.horizontal, children: [
          for (var i = 0; i < widget.images.length; i++)
            Padding(
              padding: const EdgeInsetsDirectional.only(end: 8),
              child: Stack(children: [
                ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.memory(widget.images[i].bytes, width: 78, height: 78, fit: BoxFit.cover)),
                PositionedDirectional(
                  top: 2,
                  end: 2,
                  child: InkWell(
                    onTap: () => widget.onRemoveImage(i),
                    child: const CircleAvatar(radius: 11, backgroundColor: Colors.black54, child: Icon(Icons.close, size: 14, color: Colors.white)),
                  ),
                ),
              ]),
            ),
          if (widget.images.length < 4)
            InkWell(
              onTap: widget.onAddImage,
              borderRadius: BorderRadius.circular(12),
              child: Container(
                width: 78,
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFD9DEE5)), color: Colors.white),
                child: const Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(Icons.add_a_photo_outlined, color: Brand.primary),
                  SizedBox(height: 4),
                  Text('إضافة صورة', style: TextStyle(fontSize: 11)),
                ]),
              ),
            ),
        ]),
      ),
      const SizedBox(height: 10),
      if (widget.voice != null && !_recording)
        Row(children: [
          const Icon(Icons.graphic_eq, color: Brand.success),
          const SizedBox(width: 6),
          Expanded(child: Text('رسالة صوتية مسجلة (${(widget.voice!.length / 32000).round()} ث)', style: const TextStyle(fontWeight: FontWeight.w700))),
          TextButton.icon(onPressed: () => widget.onVoice(null), icon: const Icon(Icons.delete_outline, color: Brand.danger), label: const Text('حذف', style: TextStyle(color: Brand.danger))),
        ])
      else
        OutlinedButton.icon(
          style: OutlinedButton.styleFrom(foregroundColor: _recording ? Brand.danger : null, side: BorderSide(color: _recording ? Brand.danger : const Color(0xFFD9DEE5))),
          onPressed: _toggle,
          icon: Icon(_recording ? Icons.stop_circle_outlined : Icons.mic_none_outlined),
          label: Text(_recording ? 'إيقاف التسجيل (${_secs}ث / 90)' : 'تسجيل رسالة صوتية'),
        ),
    ]);
  }
}
