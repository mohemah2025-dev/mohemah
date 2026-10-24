import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mohemah_core/mohemah_core.dart';

import '../docs.dart';

/// Provider sign-in and registration (provider registration lives only in this app).
class ProviderAuthPage extends StatefulWidget {
  const ProviderAuthPage({super.key});
  @override
  State<ProviderAuthPage> createState() => _ProviderAuthPageState();
}

class _ProviderAuthPageState extends State<ProviderAuthPage> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      gradient: Brand.providerGradient,
      showBack: false,
      title: 'مهمة شريك',
      subtitle: _tab == 0 ? 'سجّل دخولك لاستقبال الطلبات وإدارة أعمالك' : 'انضم لمقدمي الخدمة وابدأ استقبال الطلبات بعد موافقة الإدارة',
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 22, 20, 30),
        children: [
          AuthTabs(index: _tab, labels: const ['تسجيل الدخول', 'تسجيل مقدم خدمة'], onChanged: (i) => setState(() => _tab = i)),
          const SizedBox(height: 20),
          if (_tab == 0) LoginForm(onSuccess: () {}) else const ProviderRegisterForm(),
        ],
      ),
    );
  }
}

/// Three steps: personal details → services → documents.
class ProviderRegisterForm extends StatefulWidget {
  const ProviderRegisterForm({super.key, this.applyExisting = false});

  /// When true, an already signed-in account applies (`/api/provider/apply`):
  /// name, phone, email and password are taken from the account.
  final bool applyExisting;

  @override
  State<ProviderRegisterForm> createState() => _ProviderRegisterFormState();
}

class _ProviderRegisterFormState extends State<ProviderRegisterForm> {
  final _forms = [GlobalKey<FormState>(), GlobalKey<FormState>()];
  final _name = TextEditingController();
  final _nid = TextEditingController();
  final _phone = TextEditingController();
  final _nationality = TextEditingController(text: 'سعودي');
  final _email = TextEditingController();
  final _pw = TextEditingController();
  String? _gender;
  String? _region;
  final Set<String> _services = {};
  PickedDoc? _idDoc;
  PickedDoc? _certDoc;
  bool _agree = false;
  int _step = 0;

  @override
  void dispose() {
    for (final c in [_name, _nid, _phone, _nationality, _email, _pw]) {
      c.dispose();
    }
    super.dispose();
  }

  void _next() {
    if (_step == 0 && !_forms[0].currentState!.validate()) return;
    if (_step == 1 && _services.isEmpty) {
      showSnack(context, 'اختر خدمة واحدة على الأقل', error: true);
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() => _step++);
  }

