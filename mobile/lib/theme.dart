import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Velofit brand palette — "athletic energy".
/// Teal primary, orange accent. Hue-shifted neutrals (warm grays).
class BrandColors {
  static const teal = Color(0xFF0EA89A);
  static const tealDark = Color(0xFF076B61);
  static const orange = Color(0xFFFF6B35);
  static const orangeDark = Color(0xFFD94F1F);

  // Warm neutrals (slight orange hue-shift)
  static const bg = Color(0xFFFAF8F5);
  static const surface = Color(0xFFFFFFFF);
  static const ink = Color(0xFF1F2421);
  static const inkSoft = Color(0xFF5B6260);
  static const inkMuted = Color(0xFF9BA29F);
  static const line = Color(0xFFE6E2DC);

  static const success = Color(0xFF1F9D55);
  static const warning = Color(0xFFB45309); // amber-700; legible on light bg
  static const error = Color(0xFFC53030);

  /// Canonical hero gradient — teal→tealDark, RTL-aware topRight→bottomLeft.
  /// Every full-bleed hero (trainee home, coach dashboard) uses this exact
  /// gradient. Don't invent new ones.
  static const gradientHero = LinearGradient(
    colors: [teal, tealDark],
    begin: Alignment.topRight,
    end: Alignment.bottomLeft,
    stops: [0.2, 1.0],
  );
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
    secondaryContainer: BrandColors.orange.withValues(alpha: 0.15),
    onSecondaryContainer: BrandColors.orangeDark,
    tertiary: BrandColors.tealDark,
    onTertiary: Colors.white,
    surface: BrandColors.surface,
    onSurface: BrandColors.ink,
    surfaceContainerHighest: BrandColors.bg,
    surfaceContainerHigh: const Color(0xFFF2EFEA),
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
      elevation: 0,
      color: BrandColors.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: BrandColors.line),
      ),
      margin: const EdgeInsets.symmetric(vertical: 6),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: BrandColors.teal,
        foregroundColor: Colors.white,
        textStyle: textTheme.labelLarge,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: BrandColors.teal,
        side: const BorderSide(color: BrandColors.teal, width: 1.5),
        textStyle: textTheme.labelLarge,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
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
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
  );
}
