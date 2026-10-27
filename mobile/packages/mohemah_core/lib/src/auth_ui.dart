import 'package:flutter/material.dart' hide Text;

import 'i18n.dart';

import 'branding.dart';
import 'package:flutter/services.dart';

import 'models.dart';
import 'public_data.dart';
import 'session.dart';
import 'theme.dart';
import 'widgets.dart';

/// Text field with a label above it (matches the web forms).
class Field extends StatefulWidget {
  const Field({
    super.key,
    required this.controller,
    required this.label,
    this.hint,
    this.icon,
    this.keyboard,
    this.password = false,
    this.maxLines = 1,
    this.maxLength,
    this.ltr = false,
    this.validator,
    this.formatters,
    this.textInputAction,
    this.autofill,
  });

  final TextEditingController controller;
  final String label;
  final String? hint;
  final IconData? icon;
  final TextInputType? keyboard;
  final bool password;
  final int maxLines;
  final int? maxLength;
  final bool ltr;
  final String? Function(String)? validator;
  final List<TextInputFormatter>? formatters;
  final TextInputAction? textInputAction;
  final Iterable<String>? autofill;

  @override
  State<Field> createState() => _FieldState();
}

class _FieldState extends State<Field> {
  bool _hidden = true;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 6, right: 2),
          child: Text(widget.label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
        ),
        TextFormField(
          controller: widget.controller,
          keyboardType: widget.keyboard,
          obscureText: widget.password && _hidden,
          maxLines: widget.password ? 1 : widget.maxLines,
          minLines: 1,
          maxLength: widget.maxLength,
          inputFormatters: widget.formatters,
          textInputAction: widget.textInputAction,
          autofillHints: widget.autofill,
          textDirection: widget.ltr ? TextDirection.ltr : null,
          validator: widget.validator == null ? null : (v) { final e = widget.validator!(v?.trim() ?? ''); return e == null ? null : tr(e); },
          decoration: InputDecoration(
            hintText: widget.hint == null ? null : tr(widget.hint!),
            hintTextDirection: widget.ltr ? TextDirection.ltr : null,
            prefixIcon: widget.icon == null ? null : Icon(widget.icon, color: Brand.mutedFg, size: 21),
            suffixIcon: widget.password
                ? IconButton(
                    onPressed: () => setState(() => _hidden = !_hidden),
                    icon: Icon(_hidden ? Icons.visibility_outlined : Icons.visibility_off_outlined, color: Brand.mutedFg),
                  )
                : null,
          ),
        ),
      ]),
    );
  }
}

/// Dropdown of Saudi cities from the public bootstrap.
class RegionField extends StatelessWidget {
  const RegionField({super.key, required this.value, required this.onChanged, this.label = 'المدينة', this.required = true});
  final String? value;
  final ValueChanged<String?> onChanged;
  final String label;
  final bool required;

  @override
  Widget build(BuildContext context) {
    final regions = PublicScope.of(context).regions;
    return PickerField(
      label: label,
      value: value,
      options: regions,
      hint: 'اختر المدينة',
      icon: Icons.location_city_outlined,
      validator: required ? (v) => v == null ? 'اختر المدينة' : null : null,
      onChanged: onChanged,
    );
  }
}

/// Form field that opens a bottom sheet list to choose one option.
class PickerField extends StatelessWidget {
  const PickerField({
    super.key,
    required this.label,
    required this.value,
    required this.options,
    required this.onChanged,
    this.hint = 'اختر',
    this.icon,
    this.validator,
    this.labels,
  });

  final String label;
  final String? value;
  final List<String> options;
  final ValueChanged<String?> onChanged;
  final String hint;
  final IconData? icon;
  final String? Function(String?)? validator;

  /// Optional display labels for each option (same order as [options]).
  final List<String>? labels;

  String _labelOf(String v) {
    final i = options.indexOf(v);
    return labels != null && i >= 0 && i < labels!.length ? labels![i] : v;
  }

