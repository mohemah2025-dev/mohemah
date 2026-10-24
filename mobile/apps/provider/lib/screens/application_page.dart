import 'dart:async';

import 'package:flutter/material.dart';
import 'package:mohemah_core/mohemah_core.dart';

import '../docs.dart';
import 'auth_page.dart';

/// Shown to a signed-in account that is not an approved provider yet.
class ApplicationPage extends StatefulWidget {
  const ApplicationPage({super.key});
  @override
  State<ApplicationPage> createState() => _ApplicationPageState();
}

class _ApplicationPageState extends State<ApplicationPage> {
  Timer? _timer;
  PickedDoc? _id;
  PickedDoc? _cert;

  @override
  void initState() {
    super.initState();
    // Picks up the administrator's decision without reopening the app.
    _timer = Timer.periodic(const Duration(seconds: 30), (_) => SessionScope.read(context).refresh().catchError((_) {}));
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _upload() async {
    if (_id == null && _cert == null) {
      showSnack(context, 'أرفق ملفاً واحداً على الأقل', error: true);
      return;
    }
    final s = SessionScope.read(context);
    try {
      s.applyMe(await s.api.multipart('/api/provider/documents', const {}, [
        if (_id != null) _id!.upload('id_file'),
        if (_cert != null) _cert!.upload('cert_file'),
      ]));
      setState(() => _id = _cert = null);
      if (mounted) showSnack(context, 'تم رفع المستندات وإعادة الطلب للمراجعة');
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    final p = s.profile!;
    final status = p.verificationStatus;
    final services = PublicScope.of(context).services.where((x) => p.requestedServices.contains(x.id)).toList();
    final open = status == 'pending' || status == 'rejected';

    return Scaffold(
      appBar: AppBar(
        title: const Text('طلب الانضمام'),
        actions: [IconButton(tooltip: 'تسجيل خروج', onPressed: () => signOutFlow(context), icon: const Icon(Icons.logout_rounded))],
      ),
      body: RefreshIndicator(
        onRefresh: () => s.refresh().catchError((_) {}),
        child: ListView(padding: const EdgeInsets.fromLTRB(18, 6, 18, 30), children: [
          Text('أهلاً ${p.firstName}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          if (!open) ...[
            const Text('أكمل بياناتك وأرفق مستنداتك لتقديم طلب الانضمام كمقدم خدمة.', style: TextStyle(color: Brand.mutedFg, height: 1.6)),
            const SizedBox(height: 16),
            const ProviderRegisterForm(applyExisting: true),
          ] else ...[
            _StatusCard(status: status, note: p.reviewNote),
            if (services.isNotEmpty) ...[
              const SectionTitle('الخدمات المطلوبة'),
              Wrap(spacing: 8, runSpacing: 8, children: [
                for (final x in services) Chip(avatar: Icon(serviceIcon(x.icon), size: 18), label: Text(x.name)),
              ]),
            ],
            SectionTitle(status == 'rejected' ? 'أعد رفع المستندات' : 'تحديث المستندات (اختياري)'),
            DocSlot(
              label: 'الهوية / الإقامة',
              doc: _id,
              onPick: () async {
                final d = await pickDocument(context, 'الهوية / الإقامة');
                if (d != null) setState(() => _id = d);
              },
            ),
            DocSlot(
              label: 'الشهادة',
              doc: _cert,
              onPick: () async {
                final d = await pickDocument(context, 'الشهادة');
                if (d != null) setState(() => _cert = d);
              },
            ),
            BusyButton(label: 'رفع المستندات', icon: Icons.cloud_upload_rounded, onPressed: (_id == null && _cert == null) ? null : _upload),
            const SizedBox(height: 16),
            const MenuGroup(children: [_SupportTile()]),
          ],
        ]),
      ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({required this.status, this.note});
  final String status;
  final String? note;

  @override
  Widget build(BuildContext context) {
    final rejected = status == 'rejected';
    final c = rejected ? Brand.danger : Brand.warning;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(color: c.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(22)),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(rejected ? Icons.error_rounded : Icons.hourglass_top_rounded, color: c, size: 34),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(rejected ? 'لم يُقبل طلبك' : 'طلبك قيد المراجعة', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: c)),
            const SizedBox(height: 4),
            Text(
              rejected
                  ? (note?.isNotEmpty == true ? 'ملاحظة الإدارة: $note' : 'راجع مستنداتك وأعد رفعها لإعادة الطلب للمراجعة.')
                  : 'يراجع فريق مهمة بياناتك ومستنداتك، وسيتفعّل استقبال الطلبات تلقائياً بعد الموافقة.',
              style: const TextStyle(height: 1.6),
            ),
          ]),
        ),
      ]),
    );
  }
}

class _SupportTile extends StatelessWidget {
  const _SupportTile();
  @override
  Widget build(BuildContext context) => MenuTile(
        icon: Icons.support_agent_rounded,
        title: 'مراسلة الإدارة',
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SupportMessagesPage())),
      );
}
