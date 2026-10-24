import 'dart:async';

import 'package:flutter/material.dart';

import 'api.dart';
import 'auth_ui.dart';
import 'format.dart';
import 'models.dart';
import 'public_data.dart';
import 'session.dart';
import 'theme.dart';
import 'widgets.dart';

/* ======================= Notifications ======================= */

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key});
  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  List<AppNotification>? _items;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = SessionScope.read(context).api;
    try {
      final list = jList(await api.get('/api/me/notifications')).map(AppNotification.new).toList();
      if (!mounted) return;
      setState(() {
        _items = list;
        _error = null;
      });
      final unread = list.where((n) => !n.read).map((n) => n.id).toList();
      if (unread.isNotEmpty) unawaited(api.post('/api/me/notifications/read', {'ids': unread}).catchError((_) => null));
    } catch (e) {
      if (mounted) setState(() => _error = errMsg(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = _items;
    return Scaffold(
      appBar: AppBar(title: const Text('الإشعارات')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _error != null && items == null
            ? ListView(children: [ErrorRetry(message: _error!, onRetry: _load)])
            : items == null
                ? const Loading()
                : items.isEmpty
                    ? ListView(children: const [EmptyState(icon: Icons.notifications_none_rounded, title: 'لا توجد إشعارات', message: 'ستظهر هنا تحديثات طلباتك ورسائل الإدارة.')])
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: items.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (_, i) {
                          final n = items[i];
                          return AppCard(
                            color: n.read ? Colors.white : const Color(0xFFF1F6FF),
                            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Container(
                                width: 40,
                                height: 40,
                                decoration: BoxDecoration(color: Brand.primary.withValues(alpha: 0.1), shape: BoxShape.circle),
                                child: const Icon(Icons.notifications_rounded, color: Brand.primary, size: 21),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Row(children: [
                                    Expanded(child: Text(n.title, style: const TextStyle(fontWeight: FontWeight.w800))),
                                    Text(timeAgo(n.at), style: const TextStyle(fontSize: 11, color: Brand.mutedFg)),
                                  ]),
                                  const SizedBox(height: 3),
                                  Text(n.body, style: const TextStyle(color: Brand.mutedFg, height: 1.5, fontSize: 13)),
                                ]),
                              ),
                            ]),
                          );
                        },
                      ),
      ),
    );
  }
}

/* ======================= Messages with administration ======================= */

class SupportMessagesPage extends StatefulWidget {
  const SupportMessagesPage({super.key});
  @override
  State<SupportMessagesPage> createState() => _SupportMessagesPageState();
}

class _SupportMessagesPageState extends State<SupportMessagesPage> {
  List<ChatMessage>? _items;
  final _ctrl = TextEditingController();
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final s = SessionScope.read(context);
    try {
      final list = jList(await s.api.get('/api/me/messages')).map(ChatMessage.new).toList();
      if (!mounted) return;
      setState(() {
        _items = list;
        _error = null;
      });
      for (final m in list.where((m) => m.recipientId == s.profile?.id && m.readAt == null)) {
        unawaited(s.api.post('/api/me/messages/${m.id}/read').catchError((_) => null));
      }
    } catch (e) {
      if (mounted) setState(() => _error = errMsg(e));
    }
  }

  Future<void> _send() async {
    final text = _ctrl.text.trim();
    if (text.isEmpty) return;
    final api = SessionScope.read(context).api;
    try {
      await api.post('/api/me/messages', {'body': text});
      _ctrl.clear();
      await _load();
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = SessionScope.of(context).profile?.id;
    final items = _items;
    return Scaffold(
      appBar: AppBar(title: const Text('مراسلة الإدارة')),
      body: Column(children: [
        Expanded(
          child: _error != null && items == null
              ? ErrorRetry(message: _error!, onRetry: _load)
              : items == null
                  ? const Loading()
                  : items.isEmpty
                      ? const EmptyState(icon: Icons.support_agent_rounded, title: 'تواصل مع فريق مهمة', message: 'اكتب رسالتك وسيرد عليك فريق الإدارة هنا.')
                      : ListView.builder(
                          reverse: true,
                          padding: const EdgeInsets.all(16),
                          itemCount: items.length,
                          itemBuilder: (_, i) {
                            final m = items[i];
                            return _Bubble(mine: m.senderId == me, text: m.body, at: m.createdAt, name: m.senderId == me ? null : (m.senderName ?? 'الإدارة'));
                          },
                        ),
        ),
        _Composer(controller: _ctrl, onSend: _send),
      ]),
    );
  }
}

