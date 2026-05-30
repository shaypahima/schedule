import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Velofit brand palette — "warm studio". Muted teal anchor + a warm
/// peach→amber→terracotta family (teal↔orange are complementary). Sourced from
/// the user's chosen swatch: #588B8B #FFFFFF #FFD5C2 #F28F3B #C8553D.
class BrandColors {
  static const teal = Color(0xFF588B8B); // primary — muted, grounded
  static const tealDark = Color(0xFF3F6766); // pressed / gradient end
  static const orange = Color(0xFFF28F3B); // accent — warm amber
  static const orangeDark = Color(0xFFC8553D); // accent pressed — terracotta
  static const peach = Color(0xFFFFD5C2); // soft fill — chips, hero tiles, highlights
  static const terracotta = Color(0xFFC8553D); // strong accent (alias of orangeDark)

  // Warm neutrals (peach-leaning warm grays)
  static const bg = Color(0xFFFAF5F1); // warm off-white page
  static const surface = Color(0xFFFFFFFF);
  static const ink = Color(0xFF2E2A27); // warm near-black
  static const inkSoft = Color(0xFF6F655E);
  static const inkMuted = Color(0xFFA99E96);
  static const line = Color(0xFFECE3DB); // warm hairline

  static const success = Color(0xFF2F8F6B); // teal-leaning green (harmonized)
  static const warning = Color(0xFFB45309); // amber-700; legible on light bg
  static const error = Color(0xFFC8553D); // terracotta reads as a warm red

  /// Canonical hero gradient — warm amber→terracotta, RTL-aware
  /// topRight→bottomLeft. Every full-bleed hero (trainee home, coach
  /// dashboard) uses this exact gradient. Don't invent new ones. White hero
  /// text/tiles ride on top — terracotta is weighted to keep contrast.
  static const gradientHero = LinearGradient(
    colors: [orange, terracotta],
    begin: Alignment.topRight,
    end: Alignment.bottomLeft,
    stops: [0.0, 0.85],
  );

  /// Brand-tinted soft shadow for card depth (never pure black).
  static final cardShadow = teal.withValues(alpha: 0.10);
}