  Future<void> _open(BuildContext context, FormFieldState<String> state) async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (c) => ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(c).height * 0.7),
        child: SafeArea(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(label, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Flexible(
              child: ListView(shrinkWrap: true, children: [
                for (final o in options)
                  ListTile(
                    title: Text(_labelOf(o), style: TextStyle(fontWeight: o == state.value ? FontWeight.w800 : FontWeight.w500)),
                    trailing: o == state.value ? Icon(Icons.check_circle_outlined, color: Theme.of(c).colorScheme.primary) : null,
                    onTap: () => Navigator.pop(c, o),
                  ),
              ]),
            ),
          ]),
        ),
      ),
    );
    if (picked != null) {
      state.didChange(picked);
      onChanged(picked);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FormField<String>(
      key: ValueKey('$label|$value'),
      initialValue: options.contains(value) ? value : null,
      validator: validator,
      builder: (state) => Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(padding: const EdgeInsets.only(bottom: 6, right: 2), child: Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700))),
          InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: () => _open(context, state),
            child: InputDecorator(
              isEmpty: state.value == null,
              decoration: InputDecoration(
                errorText: state.errorText == null ? null : tr(state.errorText!),
                prefixIcon: icon == null ? null : Icon(icon, color: Brand.mutedFg, size: 21),
                suffixIcon: const Icon(Icons.keyboard_arrow_down_outlined, color: Brand.mutedFg),
              ),
              child: Text(state.value == null ? hint : _labelOf(state.value!),
                  style: TextStyle(fontSize: 15, color: state.value == null ? Brand.mutedFg : Brand.foreground)),
            ),
          ),
        ]),
      ),
    );
  }
}

String? validateEmail(String v) => RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(v) ? null : 'البريد الإلكتروني غير صحيح';
String? validatePhone(String v) => RegExp(r'^(05\d{8}|\+?9665\d{8})$').hasMatch(v.replaceAll(' ', '')) ? null : 'رقم الجوال غير صحيح (05XXXXXXXX)';
String? validatePassword(String v) => v.length < 8 ? 'كلمة المرور 8 أحرف على الأقل' : null;
String? requiredField(String v, String label) => v.isEmpty ? 'أدخل $label' : null;

/// Brand background with the logo on top and a white sheet for the form.
class AuthScaffold extends StatelessWidget {
  const AuthScaffold({super.key, required this.title, required this.subtitle, required this.child, this.gradient = Brand.gradient, this.showBack = true});
  final String title;
  final String subtitle;
  final Widget child;
  final Gradient gradient;
  final bool showBack;