/* ======================= Order chat (customer ↔ provider) ======================= */

class OrderChatPage extends StatefulWidget {
  const OrderChatPage({super.key, required this.orderId, required this.title, this.canSend = true});
  final String orderId;
  final String title;
  final bool canSend;

  @override
  State<OrderChatPage> createState() => _OrderChatPageState();
}

class _OrderChatPageState extends State<OrderChatPage> {
  List<ChatMessage>? _items;
  final _ctrl = TextEditingController();
  Timer? _timer;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
    _timer = Timer.periodic(const Duration(seconds: 5), (_) => _load());
  }

  @override
  void dispose() {
    _timer?.cancel();
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final api = SessionScope.read(context).api;
    try {
      final list = jList(await api.get('/api/orders/${widget.orderId}/messages')).map(ChatMessage.new).toList();
      if (mounted) {
        setState(() {
          _items = list.reversed.toList();
          _error = null;
        });
      }
    } catch (e) {
      if (mounted && _items == null) setState(() => _error = errMsg(e));
    }
  }

  Future<void> _send() async {
    final text = _ctrl.text.trim();
    if (text.isEmpty) return;
    final api = SessionScope.read(context).api;
    try {
      _ctrl.clear();
      await api.post('/api/orders/${widget.orderId}/messages', {'body': text});
      await _load();
    } catch (e) {
      _ctrl.text = text;
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = SessionScope.of(context).profile?.id;
    final items = _items;
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: Column(children: [
        Expanded(
          child: _error != null && items == null
              ? ErrorRetry(message: _error!, onRetry: _load)
              : items == null
                  ? const Loading()
                  : items.isEmpty
                      ? const EmptyState(icon: Icons.chat_bubble_outline_rounded, title: 'لا توجد رسائل بعد', message: 'ابدأ المحادثة لتنسيق تفاصيل الطلب.')
                      : ListView.builder(
                          reverse: true,
                          padding: const EdgeInsets.all(16),
                          itemCount: items.length,
                          itemBuilder: (_, i) => _Bubble(mine: items[i].senderId == me, text: items[i].body, at: items[i].createdAt),
                        ),
        ),
        if (widget.canSend)
          _Composer(controller: _ctrl, onSend: _send)
        else
          const SafeArea(top: false, child: Padding(padding: EdgeInsets.all(14), child: Text('المحادثة مغلقة لهذا الطلب', style: TextStyle(color: Brand.mutedFg)))),
      ]),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.mine, required this.text, this.at, this.name});
  final bool mine;
  final String text;
  final DateTime? at;
  final String? name;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return Align(
      alignment: mine ? AlignmentDirectional.centerStart : AlignmentDirectional.centerEnd,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.75),
        padding: const EdgeInsets.fromLTRB(14, 9, 14, 7),
        decoration: BoxDecoration(
          color: mine ? primary : Colors.white,
          border: mine ? null : Border.all(color: Brand.border),
          borderRadius: BorderRadiusDirectional.only(
            topStart: const Radius.circular(18),
            topEnd: const Radius.circular(18),
            bottomStart: Radius.circular(mine ? 4 : 18),
            bottomEnd: Radius.circular(mine ? 18 : 4),
          ),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (name != null) Text(name!, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: primary)),
          Text(text, style: TextStyle(color: mine ? Colors.white : Brand.foreground, height: 1.45)),
          if (at != null)
            Text(fmtTime(at!), style: TextStyle(fontSize: 10.5, color: mine ? Colors.white70 : Brand.mutedFg)),
        ]),
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({required this.controller, required this.onSend});
  final TextEditingController controller;
  final Future<void> Function() onSend;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Brand.border))),
      padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
      child: SafeArea(
        top: false,
        child: Row(children: [
          Expanded(
            child: TextField(
              controller: controller,
              minLines: 1,
              maxLines: 4,
              maxLength: 1000,
              textInputAction: TextInputAction.newline,
              decoration: const InputDecoration(hintText: 'اكتب رسالتك…', counterText: '', fillColor: Brand.muted, enabledBorder: InputBorder.none),
            ),
          ),
          const SizedBox(width: 8),
          IconButton.filled(onPressed: onSend, icon: const Icon(Icons.send_rounded, textDirection: TextDirection.rtl)),
        ]),
      ),
    );
  }
}