ThemeData buildBrandTheme() {
  final colorScheme = ColorScheme(
    brightness: Brightness.light,
    primary: BrandColors.teal,
    onPrimary: Colors.white,
    primaryContainer: BrandColors.teal.withValues(alpha: 0.15),
    onPrimaryContainer: BrandColors.tealDark,
    secondary: BrandColors.orange,
    onSecondary: Colors.white,
    secondaryContainer: BrandColors.peach,
    onSecondaryContainer: BrandColors.orangeDark,
    tertiary: BrandColors.terracotta,
    onTertiary: Colors.white,
    surface: BrandColors.surface,
    onSurface: BrandColors.ink,
    surfaceContainerHighest: BrandColors.bg,
    surfaceContainerHigh: const Color(0xFFF2EBE4),
    onSurfaceVariant: BrandColors.inkSoft,
    outline: BrandColors.line,
    outlineVariant: BrandColors.line.withValues(alpha: 0.5),
    error: BrandColors.error,
    onError: Colors.white,
    errorContainer: BrandColors.error.withValues(alpha: 0.15),
    onErrorContainer: BrandColors.error,
    inverseSurface: BrandColors.ink,
    onInverseSurface: BrandColors.bg,
    inversePrimary: BrandColors.teal.withValues(alpha: 0.6),
    shadow: Colors.black.withValues(alpha: 0.1),
    scrim: Colors.black.withValues(alpha: 0.5),
  );

  // Heebo type scale: Bold for hero, Regular for body, Light for hints.
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: colorScheme,
    scaffoldBackgroundColor: BrandColors.bg,
  );

  // Tabular figures on every large/number-bearing style: digits share one
  // width, so stats, weights, countdowns, and counts never reflow as they
  // change. The premium "scoreboard" feel for free across the whole app.
  const tnum = [FontFeature.tabularFigures()];
  final textTheme = GoogleFonts.heeboTextTheme(base.textTheme).copyWith(
    displayLarge: GoogleFonts.heebo(
        fontSize: 50, fontWeight: FontWeight.w800, color: BrandColors.ink, height: 1.05, fontFeatures: tnum),
    displayMedium: GoogleFonts.heebo(
        fontSize: 37, fontWeight: FontWeight.w800, color: BrandColors.ink, fontFeatures: tnum),
    displaySmall: GoogleFonts.heebo(
        fontSize: 28, fontWeight: FontWeight.w800, color: BrandColors.ink, fontFeatures: tnum),
    headlineLarge: GoogleFonts.heebo(
        fontSize: 28, fontWeight: FontWeight.w700, color: BrandColors.ink, fontFeatures: tnum),
    headlineMedium: GoogleFonts.heebo(
        fontSize: 21, fontWeight: FontWeight.w700, color: BrandColors.ink, fontFeatures: tnum),
    headlineSmall: GoogleFonts.heebo(
        fontSize: 19, fontWeight: FontWeight.w700, color: BrandColors.ink, fontFeatures: tnum),
    titleLarge: GoogleFonts.heebo(
        fontSize: 17, fontWeight: FontWeight.w700, color: BrandColors.ink),
    titleMedium: GoogleFonts.heebo(
        fontSize: 15, fontWeight: FontWeight.w600, color: BrandColors.ink),
    titleSmall: GoogleFonts.heebo(
        fontSize: 13, fontWeight: FontWeight.w600, color: BrandColors.inkSoft),
    bodyLarge: GoogleFonts.heebo(
        fontSize: 16, fontWeight: FontWeight.w400, color: BrandColors.ink, height: 1.4),
    bodyMedium: GoogleFonts.heebo(
        fontSize: 14, fontWeight: FontWeight.w400, color: BrandColors.ink, height: 1.4),
    bodySmall: GoogleFonts.heebo(
        fontSize: 12, fontWeight: FontWeight.w400, color: BrandColors.inkSoft),
    labelLarge: GoogleFonts.heebo(
        fontSize: 14, fontWeight: FontWeight.w600, color: BrandColors.ink),
    labelMedium: GoogleFonts.heebo(
        fontSize: 12, fontWeight: FontWeight.w600, color: BrandColors.inkSoft),
    labelSmall: GoogleFonts.heebo(
        fontSize: 11, fontWeight: FontWeight.w500, color: BrandColors.inkSoft),
  );

  return base.copyWith(
    textTheme: textTheme,
    appBarTheme: AppBarTheme(
      backgroundColor: BrandColors.surface,
      foregroundColor: BrandColors.ink,
      elevation: 0,
      scrolledUnderElevation: 0.5,
      shadowColor: BrandColors.line,
      titleTextStyle: textTheme.titleLarge,
      iconTheme: const IconThemeData(color: BrandColors.ink),
    ),
    cardTheme: CardThemeData(
      // Crisp, lightly-lifted card. Subtle shadow + hairline, moderate radius
      // (not over-rounded) for a designed, premium feel.
      elevation: 2,
      color: BrandColors.surface,
      surfaceTintColor: Colors.transparent,
      shadowColor: BrandColors.cardShadow,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: BrandColors.line.withValues(alpha: 0.7)),
      ),
      margin: const EdgeInsets.symmetric(vertical: 6),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: BrandColors.teal,
        foregroundColor: Colors.white,
        textStyle: textTheme.labelLarge,
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 15),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: BrandColors.teal,
        side: const BorderSide(color: BrandColors.teal, width: 1.5),
        textStyle: textTheme.labelLarge,
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 15),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    dividerTheme: const DividerThemeData(
      color: BrandColors.line,
      thickness: 1,
      space: 1,
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: BrandColors.ink,
      contentTextStyle: textTheme.bodyMedium?.copyWith(color: Colors.white),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ),
    // Amber FAB — the one energetic "act now" affordance.
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: BrandColors.orange,
      foregroundColor: Colors.white,
      elevation: 4,
      focusElevation: 4,
      hoverElevation: 6,
      highlightElevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
    ),
    // Filled, soft, rounded inputs with a teal focus ring.
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: BrandColors.bg,
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      hintStyle: textTheme.bodyMedium?.copyWith(color: BrandColors.inkMuted),
      labelStyle: textTheme.bodyMedium?.copyWith(color: BrandColors.inkSoft),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: BrandColors.line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: BrandColors.line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: BrandColors.teal, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: BrandColors.error, width: 1.5),
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: BrandColors.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      titleTextStyle: textTheme.titleLarge,
      contentTextStyle: textTheme.bodyMedium,
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: BrandColors.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      showDragHandle: true,
    ),
    chipTheme: ChipThemeData(
      backgroundColor: BrandColors.peach.withValues(alpha: 0.45),
      selectedColor: BrandColors.teal,
      side: BorderSide.none,
      labelStyle: textTheme.labelMedium?.copyWith(color: BrandColors.ink),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
    ),
  );
}
