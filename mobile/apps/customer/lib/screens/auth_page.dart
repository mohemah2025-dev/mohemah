import 'package:flutter/material.dart';
import 'package:mohemah_core/mohemah_core.dart';

/// Opens the sign-in screen when needed; returns true once the customer is signed in.
Future<bool> ensureSignedIn(BuildContext context, {String? reason}) async {
  if (SessionScope.read(context).signedIn) return true;
  final ok = await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => CustomerAuthPage(reason: reason), fullscreenDialog: true));
  return ok == true;
}

/// Customer sign-in and registration (customer registration lives only in this app).
class CustomerAuthPage extends StatefulWidget {
  const CustomerAuthPage({super.key, this.reason, this.startWithRegister = false});
  final String? reason;
  final bool startWithRegister;

  @override
  State<CustomerAuthPage> createState() => _CustomerAuthPageState();
}

class _CustomerAuthPageState extends State<CustomerAuthPage> {
  late int _tab = widget.startWithRegister ? 1 : 0;

  void _done() => Navigator.of(context).pop(true);

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: _tab == 0 ? 'أهلاً بعودتك' : 'حساب جديد',
      subtitle: widget.reason ?? 'سجّل دخولك لطلب الخدمات ومتابعة طلباتك',
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 22, 20, 30),
        children: [
          AuthTabs(index: _tab, onChanged: (i) => setState(() => _tab = i)),
          const SizedBox(height: 20),
          if (_tab == 0) LoginForm(onSuccess: _done) else _RegisterForm(onSuccess: _done),
        ],
      ),
    );
  }
}

class _RegisterForm extends StatefulWidget {
  const _RegisterForm({required this.onSuccess});
  final VoidCallback onSuccess;
  @override
  State<_RegisterForm> createState() => _RegisterFormState();
}

class _RegisterFormState extends State<_RegisterForm> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _pw = TextEditingController();
  String? _region;
  bool _agree = false;

  @override
  void dispose() {
    for (final c in [_name, _phone, _email, _pw]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    if (!_agree) {
      showSnack(context, 'وافق على الشروط والسياسات للمتابعة', error: true);
      return;
    }
    final s = SessionScope.read(context);
    try {
      final res = await s.api.post('/api/auth/register/customer', {
        'full_name': _name.text.trim(),
        'phone': _phone.text.trim(),
        'email': _email.text.trim(),
        'password': _pw.text,
        if (_region != null) 'region': _region,
      });
      await s.acceptAuth(jMap(res));
      if (mounted) {
        showSnack(context, 'أهلاً بك في مهمة');
        widget.onSuccess();
      }
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AutofillGroup(
      child: Form(
        key: _form,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Field(controller: _name, label: 'الاسم', hint: 'الاسم الكامل', icon: Icons.person_rounded, autofill: const [AutofillHints.name], validator: (v) => v.length < 2 ? 'أدخل الاسم' : null),
          Field(controller: _phone, label: 'رقم الجوال', hint: '05XXXXXXXX', icon: Icons.phone_iphone_rounded, keyboard: TextInputType.phone, ltr: true, autofill: const [AutofillHints.telephoneNumber], validator: validatePhone),
          Field(controller: _email, label: 'البريد الإلكتروني', hint: 'name@example.com', icon: Icons.alternate_email_rounded, keyboard: TextInputType.emailAddress, ltr: true, autofill: const [AutofillHints.email], validator: validateEmail),
          Field(controller: _pw, label: 'كلمة المرور', hint: '8 أحرف على الأقل', icon: Icons.lock_rounded, password: true, ltr: true, autofill: const [AutofillHints.newPassword], validator: validatePassword),
          RegionField(value: _region, required: false, label: 'المدينة (اختياري)', onChanged: (v) => setState(() => _region = v)),
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
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const PoliciesPage(audience: 'customers'))),
                  child: Text('الشروط والسياسات', style: TextStyle(color: Theme.of(context).colorScheme.primary, fontWeight: FontWeight.w700)),
                ),
              ),
            ]), style: const TextStyle(fontSize: 13.5)),
          ),
          const SizedBox(height: 8),
          BusyButton(label: 'إنشاء الحساب', icon: Icons.person_add_alt_1_rounded, onPressed: _submit),
        ]),
      ),
    );
  }
}
