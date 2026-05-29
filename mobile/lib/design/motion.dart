import 'package:flutter/material.dart';

/// Velofit motion tokens + gate.
///
/// One source of truth for durations and curves so every animated widget
/// shares the same rhythm. Built to sit under `flutter_animate` (the everyday
/// declarative layer) and Flutter's implicit `AnimatedX` widgets.
///
/// **Infinite/repeating** animations (shimmer, pulse, wiggle) MUST be gated
/// behind [infiniteMotionEnabled]. That gate:
///   1. honors the OS "reduce motion" accessibility setting, and
///   2. collapses loops to a static frame in widget tests, so an unbounded
///      animation never hangs `pumpAndSettle`.
/// `test/flutter_test_config.dart` sets [disableInfiniteForTests] = true for
/// the whole package.
///
/// Finite animations (entries, press, count-ups) need no gate — they settle.
class AppMotion {
  AppMotion._();

  // ── Durations ──────────────────────────────────────────────────────────
  /// Press / tap acknowledgement.
  static const micro = Duration(milliseconds: 120);

  /// Small state changes (chip toggle, icon swap).
  static const fast = Duration(milliseconds: 200);

  /// Standard entries and `AnimatedSwitcher` crossfades.
  static const standard = Duration(milliseconds: 250);

  /// Hero reveals and number count-ups.
  static const emphasized = Duration(milliseconds: 400);

  /// One shimmer sweep across a skeleton.
  static const shimmerCycle = Duration(milliseconds: 1100);

  /// Per-item delay when staggering a list reveal.
  static const stagger = Duration(milliseconds: 55);

  // ── Curves ─────────────────────────────────────────────────────────────
  /// Things appearing / moving into place.
  static const entry = Curves.easeOutCubic;

  /// Things leaving.
  static const exit = Curves.easeInCubic;

  /// Default for value/size changes.
  static const standardCurve = Curves.easeOutQuad;

  /// Press release and small "pops" (slight overshoot).
  static const springy = Curves.easeOutBack;

  // ── Gate ───────────────────────────────────────────────────────────────
  /// Flipped true by the test harness (`flutter_test_config.dart`) so
  /// repeating animations render a single static frame instead of looping.
  static bool disableInfiniteForTests = false;

  /// True when looping animations should actually run: not under test, and
  /// the user hasn't asked the OS to reduce motion.
  static bool infiniteMotionEnabled(BuildContext context) {
    if (disableInfiniteForTests) return false;
    final mq = MediaQuery.maybeOf(context);
    return !(mq?.disableAnimations ?? false);
  }
}

/// Wraps [child] in a brief scale-down on press, with an optional [onTap].
///
/// The everyday tactile primitive for buttons, cards, and tiles: primary
/// affordances shrink to [pressedScale] on touch-down and spring back on
/// release. Purely finite (a single `AnimatedScale`), so it is test-safe and
/// never gated.
class PressableScale extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  final double pressedScale;
  final HitTestBehavior behavior;

  const PressableScale({
    super.key,
    required this.child,
    this.onTap,
    this.pressedScale = 0.97,
    this.behavior = HitTestBehavior.opaque,
  });

  @override
  State<PressableScale> createState() => _PressableScaleState();
}

class _PressableScaleState extends State<PressableScale> {
  bool _pressed = false;

  void _set(bool v) {
    if (_pressed != v) setState(() => _pressed = v);
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: widget.behavior,
      onTap: widget.onTap,
      onTapDown: (_) => _set(true),
      onTapUp: (_) => _set(false),
      onTapCancel: () => _set(false),
      child: AnimatedScale(
        scale: _pressed ? widget.pressedScale : 1.0,
        duration: AppMotion.micro,
        curve: AppMotion.springy,
        child: widget.child,
      ),
    );
  }
}