/* ======================= Policies ======================= */

class PoliciesPage extends StatelessWidget {
  const PoliciesPage({super.key, required this.audience});

  /// customers | providers
  final String audience;

  @override
  Widget build(BuildContext context) {
    final list = PublicScope.of(context).policiesFor(audience);
    return Scaffold(
      appBar: AppBar(title: const Text('السياسات والشروط')),
      body: list.isEmpty
          ? const EmptyState(icon: Icons.policy_rounded, title: 'لا توجد سياسات منشورة بعد')
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: list.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (c, i) => AppCard(
                onTap: () => Navigator.push(c, MaterialPageRoute(builder: (_) => PolicyPage(policy: list[i]))),
                child: Row(children: [
                  const Icon(Icons.description_rounded, color: Brand.primary),
                  const SizedBox(width: 12),
                  Expanded(child: Text(list[i].title, style: const TextStyle(fontWeight: FontWeight.w700))),
                  const Icon(Icons.chevron_left_rounded, color: Brand.mutedFg),
                ]),
              ),
            ),
    );
  }
}

class PolicyPage extends StatelessWidget {
  const PolicyPage({super.key, required this.policy});
  final Policy policy;
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(policy.title)),
        body: ListView(padding: const EdgeInsets.all(20), children: [
          if (policy.updatedAt != null) Text('آخر تحديث: ${fmtDate(policy.updatedAt)}', style: const TextStyle(color: Brand.mutedFg, fontSize: 12)),
          const SizedBox(height: 10),
          SelectableText(policy.body, style: const TextStyle(height: 1.8, fontSize: 14.5)),
        ]),
      );
}

/* ======================= Profile, password, delete account ======================= */

class ProfileEditPage extends StatefulWidget {
  const ProfileEditPage({super.key, this.showBio = false});
  final bool showBio;
  @override
  State<ProfileEditPage> createState() => _ProfileEditPageState();
}

class _ProfileEditPageState extends State<ProfileEditPage> {
  final _form = GlobalKey<FormState>();
  late final Profile? _p = SessionScope.read(context).profile;
  late final _name = TextEditingController(text: _p?.fullName ?? '');
  late final _phone = TextEditingController(text: _p?.phone ?? '');
  late final _email = TextEditingController(text: _p?.email ?? '');
  late final _bio = TextEditingController(text: _p?.bio ?? '');
  late String? _region = _p?.region;

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    final s = SessionScope.read(context);
    try {
      final me = await s.api.patch('/api/me', {
        'full_name': _name.text.trim(),
        if (_phone.text.trim().isNotEmpty) 'phone': _phone.text.trim(),
        if (_email.text.trim().isNotEmpty) 'email': _email.text.trim(),
        if (_region != null) 'region': _region,
        if (widget.showBio) 'bio': _bio.text.trim(),
      });
      s.applyMe(me);
      if (mounted) {
        showSnack(context, 'تم حفظ بياناتك');
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('الملف الشخصي')),
      body: Form(
        key: _form,
        child: ListView(padding: const EdgeInsets.all(18), children: [
          Field(controller: _name, label: 'الاسم', icon: Icons.person_rounded, validator: (v) => v.length < 2 ? 'أدخل الاسم' : null),
          Field(controller: _phone, label: 'رقم الجوال', icon: Icons.phone_iphone_rounded, keyboard: TextInputType.phone, ltr: true, validator: (v) => v.isEmpty ? null : validatePhone(v)),
          Field(controller: _email, label: 'البريد الإلكتروني', icon: Icons.alternate_email_rounded, keyboard: TextInputType.emailAddress, ltr: true, validator: validateEmail),
          RegionField(value: _region, required: false, onChanged: (v) => setState(() => _region = v)),
          if (widget.showBio) Field(controller: _bio, label: 'نبذة عنك', icon: Icons.info_outline_rounded, maxLines: 4, maxLength: 500),
          const SizedBox(height: 8),
          BusyButton(label: 'حفظ', icon: Icons.check_rounded, onPressed: _save),
        ]),
      ),
    );
  }
}

class ChangePasswordPage extends StatefulWidget {
  const ChangePasswordPage({super.key});
  @override
  State<ChangePasswordPage> createState() => _ChangePasswordPageState();
}

