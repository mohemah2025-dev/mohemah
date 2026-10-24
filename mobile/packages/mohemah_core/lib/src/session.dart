import 'dart:convert';

import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';
import 'config.dart';
import 'models.dart';

/// Signed-in state of one app. The token is scoped by the Worker to this app
/// (a customer session cannot call provider endpoints and vice versa).
class Session extends ChangeNotifier {
  Session(this.app) : api = Api() {
    api.onUnauthorized = _expire;
  }

  final AppKind app;
  final Api api;
  Profile? profile;
  List<String> roles = const [];
  DateTime? subscriptionEnd;
  bool ready = false;

  String get _key => 'mohemah.session.${app.key}';
  bool get signedIn => api.token != null && profile != null;
  bool get isProvider => roles.contains('provider');
  bool get isCustomer => roles.contains('customer');
  bool get hasActiveSubscription => subscriptionEnd != null && subscriptionEnd!.isAfter(DateTime.now());

  /// Restores the saved session and validates it with the server.
  Future<void> restore() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getString(_key);
      if (saved != null && saved.isNotEmpty) {
        api.token = saved;
        final cached = prefs.getString('$_key.me');
        if (cached != null) _apply(jMap(jsonDecode(cached)), persist: false);
        await refresh();
      }
    } catch (_) {
      // Offline start: keep the cached profile; the next refresh will validate it.
    }
    ready = true;
    notifyListeners();
  }

  Future<void> refresh() async {
    if (api.token == null) return;
    final me = jMap(await api.get('/api/auth/me'));
    if (me['profile'] == null) {
      await _clear();
    } else {
      _apply(me);
    }
  }

  Future<void> signIn(String identifier, String password) async {
    final res = jMap(await api.post('/api/auth/login', {'identifier': identifier.trim(), 'password': password, 'app': app.key}));
    await acceptAuth(res);
  }

  /// Stores a `{ token, profile, roles, subscription_end }` payload returned by login/registration.
  Future<void> acceptAuth(Map<String, dynamic> res) async {
    api.token = jStr(res['token']);
    final prefs = await SharedPreferences.getInstance();
    if (api.token != null) await prefs.setString(_key, api.token!);
    _apply(res);
  }

  /// Applies a `me` payload (also returned by profile updates).
  void applyMe(dynamic me) => _apply(jMap(me));

  void _apply(Map<String, dynamic> me, {bool persist = true}) {
    profile = me['profile'] == null ? null : Profile(jMap(me['profile']));
    roles = jStrings(me['roles']);
    subscriptionEnd = jDate(me['subscription_end']);
    if (persist) {
      SharedPreferences.getInstance().then((p) => p.setString('$_key.me', jsonEncode({
            'profile': profile?.raw,
            'roles': roles,
            'subscription_end': me['subscription_end'],
          })));
    }
    notifyListeners();
  }

  Future<void> signOut() async {
    try {
      await api.post('/api/auth/logout');
    } catch (_) {}
    await _clear();
  }

  void _expire() => _clear();

  Future<void> _clear() async {
    api.token = null;
    profile = null;
    roles = const [];
    subscriptionEnd = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
    await prefs.remove('$_key.me');
    notifyListeners();
  }
}

/// Makes the [Session] available to the widget tree and rebuilds dependents on change.
class SessionScope extends InheritedNotifier<Session> {
  const SessionScope({super.key, required Session session, required super.child}) : super(notifier: session);

  static Session of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<SessionScope>()!.notifier!;
  static Session read(BuildContext context) => context.getInheritedWidgetOfExactType<SessionScope>()!.notifier!;
}
