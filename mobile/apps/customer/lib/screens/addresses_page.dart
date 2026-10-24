import 'package:flutter/material.dart';
import 'package:mohemah_core/mohemah_core.dart';

/// Saved addresses (the default one is used for new orders).
class AddressesPage extends StatefulWidget {
  const AddressesPage({super.key});
  @override
  State<AddressesPage> createState() => _AddressesPageState();
}

class _AddressesPageState extends State<AddressesPage> {
  List<Address>? _items;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = jList(await SessionScope.read(context).api.get('/api/me/addresses')).map(Address.new).toList();
      if (mounted) {
        setState(() {
          _items = list;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = errMsg(e));
    }
  }

  Future<void> _act(Future<dynamic> Function(Api api) call) async {
    final s = SessionScope.read(context);
    try {
      await call(s.api);
      await _load();
      await s.refresh();
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  Future<void> _add() async {
    final added = await showModalBottomSheet<bool>(context: context, isScrollControlled: true, builder: (_) => const _AddAddressSheet());
    if (added == true) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final items = _items;
    return Scaffold(
      appBar: AppBar(title: const Text('عناويني')),
      floatingActionButton: FloatingActionButton.extended(onPressed: _add, icon: const Icon(Icons.add_location_alt_rounded), label: const Text('إضافة عنوان')),
      body: _error != null && items == null
          ? ErrorRetry(message: _error!, onRetry: _load)
          : items == null
              ? const Loading()
              : items.isEmpty
                  ? const EmptyState(icon: Icons.place_outlined, title: 'لم تضف أي عنوان بعد', message: 'احفظ عناوينك لاستخدامها عند طلب الخدمات الحضورية.')
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 100),
                      itemCount: items.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (_, i) {
                        final a = items[i];
                        return AppCard(
                          padding: const EdgeInsets.fromLTRB(14, 12, 4, 12),
                          child: Row(children: [
                            Icon(a.isDefault ? Icons.home_rounded : Icons.place_rounded, color: Brand.primary),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Row(children: [
                                  Text(a.label, style: const TextStyle(fontWeight: FontWeight.w800)),
                                  if (a.isDefault) ...[const SizedBox(width: 6), const Pill('افتراضي', color: Brand.accentFg, background: Brand.accent)],
                                ]),
                                Text([a.region, a.address].whereType<String>().join(' • '), style: const TextStyle(color: Brand.mutedFg, fontSize: 12.5)),
                              ]),
                            ),
                            PopupMenuButton<String>(
                              onSelected: (v) {
                                if (v == 'default') _act((api) => api.post('/api/me/addresses/${a.id}/default'));
                                if (v == 'delete') _act((api) => api.delete('/api/me/addresses/${a.id}'));
                              },
                              itemBuilder: (_) => [
                                if (!a.isDefault) const PopupMenuItem(value: 'default', child: Text('جعله افتراضياً')),
                                const PopupMenuItem(value: 'delete', child: Text('حذف', style: TextStyle(color: Brand.danger))),
                              ],
                            ),
                          ]),
                        );
                      },
                    ),
    );
  }
}

class _AddAddressSheet extends StatefulWidget {
  const _AddAddressSheet();
  @override
  State<_AddAddressSheet> createState() => _AddAddressSheetState();
}

class _AddAddressSheetState extends State<_AddAddressSheet> {
  final _form = GlobalKey<FormState>();
  final _label = TextEditingController(text: 'المنزل');
  final _address = TextEditingController();
  String? _region;
  bool _default = false;

  @override
  void initState() {
    super.initState();
    _region = SessionScope.read(context).profile?.region;
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    try {
      await SessionScope.read(context).api.post('/api/me/addresses', {
        'label': _label.text.trim(),
        'address': _address.text.trim(),
        'region': _region,
        'is_default': _default,
      });
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.viewInsetsOf(context).bottom + 20),
      child: SafeArea(
        top: false,
        child: Form(
          key: _form,
          child: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              const Text('عنوان جديد', textAlign: TextAlign.center, style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
              const SizedBox(height: 14),
              Field(controller: _label, label: 'اسم العنوان', hint: 'المنزل، العمل…', icon: Icons.bookmark_rounded, maxLength: 60, validator: (v) => requiredField(v, 'اسم العنوان')),
              RegionField(value: _region, onChanged: (v) => setState(() => _region = v)),
              Field(controller: _address, label: 'تفاصيل العنوان', hint: 'الحي، الشارع، رقم المبنى', icon: Icons.place_rounded, maxLines: 3, maxLength: 300, validator: (v) => requiredField(v, 'تفاصيل العنوان')),
              SwitchListTile(contentPadding: EdgeInsets.zero, value: _default, onChanged: (v) => setState(() => _default = v), title: const Text('جعله العنوان الافتراضي')),
              const SizedBox(height: 8),
              BusyButton(label: 'حفظ العنوان', icon: Icons.check_rounded, onPressed: _save),
            ]),
          ),
        ),
      ),
    );
  }
}
