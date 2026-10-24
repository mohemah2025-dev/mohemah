import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:mohemah_core/mohemah_core.dart';

/// The customer's orders, refreshed in the background while the app is open.
/// Reports status changes (accepted, arrived, completed...) through [onStatusChange].
class OrdersStore extends ChangeNotifier {
  OrdersStore(this.session) {
    session.addListener(_sessionChanged);
    _sessionChanged();
  }

  final Session session;
  List<CustomerOrder>? orders;
  List<String> favorites = const [];
  int unreadNotifications = 0;
  String? error;
  Timer? _timer;
  int _tick = 0;
  String? _userId;
  final Map<String, String> _lastStatus = {};
  void Function(CustomerOrder order)? onStatusChange;

  List<CustomerOrder> get open => (orders ?? const []).where((o) => o.isOpen).toList();
  List<CustomerOrder> get past => (orders ?? const []).where((o) => !o.isOpen).toList();

  void _sessionChanged() {
    final id = session.signedIn ? session.profile!.id : null;
    if (id == _userId) return;
    _userId = id;
    _timer?.cancel();
    _lastStatus.clear();
    orders = null;
    favorites = const [];
    unreadNotifications = 0;
    if (id != null) {
      refresh();
      _timer = Timer.periodic(const Duration(seconds: 12), (_) => refresh(background: true));
    }
    notifyListeners();
  }

  Future<void> refresh({bool background = false}) async {
    if (!session.signedIn) return;
    try {
      final list = jList(await session.api.get('/api/orders/mine')).map(CustomerOrder.new).toList();
      final first = _lastStatus.isEmpty;
      for (final o in list) {
        final prev = _lastStatus[o.id];
        if (!first && prev != null && prev != o.status) onStatusChange?.call(o);
        _lastStatus[o.id] = o.status;
      }
      orders = list;
      error = null;
      if (!background || _tick % 3 == 0) await _refreshExtras();
      _tick++;
    } catch (e) {
      if (!background) error = errMsg(e);
    }
    notifyListeners();
  }

  Future<void> _refreshExtras() async {
    try {
      final n = jList(await session.api.get('/api/me/notifications'));
      unreadNotifications = n.where((x) => !jBool(x['read'])).length;
      favorites = jStrings(await session.api.get('/api/me/favorites'));
    } catch (_) {}
  }

  Future<void> toggleFavorite(String subId) async {
    final next = favorites.contains(subId) ? favorites.where((x) => x != subId).toList() : [...favorites, subId];
    final prev = favorites;
    favorites = next;
    notifyListeners();
    try {
      favorites = jStrings(await session.api.put('/api/me/favorites', {'ids': next}));
    } catch (_) {
      favorites = prev;
    }
    notifyListeners();
  }

  void markNotificationsSeen() {
    unreadNotifications = 0;
    notifyListeners();
  }

  @override
  void dispose() {
    _timer?.cancel();
    session.removeListener(_sessionChanged);
    super.dispose();
  }
}

class OrdersScope extends InheritedNotifier<OrdersStore> {
  const OrdersScope({super.key, required OrdersStore store, required super.child}) : super(notifier: store);
  static OrdersStore of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<OrdersScope>()!.notifier!;
  static OrdersStore read(BuildContext context) => context.getInheritedWidgetOfExactType<OrdersScope>()!.notifier!;
}

/// Creates the [OrdersStore] for the signed-in customer above the navigator,
/// so every pushed page can read it.
class CustomerScope extends StatefulWidget {
  const CustomerScope({super.key, required this.child});
  final Widget child;
  @override
  State<CustomerScope> createState() => _CustomerScopeState();
}

class _CustomerScopeState extends State<CustomerScope> {
  late final OrdersStore _store = OrdersStore(SessionScope.read(context));

  @override
  void dispose() {
    _store.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => OrdersScope(store: _store, child: widget.child);
}
