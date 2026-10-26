import 'dart:async';

import 'package:flutter/material.dart';
import 'package:mohemah_core/mohemah_core.dart';

import '../docs.dart';
import 'auth_page.dart';

/// "حسابي" for a signed-in account that is not an approved provider yet:
/// waiting for review, or — after a rejection — which document was refused and why, with re-upload of that one only.
class ApplicationPage extends StatefulWidget {
  const ApplicationPage({super.key});
  @override
  State<ApplicationPage> createState() => _ApplicationPageState();
}

class _ApplicationPageState extends State<ApplicationPage> {
  Timer? _timer;
  List<Map<String, dynamic>> _docs = const [];
  final Map<String, PickedDoc> _new = {};
  String? _lastStatus;

  @override
  void initState() {
    super.initState();
    // Picks up the administrator's decision without reopening the app.
    _timer = Timer.periodic(const Duration(seconds: 30), (_) => SessionScope.read(context).refresh().catchError((_) {}));
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadDocs());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _loadDocs() async {
    try {
      final list = jList(await SessionScope.read(context).api.get('/api/me/documents'));
      if (mounted) setState(() => _docs = list);
    } catch (_) {}
  }

  /// Latest document of a kind (id | certificate).
  Map<String, dynamic>? _latest(String kind) {
    for (final d in _docs) {
      if (d['kind'] == kind) return d;
    }
    return null;
  }

  Future<void> _upload() async {
    final s = SessionScope.read(context);
    try {
      s.applyMe(await s.api.multipart('/api/provider/documents', const {}, [
        if (_new['id'] != null) _new['id']!.upload('id_file'),
        if (_new['certificate'] != null) _new['certificate']!.upload('cert_file'),
      ]));
      setState(_new.clear);
      await _loadDocs();
      if (mounted) showSnack(context, 'تم رفع المستند وإعادة طلبك للمراجعة');
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    final p = s.profile!;
    final status = p.verificationStatus;
    if (status != _lastStatus) {
      _lastStatus = status;
      WidgetsBinding.instance.addPostFrameCallback((_) => _loadDocs());
    }
    final services = PublicScope.of(context).services.where((x) => p.requestedServices.contains(x.id)).toList();
    final open = status == 'pending' || status == 'rejected';
    final rejectedKinds = ['id', 'certificate'].where((k) => _latest(k)?['status'] == 'rejected').toList();
    // Older rejections without a per-document decision: allow re-uploading either document.
    final needs = rejectedKinds.isEmpty ? const ['id', 'certificate'] : rejectedKinds;
    final ready = rejectedKinds.isEmpty ? _new.isNotEmpty : rejectedKinds.every(_new.containsKey);

    return Scaffold(
      appBar: PageHeader.bar('حسابي',
          trailing: IconButton(tooltip: 'تسجيل خروج', onPressed: () => signOutFlow(context), icon: const Icon(Icons.logout_outlined))),
      body: RefreshIndicator(
        onRefresh: () async {
          await s.refresh().catchError((_) {});
          await _loadDocs();
        },
        child: ListView(padding: const EdgeInsets.fromLTRB(18, 6, 18, 30), children: [
          const PolicyLink(audience: 'providers', placement: 'application', prefix: 'اطّلع على '),
          Row(children: [
            Avatar(name: p.fullName, url: p.avatarUrl, radius: 26, color: Brand.primaryDeep),
            const SizedBox(width: 12),
            Expanded(child: Text('أهلاً ${p.firstName}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800))),
          ]),
          const SizedBox(height: 14),
          if (!open) ...[
            const Text('أكمل بياناتك وأرفق مستنداتك لتقديم طلب الانضمام كمقدم خدمة.', style: TextStyle(color: Brand.mutedFg, height: 1.6)),
            const SizedBox(height: 16),
            const ProviderRegisterForm(applyExisting: true),
          ] else if (status == 'pending') ...[
            const _WaitingCard(),
            if (services.isNotEmpty) ...[
              const SectionTitle('الخدمات المطلوبة'),
              Wrap(spacing: 8, runSpacing: 8, children: [
                for (final x in services) Chip(avatar: Icon(serviceIcon(x.icon), size: 18), label: Text(x.name)),
              ]),
            ],
          ] else ...[
            _RejectedCard(note: p.reviewNote),
            const SectionTitle('حالة المستندات'),
            for (final kind in const ['id', 'certificate'])
              _DocStatus(
                kind: kind,
                doc: _latest(kind),
                picked: _new[kind],
                canUpload: needs.contains(kind),
                onPick: () async {
                  final d = await pickDocument(context, kind == 'id' ? 'الهوية / الإقامة' : 'الشهادة');
                  if (d != null) setState(() => _new[kind] = d);
                },
              ),
            const SizedBox(height: 8),
            BusyButton(label: 'إرسال للمراجعة', icon: Icons.cloud_upload_outlined, onPressed: ready ? _upload : null),
          ],
        ]),
      ),
    );
  }
}

class _WaitingCard extends StatelessWidget {
  const _WaitingCard();
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(color: Brand.warning.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(22)),
        child: const Column(children: [
          Icon(Icons.hourglass_top_outlined, color: Brand.warning, size: 44),
          SizedBox(height: 10),
          Text('بانتظار المراجعة', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: Brand.warning)),
          SizedBox(height: 6),
          Text('يراجع فريق مهمة بياناتك ومستنداتك، وسيتفعّل استقبال الطلبات تلقائياً بعد الموافقة.',
              textAlign: TextAlign.center, style: TextStyle(height: 1.6)),
        ]),
      );
}

class _RejectedCard extends StatelessWidget {
  const _RejectedCard({this.note});
  final String? note;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(color: Brand.danger.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(22)),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Icon(Icons.error_outlined, color: Brand.danger, size: 32),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('يلزم تعديل في طلبك', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Brand.danger)),
              const SizedBox(height: 4),
              Text(note?.isNotEmpty == true ? note! : 'أعد رفع المستند المطلوب أدناه.', style: const TextStyle(height: 1.6)),
            ]),
          ),
        ]),
      );
}

