import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:mohemah_core/mohemah_core.dart';

/// How long a new order stays in the "incoming" pop-up before it is dismissed.
const incomingTtl = Duration(seconds: 60);

/// Live state of an approved provider: feed (available + active jobs), stats and actions.
class ProviderStore extends ChangeNotifier {
  ProviderStore(this.session) {
    instance = this;
    session.addListener(_sessionChanged);
    _sessionChanged();
  }

  /// The live store (used by push notification handlers).
  static ProviderStore? instance;

  final Session session;
  ProviderFeed? feed;
  ProviderStats? stats;
  List<HistoryOrder>? history;
  String? error;
  Timer? _timer;
  String? _userKey;
  bool _primed = false;
  final Set<String> _seen = {};

  /// New orders waiting for a decision (shown one at a time as a pop-up).
  final List<OfferedOrder> incoming = [];
  final Map<String, DateTime> incomingAt = {};

  /// Incoming orders the provider minimised: shown as a blinking bar on the home page instead of the pop-up.
  final Set<String> minimized = {};
  void Function(OfferedOrder order)? onIncoming;

  void minimize(String id) {
    minimized.add(id);
    notifyListeners();
  }

  /// Opens a minimised order's card again.
  void restore(String id) {
    minimized.remove(id);
    notifyListeners();
  }

  Api get api => session.api;

  void _sessionChanged() {
    final key = session.signedIn && session.isProvider ? session.profile!.id : null;
    if (key == _userKey) return;
    _userKey = key;
    _timer?.cancel();
    feed = null;
    stats = null;
    history = null;
    _seen.clear();
    incoming.clear();
    minimized.clear();
    _primed = false;
    if (key != null) {
      refresh();
      loadStats();
      _timer = Timer.periodic(const Duration(seconds: 8), (_) => refresh(background: true));
    }
    notifyListeners();
  }

  Future<void> refresh({bool background = false}) async {
    if (!session.isProvider) return;
    try {
      final f = ProviderFeed(jMap(await api.get('/api/provider/feed')));
      final available = f.available;
      final ids = available.map((o) => o.id).toSet();
      final now = DateTime.now();
      if (_primed && f.online) {
        for (final o in available) {
          if (_seen.contains(o.id)) continue;
          incoming.add(o);
          incomingAt[o.id] = now;
          onIncoming?.call(o);
        }
      }
      _seen.addAll(ids);
      _primed = true;
      incoming.removeWhere((o) => !ids.contains(o.id) || now.difference(incomingAt[o.id] ?? now) > incomingTtl);
      minimized.removeWhere((id) => !incoming.any((o) => o.id == id));
      feed = f;
      error = null;
    } catch (e) {
      if (!background) error = errMsg(e);
    }
    notifyListeners();
  }

  Future<void> loadStats() async {
    try {
      stats = ProviderStats(jMap(await api.get('/api/provider/stats')));
      notifyListeners();
    } catch (_) {}
  }

  Future<void> loadHistory() async {
    try {
      history = jList(await api.get('/api/provider/history')).map(HistoryOrder.new).toList();
      notifyListeners();
    } catch (e) {
      history ??= const [];
      rethrow;
    }
  }

  Future<void> setOnline(bool online) async {
    await api.post('/api/provider/online', {'online': online});
    if (online) {
      // Orders already waiting are not "new": only orders arriving from now on pop up.
      _seen.addAll(feed?.available.map((o) => o.id) ?? const <String>[]);
    }
    await refresh();
  }

  void dismissIncoming(String id) {
    incoming.removeWhere((o) => o.id == id);
    minimized.remove(id);
    notifyListeners();
  }

