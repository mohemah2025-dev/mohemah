import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'config.dart';
import 'public_data.dart';
import 'session.dart';
import 'splash.dart';
import 'theme.dart';

final GlobalKey<NavigatorState> rootNavigator = GlobalKey<NavigatorState>();
final GlobalKey<ScaffoldMessengerState> rootMessenger = GlobalKey<ScaffoldMessengerState>();

/// Root of each mobile app: Arabic RTL MaterialApp, session + public data scopes,
/// the opening animation, then [home].
class MohemahApp extends StatefulWidget {
  const MohemahApp({
    super.key,
    required this.kind,
    required this.title,
    required this.subtitle,
    required this.home,
    this.seed = Brand.primary,
    this.palette = SplashPalette.customer,
    this.scope,
  });

  final AppKind kind;
  final String title;
  final String subtitle;
  final WidgetBuilder home;
  final Color seed;
  final SplashPalette palette;

  /// Wraps the app (below the session/data scopes, above the navigator) with app-specific state.
  final Widget Function(BuildContext context, Widget child)? scope;

  @override
  State<MohemahApp> createState() => _MohemahAppState();
}

class _MohemahAppState extends State<MohemahApp> with WidgetsBindingObserver {
  late final Session session = Session(widget.kind);
  late final PublicData data = PublicData(session.api);
  late final Future<void> _init;
  bool _opened = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
    _init = Future.wait([session.restore(), data.load()]).timeout(const Duration(seconds: 8), onTimeout: () => const []);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _opened) {
      unawaited(data.load());
      unawaited(session.refresh().catchError((_) {}));
    }
  }

  @override
  Widget build(BuildContext context) {
    return SessionScope(
      session: session,
      child: PublicScope(
        data: data,
        child: _scoped(MaterialApp(
          navigatorKey: rootNavigator,
          scaffoldMessengerKey: rootMessenger,
          title: widget.title,
          debugShowCheckedModeBanner: false,
          theme: mohemahTheme(seed: widget.seed),
          locale: const Locale('ar'),
          supportedLocales: const [Locale('ar')],
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          builder: (context, child) => AnnotatedRegion<SystemUiOverlayStyle>(
            value: SystemUiOverlayStyle.dark.copyWith(statusBarColor: Colors.transparent),
            child: MediaQuery(
              // Keep layouts stable with very large system font sizes.
              data: MediaQuery.of(context).copyWith(
                textScaler: MediaQuery.of(context).textScaler.clamp(minScaleFactor: 0.9, maxScaleFactor: 1.25),
              ),
              child: child!,
            ),
          ),
          home: AnimatedSwitcher(
            duration: const Duration(milliseconds: 450),
            child: _opened
                ? KeyedSubtree(key: const ValueKey('home'), child: Builder(builder: widget.home))
                : SlidesSplash(
                    key: const ValueKey('splash'),
                    title: widget.title,
                    subtitle: widget.subtitle,
                    palette: widget.palette,
                    waitFor: _init,
                    onFinished: () => setState(() => _opened = true),
                  ),
          ),
        )),
      ),
    );
  }

  Widget _scoped(Widget app) => widget.scope == null ? app : Builder(builder: (context) => widget.scope!(context, app));
}
