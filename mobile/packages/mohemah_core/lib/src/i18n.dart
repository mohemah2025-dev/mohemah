import 'package:flutter/material.dart' as m;
import 'package:flutter/material.dart' hide Text;
import 'package:shared_preferences/shared_preferences.dart';

import 'lang_state.dart';
import 'translations.dart';

export 'lang_state.dart';

/// App languages: Arabic (default, RTL), English (LTR) and Urdu (RTL).
const kLanguages = [('ar', 'العربية'), ('en', 'English'), ('ur', 'اردو')];

/// Holds and persists the chosen language; the app root rebuilds when it changes.
class AppLang extends ChangeNotifier {
  AppLang._();
  static final AppLang instance = AppLang._();
  static const _key = 'app_lang';

  String get code => LangState.code;
  Locale get locale => Locale(code);

  /// Saved choice, otherwise the phone language when it is English or Urdu.
  Future<void> restore() async {
    try {
      final p = await SharedPreferences.getInstance();
      final saved = p.getString(_key);
      final device = WidgetsBinding.instance.platformDispatcher.locale.languageCode;
      final c = saved ?? (device == 'en' || device == 'ur' ? device : 'ar');
      if (c != LangState.code) {
        LangState.code = c;
        _cache.clear();
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<void> set(String c) async {
    if (!kLanguages.any((l) => l.$1 == c) || c == LangState.code) return;
    LangState.code = c;
    _cache.clear();
    notifyListeners();
    try {
      final p = await SharedPreferences.getInstance();
      await p.setString(_key, c);
    } catch (_) {}
  }
}

final Map<String, String> _cache = {};
List<(RegExp, String)>? _templates;
final _arabic = RegExp(r'[؀-ۿ]');

List<(RegExp, String)> _compile() {
  final out = <(RegExp, String)>[];
  for (final k in kTranslations.keys) {
    if (!k.contains('{0}')) continue;
    final parts = k.split(RegExp(r'\{\d\}'));
    final names = RegExp(r'\{(\d)\}').allMatches(k).map((x) => x.group(1)!).toList();
    final b = StringBuffer('^');
    for (var i = 0; i < parts.length; i++) {
      b.write(RegExp.escape(parts[i]));
      if (i >= names.length) continue;
      final nextIsPlaceholder = i + 1 < parts.length && parts[i + 1].isEmpty && i + 1 < names.length;
      final afterPlaceholder = i > 0 && parts[i].isEmpty;
      // Two placeholders side by side: the first is a number, the second an optional suffix.
      b.write(nextIsPlaceholder ? r'([0-9][0-9.,/:%]*)' : afterPlaceholder ? '(.*?)' : '(.+?)');
    }
    b.write(r'$');
    out.add((RegExp(b.toString(), dotAll: true), k));
  }
  // Longer (more specific) templates first.
  out.sort((a, b) => b.$2.length.compareTo(a.$2.length));
  return out;
}

String? _lookup(String s, int li) {
  final hit = kTranslations[s];
  if (hit != null) return hit[li];
  _templates ??= _compile();
  for (final (re, key) in _templates!) {
    final mm = re.firstMatch(s);
    if (mm == null) continue;
    final names = RegExp(r'\{(\d)\}').allMatches(key).map((x) => int.parse(x.group(1)!)).toList();
    var target = kTranslations[key]![li];
    for (var i = 0; i < names.length; i++) {
      final g = mm.group(i + 1) ?? '';
      target = target.replaceAll('{${names[i]}}', g.isEmpty ? '' : tr(g));
    }
    return target;
  }
  return null;
}

/// Translates an Arabic UI string into the current language (dictionary + templates); other text is returned as is.
String tr(String s) {
  final code = LangState.code;
  if (code == 'ar' || s.isEmpty || !_arabic.hasMatch(s)) return s;
  final c = _cache[s];
  if (c != null) return c;
  final li = code == 'en' ? 0 : 1;
  var out = _lookup(s, li) ?? _lookup(s.trim(), li);
  // «name • nationality», «service • city»…: translate each part.
  if (out == null && s.contains(' • ')) {
    final parts = s.split(' • ');
    final t = parts.map((p) => _lookup(p, li) ?? _lookup(p.trim(), li) ?? p).toList();
    if (t.join() != parts.join()) out = t.join(' • ');
  }
  // Leading punctuation (": reason", " — note"): translate the rest.
  if (out == null) {
    final pm = RegExp(r'^([:،,\s—\-]+)(\S.*)$', dotAll: true).firstMatch(s);
    if (pm != null) {
      final rest = _lookup(pm.group(2)!, li);
      if (rest != null) out = '${pm.group(1)}$rest';
    }
  }
  if (out == null && s.contains('\n')) {
    final lines = s.split('\n');
    final t = lines.map((l) => l.trim().isEmpty ? l : (_lookup(l, li) ?? _lookup(l.trim(), li) ?? l)).toList();
    out = t.join('\n');
  }
  out ??= s;
  if (_cache.length > 3000) _cache.clear();
  _cache[s] = out;
  return out;
}

/// Drop-in replacement for Flutter's [m.Text] that translates its string (and the spans of [Text.rich]).
/// Use `translate: false` for user content (names, chat messages).
class Text extends StatelessWidget {
  const Text(
    String this.data, {
    super.key,
    this.style,
    this.strutStyle,
    this.textAlign,
    this.textDirection,
    this.locale,
    this.softWrap,
    this.overflow,
    this.textScaler,
    this.maxLines,
    this.semanticsLabel,
    this.textWidthBasis,
    this.textHeightBehavior,
    this.selectionColor,
    this.translate = true,
  }) : textSpan = null;

  const Text.rich(
    InlineSpan this.textSpan, {
    super.key,
    this.style,
    this.strutStyle,
    this.textAlign,
    this.textDirection,
    this.locale,
    this.softWrap,
    this.overflow,
    this.textScaler,
    this.maxLines,
    this.semanticsLabel,
    this.textWidthBasis,
    this.textHeightBehavior,
    this.selectionColor,
    this.translate = true,
  }) : data = null;

  final String? data;
  final InlineSpan? textSpan;
  final TextStyle? style;
  final StrutStyle? strutStyle;
  final TextAlign? textAlign;
  final TextDirection? textDirection;
  final Locale? locale;
  final bool? softWrap;
  final TextOverflow? overflow;
  final TextScaler? textScaler;
  final int? maxLines;
  final String? semanticsLabel;
  final TextWidthBasis? textWidthBasis;
  final TextHeightBehavior? textHeightBehavior;
  final Color? selectionColor;
  final bool translate;

  static InlineSpan _span(InlineSpan s) {
    if (s is TextSpan) {
      return TextSpan(
        text: s.text == null ? null : tr(s.text!),
        style: s.style,
        children: s.children?.map(_span).toList(),
        recognizer: s.recognizer,
        semanticsLabel: s.semanticsLabel,
      );
    }
    return s;
  }

  @override
  Widget build(BuildContext context) {
    // Depend on the app locale so even const texts rebuild when the language changes.
    Localizations.maybeLocaleOf(context);
    // An explicit RTL direction written for Arabic is dropped in English so the text flows naturally.
    final dir = LangState.code == 'en' && textDirection == TextDirection.rtl ? null : textDirection;
    if (textSpan != null) {
      return m.Text.rich(translate ? _span(textSpan!) : textSpan!,
          style: style, strutStyle: strutStyle, textAlign: textAlign, textDirection: dir, locale: locale, softWrap: softWrap, overflow: overflow,
          textScaler: textScaler, maxLines: maxLines, semanticsLabel: semanticsLabel, textWidthBasis: textWidthBasis, textHeightBehavior: textHeightBehavior,
          selectionColor: selectionColor);
    }
    return m.Text(translate ? tr(data!) : data!,
        style: style, strutStyle: strutStyle, textAlign: textAlign, textDirection: dir, locale: locale, softWrap: softWrap, overflow: overflow,
        textScaler: textScaler, maxLines: maxLines, semanticsLabel: semanticsLabel, textWidthBasis: textWidthBasis, textHeightBehavior: textHeightBehavior,
        selectionColor: selectionColor);
  }
}

/// «اللغة» picker (bottom sheet): Arabic / English / Urdu.
Future<void> pickLanguage(BuildContext context) async {
  final c = await showModalBottomSheet<String>(
    context: context,
    showDragHandle: true,
    builder: (ctx) => SafeArea(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Text('اللغة', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        for (final l in kLanguages)
          ListTile(
            leading: Icon(LangState.code == l.$1 ? Icons.radio_button_checked : Icons.radio_button_off, color: Theme.of(ctx).colorScheme.primary),
            title: Text(l.$2, translate: false, style: const TextStyle(fontWeight: FontWeight.w700)),
            onTap: () => Navigator.pop(ctx, l.$1),
          ),
        const SizedBox(height: 8),
      ]),
    ),
  );
  if (c != null) await AppLang.instance.set(c);
}

/// Name of the current language (for menu subtitles).
String get currentLanguageName => kLanguages.firstWhere((l) => l.$1 == LangState.code, orElse: () => kLanguages.first).$2;