  Future<void> _submit() async {
    if (_idDoc == null || _certDoc == null) {
      showSnack(context, _idDoc == null ? 'أرفق صورة الهوية / الإقامة' : 'أرفق الشهادة', error: true);
      return;
    }
    if (!_agree) {
      showSnack(context, 'وافق على الشروط والسياسات للمتابعة', error: true);
      return;
    }
    final s = SessionScope.read(context);
    final fields = <String, String>{
      'national_id': _nid.text.trim(),
      'nationality': _nationality.text.trim(),
      'gender': _gender ?? '',
      'region': _region ?? '',
      'services': jsonEncode(_services.toList()),
      if (!widget.applyExisting) ...{
        'full_name': _name.text.trim(),
        'phone': _phone.text.trim(),
        'email': _email.text.trim(),
        'password': _pw.text,
      },
    };
    final files = [_idDoc!.upload('id_file'), _certDoc!.upload('cert_file')];
    try {
      if (widget.applyExisting) {
        s.applyMe(await s.api.multipart('/api/provider/apply', fields, files));
      } else {
        await s.acceptAuth(jMap(await s.api.multipart('/api/auth/register/provider', fields, files)));
      }
      if (mounted) showSnack(context, 'تم إرسال طلبك، ستصلك نتيجة المراجعة قريباً');
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final steps = ['البيانات', 'الخدمات', 'المستندات'];
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        for (var i = 0; i < steps.length; i++) ...[
          if (i > 0) Expanded(child: Container(height: 2, color: i <= _step ? Brand.primaryDeep : Brand.border)),
          Column(children: [
            CircleAvatar(
              radius: 15,
              backgroundColor: i <= _step ? Brand.primaryDeep : Brand.muted,
              child: i < _step
                  ? const Icon(Icons.check_rounded, size: 16, color: Colors.white)
                  : Text('${i + 1}', style: TextStyle(color: i <= _step ? Colors.white : Brand.mutedFg, fontWeight: FontWeight.w800, fontSize: 13)),
            ),
            const SizedBox(height: 4),
            Text(steps[i], style: TextStyle(fontSize: 11.5, fontWeight: i == _step ? FontWeight.w800 : FontWeight.w500)),
          ]),
        ],
      ]),
      const SizedBox(height: 20),
      if (_step == 0) _personal(),
      if (_step == 1) _servicesStep(),
      if (_step == 2) _docsStep(),
      const SizedBox(height: 8),
      Row(children: [
        if (_step > 0) ...[
          Expanded(child: OutlinedButton(onPressed: () => setState(() => _step--), child: const Text('السابق'))),
          const SizedBox(width: 10),
        ],
        Expanded(
          flex: 2,
          child: _step < 2
              ? FilledButton(onPressed: _next, child: const Text('التالي'))
              : BusyButton(label: 'إرسال الطلب', icon: Icons.send_rounded, onPressed: _submit),
        ),
      ]),
    ]);
  }

  Widget _personal() {
    return Form(
      key: _forms[0],
      child: Column(children: [
        if (!widget.applyExisting)
          Field(
            controller: _name,
            label: 'الاسم الثلاثي',
            hint: 'كما في الهوية',
            icon: Icons.person_rounded,
            validator: (v) => v.split(RegExp(r'\s+')).where((x) => x.isNotEmpty).length < 3 ? 'أدخل الاسم الثلاثي' : null,
          ),
        Field(
          controller: _nid,
          label: 'رقم الهوية / الإقامة',
          hint: '10 أرقام',
          icon: Icons.badge_rounded,
          keyboard: TextInputType.number,
          ltr: true,
          formatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(10)],
          validator: (v) => RegExp(r'^[12]\d{9}$').hasMatch(v) ? null : 'رقم الهوية/الإقامة 10 أرقام يبدأ بـ 1 أو 2',
        ),
        Field(controller: _nationality, label: 'الجنسية', icon: Icons.flag_rounded, maxLength: 60),
        PickerField(
          label: 'الجنس',
          value: _gender,
          options: const ['male', 'female'],
          labels: const ['ذكر', 'أنثى'],
          hint: 'اختر',
          icon: Icons.wc_rounded,
          validator: (v) => v == null ? 'اختر الجنس' : null,
          onChanged: (v) => setState(() => _gender = v),
        ),
        RegionField(value: _region, label: 'مدينة العمل', onChanged: (v) => setState(() => _region = v)),
        if (!widget.applyExisting) ...[
          Field(controller: _phone, label: 'رقم الجوال', hint: '05XXXXXXXX', icon: Icons.phone_iphone_rounded, keyboard: TextInputType.phone, ltr: true, validator: validatePhone),
          Field(controller: _email, label: 'البريد الإلكتروني', hint: 'name@example.com', icon: Icons.alternate_email_rounded, keyboard: TextInputType.emailAddress, ltr: true, validator: validateEmail),
          Field(controller: _pw, label: 'كلمة المرور', hint: '8 أحرف على الأقل', icon: Icons.lock_rounded, password: true, ltr: true, validator: validatePassword),
        ],
      ]),
    );
  }

  Widget _servicesStep() {
    final services = PublicScope.of(context).services;
    if (services.isEmpty) return const EmptyState(icon: Icons.design_services_outlined, title: 'لا توجد خدمات بعد');
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('اختر الخدمات التي تقدمها، وستصلك طلباتها فقط', style: TextStyle(color: Brand.mutedFg)),
      const SizedBox(height: 12),
      ServicesGrid(
        services: services,
        selected: _services,
        onToggle: (id) => setState(() => _services.contains(id) ? _services.remove(id) : _services.add(id)),
      ),
      const SizedBox(height: 12),
    ]);
  }

  Widget _docsStep() {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const Text('أرفق المستندات للتحقق من حسابك. تبقى مستنداتك خاصة ولا يطّلع عليها إلا فريق المراجعة.', style: TextStyle(color: Brand.mutedFg, height: 1.6)),
      const SizedBox(height: 12),
      DocSlot(
        label: 'الهوية / الإقامة',
        doc: _idDoc,
        onPick: () async {
          final d = await pickDocument(context, 'الهوية / الإقامة');
          if (d != null) setState(() => _idDoc = d);
        },
      ),
      DocSlot(
        label: 'الشهادة أو ما يثبت الخبرة',
        doc: _certDoc,
        onPick: () async {
          final d = await pickDocument(context, 'الشهادة');
          if (d != null) setState(() => _certDoc = d);
        },
      ),
      CheckboxListTile(
        value: _agree,
        onChanged: (v) => setState(() => _agree = v ?? false),
        contentPadding: EdgeInsets.zero,
        controlAffinity: ListTileControlAffinity.leading,
        title: Text.rich(TextSpan(children: [
          const TextSpan(text: 'أوافق على '),
          WidgetSpan(
            alignment: PlaceholderAlignment.middle,
            child: GestureDetector(
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const PoliciesPage(audience: 'providers'))),
              child: Text('شروط مقدمي الخدمة', style: TextStyle(color: Theme.of(context).colorScheme.primary, fontWeight: FontWeight.w700)),
            ),
          ),
        ]), style: const TextStyle(fontSize: 13.5)),
      ),
    ]);
  }
}

/// Two-column grid of services that can be toggled on and off.
class ServicesGrid extends StatelessWidget {
  const ServicesGrid({super.key, required this.services, required this.selected, required this.onToggle, this.showPrice = false});
  final List<Service> services;
  final Set<String> selected;
  final ValueChanged<String> onToggle;
  final bool showPrice;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 8,
      crossAxisSpacing: 8,
      childAspectRatio: 2.6,
      children: [
        for (final s in services)
          Material(
            color: selected.contains(s.id) ? primary.withValues(alpha: 0.08) : Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
              side: BorderSide(color: selected.contains(s.id) ? primary : Brand.border, width: selected.contains(s.id) ? 1.4 : 1),
            ),
            child: InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: () => onToggle(s.id),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Row(children: [
                  ServiceIcon(icon: s.icon, color: s.color, size: 34),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(s.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
                      if (showPrice) Text('${s.coinPrice} كوين/طلب', style: const TextStyle(fontSize: 10.5, color: Brand.mutedFg)),
                    ]),
                  ),
                  if (selected.contains(s.id)) Icon(Icons.check_circle_rounded, size: 18, color: primary),
                ]),
              ),
            ),
          ),
      ],
    );
  }
}
