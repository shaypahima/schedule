import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

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
  /// animations render their final frame instead of playing (loops would hang
  /// `pumpAndSettle`; entrances/count-ups would add flaky mid-flight frames).
  static bool disableInfiniteForTests = false;

  /// True when *any* non-essential animation should play (entrances, count-ups,
  /// loops): not under test, and the user hasn't asked the OS to reduce motion.
  static bool enabled(BuildContext context) {
    if (disableInfiniteForTests) return false;
    final mq = MediaQuery.maybeOf(context);
    return !(mq?.disableAnimations ?? false);
  }

  /// Alias kept for call sites that specifically gate looping animations.
  static bool infiniteMotionEnabled(BuildContext context) => enabled(context);
}

/// Staggered entrance: fades + lifts [child] into place, delayed by its
/// position so a list reveals top-to-bottom. Finite, but skipped entirely when
/// motion is off (reduce-motion / tests) — returns the child untouched so
/// hit-testing and `find` work without a `pumpAndSettle`.
class Reveal extends StatelessWidget {
  final Widget child;
  final int index;
  final double offsetY;

  const Reveal(this.child, {super.key, this.index = 0, this.offsetY = 0.08});

  @override
  Widget build(BuildContext context) {
    if (!AppMotion.enabled(context)) return child;
    return child
        .animate(delay: AppMotion.stagger * index)
        .fadeIn(duration: AppMotion.standard, curve: AppMotion.entry)
        .slideY(
          begin: offsetY,
          end: 0,
          duration: AppMotion.standard,
          curve: AppMotion.entry,
        );
  }
}

/// Wraps [child] in a brief scale-down on press.
///
/// The everyday tactile primitive for buttons, cards, and tiles: primary
/// affordances shrink to [pressedScale] on touch-down and spring back on
/// release. Purely finite (a single `AnimatedScale`), so it is test-safe and
/// never gated.
///
/// Press tracking uses a [Listener], which does NOT compete in the gesture
/// arena — so it can decorate a widget that already has its own `InkWell` /
/// `GestureDetector` without stealing taps. Pass [onTap] only when this widget
/// should own the tap itself.
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
    Widget result = Listener(
      onPointerDown: (_) => _set(true),
      onPointerUp: (_) => _set(false),
      onPointerCancel: (_) => _set(false),
      child: AnimatedScale(
        scale: _pressed ? widget.pressedScale : 1.0,
        duration: AppMotion.micro,
        curve: AppMotion.springy,
        child: widget.child,
      ),
    );
    if (widget.onTap != null) {
      result = GestureDetector(
        behavior: widget.behavior,
        onTap: widget.onTap,
        child: result,
      );
    }
    return result;
  }
}
