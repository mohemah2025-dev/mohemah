/// Which of the two mobile apps is running. Each app keeps its own session,
/// exactly like the web apps (`mohemah.session.customer` / `.provider`).
enum AppKind { customer, provider }

extension AppKindX on AppKind {
  String get key => this == AppKind.customer ? 'customer' : 'provider';
}

/// The deployed Cloudflare Worker, passed at build time:
/// `flutter build apk --dart-define=API_BASE=https://app.<account>.workers.dev`
const String kApiBase = String.fromEnvironment('API_BASE', defaultValue: 'https://app.mohemah.workers.dev');

String get apiBase => kApiBase.endsWith('/') ? kApiBase.substring(0, kApiBase.length - 1) : kApiBase;

/// Files saved by the Worker may come back as "/api/files/..." paths: make them absolute for images.
String absUrl(String u) => u.startsWith('/') ? '$apiBase$u' : u;