  /// Accepts an order. Throws [ApiException] with code `insufficient_balance` or
  /// `subscription_required` (status 402) when billing blocks the acceptance.
  Future<void> accept(String id, {double? price}) async {
    try {
      final res = jMap(await api.post('/api/orders/$id/accept', {'price': price}));
      if (res['success'] == false) throw ApiException(402, jS(res['error'], 'payment_required'), 'رصيد الكوينز غير كافٍ', res);
    } finally {
      dismissIncoming(id);
    }
    await refresh();
    unawaited(loadStats());
    await session.refresh().catchError((_) {});
  }

  /// Sets / changes the service price of an accepted order (null = to be negotiated with the customer).
  Future<void> setPrice(String id, double? price) async {
    await api.post('/api/orders/$id/price', {'price': price});
    await refresh();
  }

  Future<void> reject(String id) async {
    dismissIncoming(id);
    await api.post('/api/orders/$id/reject');
    await refresh();
  }

  Future<String> advance(String id) async {
    final res = jMap(await api.post('/api/orders/$id/advance'));
    await refresh();
    if (res['status'] == 'completed') {
      unawaited(loadStats());
      history = null;
    }
    return jS(res['status']);
  }

  Future<void> release(String id, String? reason) async {
    await api.post('/api/orders/$id/release', {'reason': reason?.trim() ?? ''});
    await refresh();
  }

  Future<void> rateCustomer(String id, int rating) async {
    await api.post('/api/orders/$id/rate-customer', {'rating': rating});
    await loadHistory();
  }

  @override
  void dispose() {
    _timer?.cancel();
    session.removeListener(_sessionChanged);
    super.dispose();
  }
}

class ProviderScope extends InheritedNotifier<ProviderStore> {
  const ProviderScope({super.key, required ProviderStore store, required super.child}) : super(notifier: store);
  static ProviderStore of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<ProviderScope>()!.notifier!;
  static ProviderStore read(BuildContext context) => context.getInheritedWidgetOfExactType<ProviderScope>()!.notifier!;
}

/// Creates the [ProviderStore] above the navigator so every page can read it.
class ProviderStoreHost extends StatefulWidget {
  const ProviderStoreHost({super.key, required this.child});
  final Widget child;
  @override
  State<ProviderStoreHost> createState() => _ProviderStoreHostState();
}

class _ProviderStoreHostState extends State<ProviderStoreHost> {
  late final ProviderStore _store = ProviderStore(SessionScope.read(context));

  @override
  void dispose() {
    _store.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ProviderScope(store: _store, child: widget.child);
}

/// Loyalty program tiers (same as the web provider app).
class LoyaltyTier {
  const LoyaltyTier(this.name, this.min, this.minRating, this.reward, this.requirement, this.perks);
  final String name;
  final int min;
  final double minRating;
  final String reward;
  final String requirement;
  final List<String> perks;
}

const loyaltyTiers = [
  LoyaltyTier('موثق', 0, 0, '10 نقاط', 'إكمال التسجيل والتحقق', ['تمكين بدء العمل', 'إحصائيات أداء أساسية']),
  LoyaltyTier('مُعتمد', 50, 4.5, '30 نقطة', 'إنجاز 50 طلب + تقييم 4.5/5', ['شارة برونزية', 'إبراز إنجازاتك لدى طالب الخدمة']),
  LoyaltyTier('مُميز', 150, 4.5, '100 نقطة', 'إنجاز 150 طلب + تقييم 4.5/5', ['شارة فضية', 'إحصائيات متقدمة', 'ميزات مُعتمد كاملة']),
  LoyaltyTier('خبير', 300, 4.7, '200 نقطة', 'إنجاز 300 طلب + تقييم 4.7/5', ['شارة ذهبية', 'شهادة مميزة', 'دعوات لورش ودورات', 'أولوية في الظهور']),
];

int currentTierIndex(int completed, double rating) {
  var idx = 0;
  for (var i = 0; i < loyaltyTiers.length; i++) {
    if (completed >= loyaltyTiers[i].min && rating >= loyaltyTiers[i].minRating) idx = i;
  }
  return idx;
}
