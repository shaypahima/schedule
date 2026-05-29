import 'package:flutter/services.dart';

/// Centralized haptic vocabulary (#69).
///
/// Haptic + checkmark + instant UI update IS the reward — explicitly NOT
/// confetti (product-vision behavioral rule 3). Named intents keep usage
/// consistent across flows and make the mapping testable in one place.
class Haptics {
  const Haptics._();

  /// Positive trainee action — a booking confirmed.
  static Future<void> bookingSuccess() => HapticFeedback.lightImpact();

  /// Positive trainee action — a measurement / session log saved.
  static Future<void> logSaved() => HapticFeedback.lightImpact();

  /// Coach marks a no-show — a heavier, distinct signal for a weightier action.
  static Future<void> noShowMark() => HapticFeedback.heavyImpact();

  /// Selecting a slot / day.
  static Future<void> select() => HapticFeedback.mediumImpact();
}