/// One document with ✓ (accepted), ✗ + reason + re-upload (rejected), or "under review".
class _DocStatus extends StatelessWidget {
  const _DocStatus({required this.kind, required this.doc, required this.picked, required this.onPick, required this.canUpload});
  final String kind;
  final bool canUpload;
  final Map<String, dynamic>? doc;
  final PickedDoc? picked;
  final VoidCallback onPick;

  @override
  Widget build(BuildContext context) {
    final label = kind == 'id' ? 'الهوية / الإقامة' : 'الشهادة';
    final status = jS(doc?['status'], 'pending');
    final rejected = status == 'rejected';
    final ok = status == 'approved';
    final c = ok ? Brand.success : rejected ? Brand.danger : Brand.warning;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: c.withValues(alpha: 0.12),
              child: Icon(ok ? Icons.check_outlined : rejected ? Icons.close_outlined : Icons.hourglass_top_outlined, color: c, size: 22),
            ),
            const SizedBox(width: 10),
            Expanded(child: Text(label, style: const TextStyle(fontWeight: FontWeight.w800))),
            Text(ok ? 'مقبول' : rejected ? 'غير مقبول' : 'قيد المراجعة', style: TextStyle(color: c, fontWeight: FontWeight.w700, fontSize: 12.5)),
          ]),
          if (rejected || canUpload) ...[
            if (jStr(doc?['note'])?.isNotEmpty == true)
              Padding(padding: const EdgeInsets.only(top: 8), child: Text('السبب: ${doc!['note']}', style: const TextStyle(color: Brand.danger, height: 1.5))),
            const SizedBox(height: 10),
            DocSlot(label: 'ارفع $label مرة أخرى', doc: picked, onPick: onPick),
          ],
        ]),
      ),
    );
  }
}
