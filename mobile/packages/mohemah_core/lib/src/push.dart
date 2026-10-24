import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import 'models.dart';
import 'session.dart';

// Firebase settings are passed at build time (CI reads them from mobile/firebase/*):
//   --dart-define=FB_API_KEY=... --dart-define=FB_APP_ID=... --dart-define=FB_SENDER_ID=... --dart-define=FB_PROJECT_ID=...
// Without them push is disabled and the apps keep working with in-app polling.
const _apiKey = String.fromEnvironment('FB_API_KEY');
const _appId = String.fromEnvironment('FB_APP_ID');
const _senderId = String.fromEnvironment('FB_SENDER_ID');
const _projectId = String.fromEnvironment('FB_PROJECT_ID');
const _iosBundleId = String.fromEnvironment('FB_IOS_BUNDLE_ID');

/// Push notifications (Firebase Cloud Messaging) for the signed-in user of this app.
class Push {
  Push._();

  static bool get configured => _apiKey.isNotEmpty && _appId.isNotEmpty && _senderId.isNotEmpty && _projectId.isNotEmpty;

  static bool _ready = false;
  static Session? _session;
  static String? _token;
  static String? _registeredFor;

  /// Called when the user taps a notification (data contains `link`, maybe `order_id`).
  static void Function(Map<String, dynamic> data)? onOpen;

  /// Called when a notification arrives while the app is open.
  static void Function(String title, String body, Map<String, dynamic> data)? onForeground;

  static Future<void> init(Session session) async {
    if (!configured || _ready) return;
    try {
      await Firebase.initializeApp(
        options: FirebaseOptions(
          apiKey: _apiKey,
          appId: _appId,
          messagingSenderId: _senderId,
          projectId: _projectId,
          iosBundleId: _iosBundleId.isEmpty ? null : _iosBundleId,
        ),
      );
      _ready = true;
      _session = session;
      final fm = FirebaseMessaging.instance;
      await fm.setForegroundNotificationPresentationOptions(alert: true, badge: true, sound: true);
      FirebaseMessaging.onMessage.listen((m) {
        onForeground?.call(m.notification?.title ?? '', m.notification?.body ?? '', Map<String, dynamic>.from(m.data));
      });
      FirebaseMessaging.onMessageOpenedApp.listen((m) => onOpen?.call(Map<String, dynamic>.from(m.data)));
      fm.onTokenRefresh.listen((t) {
        _token = t;
        _registeredFor = null;
        unawaited(_sync());
      });
      Session.beforeSignOut = _unregister;
      session.addListener(_sync);
      unawaited(_sync());
      final initial = await fm.getInitialMessage();
      if (initial != null) {
        // Wait for the opening animation before navigating.
        Future<void>.delayed(const Duration(milliseconds: 3500), () => onOpen?.call(Map<String, dynamic>.from(initial.data)));
      }
    } catch (e) {
      debugPrint('Push init failed: $e');
    }
  }

  /// Registers this device for the signed-in user (asks for permission the first time).
  static Future<void> _sync() async {
    final s = _session;
    if (!_ready || s == null || !s.signedIn) return;
    final userId = s.profile!.id;
    if (_registeredFor == userId) return;
    _registeredFor = userId;
    try {
      final fm = FirebaseMessaging.instance;
      final perm = await fm.requestPermission(alert: true, badge: true, sound: true);
      if (perm.authorizationStatus == AuthorizationStatus.denied) return;
      if (defaultTargetPlatform == TargetPlatform.iOS) {
        // The APNs token arrives a moment after permission is granted.
        for (var i = 0; i < 10 && await fm.getAPNSToken() == null; i++) {
          await Future<void>.delayed(const Duration(milliseconds: 500));
        }
      }
      _token ??= await fm.getToken();
      if (_token == null) return;
      await s.api.post('/api/me/push-token', {
        'token': _token,
        'platform': defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android',
      });
    } catch (e) {
      _registeredFor = null;
      debugPrint('Push registration failed: $e');
    }
  }

  static Future<void> _unregister(dynamic api) async {
    final t = _token;
    _registeredFor = null;
    if (t == null) return;
    try {
      await (_session?.api ?? api).post('/api/me/push-token/delete', {'token': t});
    } catch (_) {}
  }

  /// Order id carried by a notification, if any.
  static String? orderIdOf(Map<String, dynamic> data) => jStr(data['order_id']);
}