  @override
  Widget build(BuildContext context) {
    final canPop = Navigator.of(context).canPop();
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(statusBarColor: Colors.transparent),
      child: Scaffold(
        body: Container(
          decoration: BoxDecoration(gradient: gradient),
          child: SafeArea(
            bottom: false,
            child: Column(children: [
              SizedBox(
                height: 48,
                child: Row(children: [
                  if (showBack && canPop)
                    IconButton(onPressed: () => Navigator.pop(context), icon: const BackButtonIcon(), color: Colors.white),
                  const Spacer(),
                  TextButton.icon(
                    onPressed: () => pickLanguage(context),
                    style: TextButton.styleFrom(foregroundColor: Colors.white),
                    icon: const Icon(Icons.translate_rounded, size: 18),
                    label: Text(currentLanguageName, translate: false),
                  ),
                ]),
              ),
              const AppLogo(height: 64),
              const SizedBox(height: 10),
              Text(title, style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800)),
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 2, 24, 18),
                child: Text(subtitle, textAlign: TextAlign.center, style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 13.5)),
              ),
              Expanded(
                child: Container(
                  width: double.infinity,
                  decoration: const BoxDecoration(color: Brand.background, borderRadius: BorderRadius.vertical(top: Radius.circular(30))),
                  child: ClipRRect(borderRadius: const BorderRadius.vertical(top: Radius.circular(30)), child: child),
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

/// Email / username + password sign-in for the current app.
class LoginForm extends StatefulWidget {
  const LoginForm({super.key, required this.onSuccess, this.footer});
  final VoidCallback onSuccess;
  final Widget? footer;

  @override
  State<LoginForm> createState() => _LoginFormState();
}

class _LoginFormState extends State<LoginForm> {
  final _form = GlobalKey<FormState>();
  final _id = TextEditingController();
  final _pw = TextEditingController();

  @override
  void dispose() {
    _id.dispose();
    _pw.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    try {
      await SessionScope.read(context).signIn(_id.text, _pw.text);
      TextInput.finishAutofillContext();
      if (mounted) widget.onSuccess();
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
          Field(
            controller: _id,
            label: 'البريد أو اسم المستخدم أو رقم الجوال',
            hint: 'name@example.com / 05XXXXXXXX',
            icon: Icons.person_outline,
            keyboard: TextInputType.emailAddress,
            ltr: true,
            textInputAction: TextInputAction.next,
            autofill: const [AutofillHints.email, AutofillHints.username, AutofillHints.telephoneNumber],
            validator: (v) => requiredField(v, 'البريد أو اسم المستخدم أو رقم الجوال'),
          ),
          Field(
            controller: _pw,
            label: 'كلمة المرور',
            icon: Icons.lock_outlined,
            password: true,
            ltr: true,
            textInputAction: TextInputAction.done,
            autofill: const [AutofillHints.password],
            validator: (v) => requiredField(v, 'كلمة المرور'),
          ),
          const SizedBox(height: 6),
          BusyButton(label: 'تسجيل الدخول', icon: Icons.login_outlined, onPressed: _submit),
          const SizedBox(height: 10),
          const LanguageSwitcher(),
          TextButton.icon(
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ForgotPasswordPage())),
            icon: const Icon(Icons.lock_reset_outlined, size: 19),
            label: const Text('نسيت كلمة المرور أو بيانات الدخول؟'),
          ),
          if (widget.footer != null) ...[const SizedBox(height: 12), widget.footer!],
        ]),
      ),
    );
  }
}

/// Segmented "sign in / new account" switcher used by both auth screens.
class AuthTabs extends StatelessWidget {
  const AuthTabs({super.key, required this.index, required this.onChanged, this.labels = const ['تسجيل الدخول', 'حساب جديد']});
  final int index;
  final ValueChanged<int> onChanged;
  final List<String> labels;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: Brand.muted, borderRadius: BorderRadius.circular(16)),
      child: Row(children: [
        for (var i = 0; i < labels.length; i++)
          Expanded(
            child: GestureDetector(
              onTap: () => onChanged(i),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(vertical: 11),
                decoration: BoxDecoration(
                  color: i == index ? Colors.white : Colors.transparent,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: i == index ? [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 8, offset: const Offset(0, 2))] : null,
                ),
                alignment: Alignment.center,
                child: Text(labels[i],
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: i == index ? Theme.of(context).colorScheme.primary : Brand.mutedFg)),
              ),
            ),
          ),
      ]),
    );
  }
}