class _ChangePasswordPageState extends State<ChangePasswordPage> {
  final _form = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _again = TextEditingController();

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    try {
      await SessionScope.read(context).api.post('/api/me/password', {'current': _current.text, 'next': _next.text});
      if (mounted) {
        showSnack(context, 'تم تغيير كلمة المرور');
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('تغيير كلمة المرور')),
        body: Form(
          key: _form,
          child: ListView(padding: const EdgeInsets.all(18), children: [
            Field(controller: _current, label: 'كلمة المرور الحالية', icon: Icons.lock_outline_rounded, password: true, ltr: true, validator: (v) => requiredField(v, 'كلمة المرور الحالية')),
            Field(controller: _next, label: 'كلمة المرور الجديدة', icon: Icons.lock_rounded, password: true, ltr: true, validator: validatePassword),
            Field(controller: _again, label: 'تأكيد كلمة المرور', icon: Icons.lock_rounded, password: true, ltr: true, validator: (v) => v != _next.text.trim() ? 'كلمتا المرور غير متطابقتين' : null),
            const SizedBox(height: 8),
            BusyButton(label: 'تغيير كلمة المرور', onPressed: _save),
          ]),
        ),
      );
}

/// Permanent account deletion (required by App Store and Google Play).
Future<void> deleteAccountFlow(BuildContext context) async {
  final ok = await confirm(context,
      title: 'حذف الحساب نهائياً',
      message: 'سيتم حذف حسابك وبياناتك ولا يمكن التراجع. الطلبات الجارية يجب إكمالها أو إلغاؤها أولاً.',
      ok: 'متابعة',
      danger: true);
  if (!ok || !context.mounted) return;
  final pw = await promptText(context, title: 'أدخل كلمة المرور للتأكيد', obscure: true, required: true, ok: 'حذف الحساب', danger: true);
  if (pw == null || !context.mounted) return;
  final s = SessionScope.read(context);
  try {
    await s.api.post('/api/me/delete', {'password': pw});
    await s.signOut();
    if (context.mounted) {
      Navigator.of(context).popUntil((r) => r.isFirst);
      showSnack(context, 'تم حذف حسابك');
    }
  } catch (e) {
    if (context.mounted) showError(context, e);
  }
}

/// Signs out after confirmation and returns to the first screen.
Future<void> signOutFlow(BuildContext context) async {
  if (!await confirm(context, title: 'تسجيل الخروج', message: 'هل تريد تسجيل الخروج من حسابك؟', ok: 'خروج')) return;
  if (!context.mounted) return;
  await SessionScope.read(context).signOut();
  if (context.mounted) Navigator.of(context).popUntil((r) => r.isFirst);
}

/// Bottom sheet asking for a 1–5 rating (and a reason for low ratings when [withReview]).
Future<(int, String?)?> askRating(BuildContext context, {required String title, bool withReview = true}) {
  return showModalBottomSheet<(int, String?)>(
    context: context,
    isScrollControlled: true,
    builder: (c) => _RatingSheet(title: title, withReview: withReview),
  );
}

class _RatingSheet extends StatefulWidget {
  const _RatingSheet({required this.title, required this.withReview});
  final String title;
  final bool withReview;
  @override
  State<_RatingSheet> createState() => _RatingSheetState();
}

class _RatingSheetState extends State<_RatingSheet> {
  int _value = 0;
  final _review = TextEditingController();

  @override
  Widget build(BuildContext context) {
    final low = _value > 0 && _value <= 2;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.viewInsetsOf(context).bottom + 20),
      child: SafeArea(
        top: false,
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(widget.title, textAlign: TextAlign.center, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          StarPicker(value: _value, onChanged: (v) => setState(() => _value = v)),
          if (widget.withReview) ...[
            const SizedBox(height: 8),
            TextField(
              controller: _review,
              maxLines: 3,
              minLines: 2,
              maxLength: 500,
              decoration: InputDecoration(hintText: low ? 'اكتب سبب التقييم المنخفض (مطلوب)' : 'ملاحظة (اختياري)'),
            ),
          ],
          const SizedBox(height: 8),
          FilledButton(
            onPressed: _value == 0
                ? null
                : () {
                    final text = _review.text.trim();
                    if (widget.withReview && low && text.isEmpty) {
                      showSnack(context, 'اكتب سبب التقييم المنخفض', error: true);
                      return;
                    }
                    Navigator.pop(context, (_value, text.isEmpty ? null : text));
                  },
            child: const Text('إرسال التقييم'),
          ),
        ]),
      ),
    );
  }
}
