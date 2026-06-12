import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Velofit brand palette — "cream editorial". Warm paper neutrals + ink
/// typography; teal appears only on actions (CTAs, links, focus, badges).
/// Flat surfaces, hairline sand borders, no gradients, no decorative color.
/// Anything colored is tappable or semantic — color == meaning.
class BrandColors {
  static const teal = Color(0xFF4F7E7E); // action color — CTAs, links, badges
  static const tealDark = Color(0xFF3A6160); // pressed / emphasis text

  // Paper neutrals
  static const bg = Color(0xFFF7F2EA); // cream paper page
  static const surface = Color(0xFFFFFDF8); // ivory card
  static const cream = Color(0xFFEFE6D8); // soft fill — discs, banners, chips
  static const sand = Color(0xFFD9CBB4); // strong hairline, chip borders
  static const sandDeep = Color(0xFFA08B66); // warm taupe — quiet data accents
  static const ink = Color(0xFF2B2723); // primary text
  static const inkSoft = Color(0xFF6B6258); // secondary text, labels
  static const inkMuted = Color(0xFFA1968A); // tertiary text, placeholders
  static const line = Color(0xFFE9E0D2); // default hairline / divider

  static const success = Color(0xFF2F8F6B); // confirmed, approved, attended
  static const warning = Color(0xFFB45309); // legible amber-700 on light bg
  static const error = Color(0xFFB3503C); // warm clay red — errors, no-show
}

ThemeData buildBrandTheme() {
  final colorScheme = ColorScheme(
    brightness: Brightness.light,
    primary: BrandColors.teal,
    onPrimary: Colors.white,
    primaryContainer: BrandColors.teal.withValues(alpha: 0.12),
    onPrimaryContainer: BrandColors.tealDark,
    secondary: BrandColors.sandDeep,
    onSecondary: Colors.white,
    secondaryContainer: BrandColors.cream,
    onSecondaryContainer: BrandColors.ink,
    tertiary: BrandColors.tealDark,
    onTertiary: Colors.white,
    surface: BrandColors.surface,
    onSurface: BrandColors.ink,
    surfaceContainerHighest: BrandColors.bg,
    surfaceContainerHigh: const Color(0xFFF1EADE),
    onSurfaceVariant: BrandColors.inkSoft,
    outline: BrandColors.line,
    outlineVariant: BrandColors.line.withValues(alpha: 0.5),
    error: BrandColors.error,
    onError: Colors.white,
    errorContainer: BrandColors.error.withValues(alpha: 0.12),
    onErrorContainer: BrandColors.error,
    inverseSurface: BrandColors.ink,
    onInverseSurface: BrandColors.bg,
    inversePrimary: BrandColors.teal.withValues(alpha: 0.6),
    shadow: Colors.black.withValues(alpha: 0.08),
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
      backgroundColor: BrandColors.bg,
      foregroundColor: BrandColors.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      titleTextStyle: textTheme.titleLarge,
      iconTheme: const IconThemeData(color: BrandColors.ink),
    ),
    cardTheme: CardThemeData(
      // Flat editorial card: ivory paper + sand hairline. No shadow — depth
      // comes from the surface/bg contrast, not elevation.
      elevation: 0,
      color: BrandColors.surface,
      surfaceTintColor: Colors.transparent,
      shadowColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: BrandColors.line),
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
    // Teal FAB — actions are teal, everywhere, no exceptions.
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: BrandColors.teal,
      foregroundColor: Colors.white,
      elevation: 1,
      focusElevation: 1,
      hoverElevation: 2,
      highlightElevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
    ),
    // Filled, soft, rounded inputs with a teal focus ring.
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: BrandColors.surface,
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      hintStyle: textTheme.bodyMedium?.copyWith(color: BrandColors.inkMuted),
      labelStyle: textTheme.bodyMedium?.copyWith(color: BrandColors.inkSoft),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: BrandColors.sand),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: BrandColors.sand),
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
      backgroundColor: BrandColors.cream.withValues(alpha: 0.6),
      selectedColor: BrandColors.teal,
      side: const BorderSide(color: BrandColors.sand),
      labelStyle: textTheme.labelMedium?.copyWith(color: BrandColors.ink),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
    ),
  );
}