/// Account / password recovery: a 6-digit code (with the sign-in details) is sent by SMS or e-mail, then a new password is set.
class ForgotPasswordPage extends StatefulWidget {
  const ForgotPasswordPage({super.key});
  @override
  State<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends State<ForgotPasswordPage> {
  final _id = TextEditingController();
  final _code = TextEditingController();
  final _pw = TextEditingController();
  final _pw2 = TextEditingController();
  String _channel = 'sms';
  String? _sentTo;

  @override
  void dispose() {
    for (final c in [_id, _code, _pw, _pw2]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _send() async {
    if (_id.text.trim().isEmpty) {
      showSnack(context, 'اكتب رقم الجوال أو البريد المسجّل', error: true);
      return;
    }
    try {
      final r = jMap(await SessionScope.read(context).api.post('/api/auth/forgot', {'identifier': _id.text.trim(), 'channel': _channel}));
      if (!mounted) return;
      setState(() => _sentTo = jS(r['sent_to']));
      showSnack(context, 'أرسلنا رمز الاستعادة وبيانات دخولك إلى ${_sentTo ?? ''}');
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  Future<void> _reset() async {
    if (_code.text.trim().length < 6) {
      showSnack(context, 'اكتب الرمز المكوّن من 6 أرقام', error: true);
      return;
    }
    if (_pw.text.length < 8 || _pw.text != _pw2.text) {
      showSnack(context, _pw.text.length < 8 ? 'كلمة المرور 8 أحرف على الأقل' : 'كلمتا المرور غير متطابقتين', error: true);
      return;
    }
    try {
      await SessionScope.read(context).api.post('/api/auth/reset', {'identifier': _id.text.trim(), 'code': _code.text.trim(), 'password': _pw.text});
      if (!mounted) return;
      showSnack(context, 'تم تغيير كلمة المرور، سجّل الدخول الآن');
      Navigator.pop(context);
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = PublicScope.of(context).settings;
    final channels = <(String, IconData, String)>[
      if (s.recoverySms || !s.recoveryEmail) ('sms', Icons.sms_outlined, 'رسالة للجوال'),
      if (s.recoveryEmail) ('email', Icons.alternate_email, 'البريد الإلكتروني'),
    ];
    if (!channels.any((c) => c.$1 == _channel)) _channel = channels.first.$1;
    return Scaffold(
      appBar: AppBar(title: const Text('استعادة الحساب')),
      body: ListView(padding: const EdgeInsets.all(20), children: [
        const Icon(Icons.lock_reset_outlined, size: 64, color: Brand.primary),
        const SizedBox(height: 10),
        const Text('نرسل لك رمز استعادة مع بيانات دخولك (البريد والجوال ورقم العضوية)، ثم تعيّن كلمة مرور جديدة.',
            textAlign: TextAlign.center, style: TextStyle(height: 1.7, color: Brand.mutedFg)),
        const SizedBox(height: 18),
        Field(controller: _id, label: 'رقم الجوال أو البريد المسجّل', hint: '05XXXXXXXX / name@example.com', icon: Icons.person_outline, ltr: true, keyboard: TextInputType.emailAddress),
        const Text('طريقة الإرسال', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        Row(children: [
          for (final c in channels)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 3),
                child: ChoiceChip(
                  selected: _channel == c.$1,
                  onSelected: (_) => setState(() => _channel = c.$1),
                  avatar: Icon(c.$2, size: 18),
                  label: Text(c.$3),
                ),
              ),
            ),
        ]),
        const SizedBox(height: 12),
        BusyButton(label: _sentTo == null ? 'إرسال الرمز' : 'إعادة إرسال الرمز', icon: Icons.send_outlined, onPressed: _send),
        if (_sentTo != null) ...[
          const SizedBox(height: 20),
          Text('أُرسل الرمز إلى $_sentTo', textAlign: TextAlign.center, textDirection: TextDirection.rtl, style: const TextStyle(fontWeight: FontWeight.w700, color: Brand.success)),
          const SizedBox(height: 12),
          Field(controller: _code, label: 'رمز الاستعادة', hint: '6 أرقام', icon: Icons.pin_outlined, ltr: true, keyboard: TextInputType.number, maxLength: 6),
          Field(controller: _pw, label: 'كلمة المرور الجديدة', icon: Icons.lock_outlined, password: true, ltr: true),
          Field(controller: _pw2, label: 'تأكيد كلمة المرور', icon: Icons.lock_outlined, password: true, ltr: true),
          BusyButton(label: 'تعيين كلمة المرور', icon: Icons.check_circle_outline, onPressed: _reset),
        ],
      ]),
    );
  }
}
