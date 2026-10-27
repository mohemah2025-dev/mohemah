import 'package:flutter/material.dart' hide Text;

import 'i18n.dart';

/// Mohemah brand palette (matches the web tokens in src/styles.css).
class Brand {
  static const primary = Color(0xFF3D70D1);
  static const primaryDeep = Color(0xFF2B54AE);
  static const navy = Color(0xFF1B2F6B);
  static const sky = Color(0xFF359BD9);
  static const mint = Color(0xFFA5E9CA);
  static const accent = Color(0xFFDAF6E9);
  static const accentFg = Color(0xFF056641);
  static const coral = Color(0xFFF2685A);
  static const background = Color(0xFFF5F7FB);
  static const card = Colors.white;
  static const foreground = Color(0xFF1F2A44);
  static const muted = Color(0xFFEEF2F8);
  static const mutedFg = Color(0xFF6B7489);
  static const border = Color(0xFFE3E8F0);
  static const success = Color(0xFF2E9E6E);
  static const warning = Color(0xFFD9931C);
  static const danger = Color(0xFFB8443A);

  static const gradient = LinearGradient(
    begin: Alignment.topRight,
    end: Alignment.bottomLeft,
    colors: [Color(0xFF3A6CCE), Color(0xFF359BD9), Color(0xFF8FDCC0)],
    stops: [0, 0.62, 1.15],
  );

  static const providerGradient = LinearGradient(
    begin: Alignment.topRight,
    end: Alignment.bottomLeft,
    colors: [Color(0xFF1B2F6B), Color(0xFF2B54AE), Color(0xFF138A8F)],
  );
}

const kFont = 'packages/mohemah_core/Cairo';

ThemeData mohemahTheme({Color seed = Brand.primary}) {
  final scheme = ColorScheme.fromSeed(seedColor: seed, primary: seed, surface: Brand.card, error: Brand.danger);
  final base = ThemeData(useMaterial3: true, colorScheme: scheme, fontFamily: kFont, scaffoldBackgroundColor: Brand.background);
  final r14 = BorderRadius.circular(14);
  return base.copyWith(
    textTheme: base.textTheme.apply(bodyColor: Brand.foreground, displayColor: Brand.foreground, fontFamily: kFont),
    appBarTheme: const AppBarTheme(
      backgroundColor: Brand.background,
      foregroundColor: Brand.foreground,
      elevation: 0,
      scrolledUnderElevation: 0.5,
      centerTitle: true,
      titleTextStyle: TextStyle(fontFamily: kFont, fontSize: 17, fontWeight: FontWeight.w700, color: Brand.foreground),
    ),
    cardTheme: CardThemeData(
      color: Brand.card,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20), side: const BorderSide(color: Brand.border)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: OutlineInputBorder(borderRadius: r14, borderSide: const BorderSide(color: Brand.border)),
      enabledBorder: OutlineInputBorder(borderRadius: r14, borderSide: const BorderSide(color: Brand.border)),
      focusedBorder: OutlineInputBorder(borderRadius: r14, borderSide: BorderSide(color: seed, width: 1.6)),
      errorBorder: OutlineInputBorder(borderRadius: r14, borderSide: const BorderSide(color: Brand.danger)),
      labelStyle: const TextStyle(color: Brand.mutedFg),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(50),
        shape: RoundedRectangleBorder(borderRadius: r14),
        textStyle: const TextStyle(fontFamily: kFont, fontSize: 15, fontWeight: FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(48),
        shape: RoundedRectangleBorder(borderRadius: r14),
        side: const BorderSide(color: Brand.border),
        textStyle: const TextStyle(fontFamily: kFont, fontSize: 14, fontWeight: FontWeight.w700),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(textStyle: const TextStyle(fontFamily: kFont, fontWeight: FontWeight.w700)),
    ),
    chipTheme: base.chipTheme.copyWith(
      labelStyle: const TextStyle(fontFamily: kFont, fontSize: 12, fontWeight: FontWeight.w600),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
      side: const BorderSide(color: Brand.border),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: seed.withValues(alpha: 0.12),
      height: 66,
      labelTextStyle: WidgetStateProperty.resolveWith((s) => TextStyle(
            fontFamily: kFont,
            fontSize: 11.5,
            fontWeight: s.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
            color: s.contains(WidgetState.selected) ? seed : Brand.mutedFg,
          )),
      iconTheme: WidgetStateProperty.resolveWith((s) => IconThemeData(color: s.contains(WidgetState.selected) ? seed : Brand.mutedFg)),
    ),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating, contentTextStyle: TextStyle(fontFamily: kFont)),
    dividerTheme: const DividerThemeData(color: Brand.border, thickness: 1, space: 1),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: Colors.white,
      showDragHandle: true,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
    ),
    dialogTheme: DialogThemeData(backgroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22))),
  );
}
