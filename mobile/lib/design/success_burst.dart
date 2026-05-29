import 'package:flutter/material.dart';

import '../theme.dart';
import 'motion.dart';

/// The success reward: a teal disc springs in, a white checkmark draws itself,
/// and a single ring ripples outward and fades. **This is rule-3's reward** —
/// the checkmark (+ haptic at the call site) celebrates the action. Not
/// confetti: one calm, branded burst, never particles.
///
/// Plays once via [showSuccessBurst]. Honors reduce-motion / tests through
/// [AppMotion.enabled]: when motion is off it flashes the final checkmark
/// briefly and removes itself (driven by an AnimationController, so
/// `pumpAndSettle` advances and removes it — no leaked timers).
class SuccessBurst extends StatefulWidget {
  final VoidCallback onDone;
  final double size;

  const SuccessBurst({super.key, required this.onDone, this.size = 96});

  @override
  State<SuccessBurst> createState() => _SuccessBurstState();
}

class _SuccessBurstState extends State<SuccessBurst>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    // Reads MediaQuery (reduce-motion) — must be here, not initState.
    final motion = AppMotion.enabled(context);
    _c = AnimationController(
      vsync: this,
      duration: motion
          ? const Duration(milliseconds: 850)
          : AppMotion.fast, // brief flash when motion is off
    )..addStatusListener((s) {
        if (s == AnimationStatus.completed) widget.onDone();
      });
    _c.forward();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Center(
        child: AnimatedBuilder(
          animation: _c,
          builder: (context, _) => CustomPaint(
            size: Size.square(widget.size),
            painter: _SuccessPainter(_c.value),
          ),
        ),
      ),
    );
  }
}

class _SuccessPainter extends CustomPainter {
  /// 0→1 over the whole burst.
  final double t;
  _SuccessPainter(this.t);

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final r = size.width / 2;

    // Phases (eased) ------------------------------------------------------
    final discIn = Curves.easeOutBack.transform(_seg(t, 0.0, 0.45));
    final checkP = Curves.easeOut.transform(_seg(t, 0.35, 0.8));
    final rippleP = Curves.easeOut.transform(_seg(t, 0.15, 1.0));
    final fade = 1.0 - _seg(t, 0.85, 1.0);

    // Outer ripple ring (expands past the disc, fades) --------------------
    if (rippleP > 0) {
      final ringPaint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3
        ..color = BrandColors.teal
            .withValues(alpha: (1 - rippleP) * 0.5 * fade);
      canvas.drawCircle(center, r * (0.6 + rippleP * 0.8), ringPaint);
    }

    // Disc ---------------------------------------------------------------
    final discR = r * 0.72 * discIn;
    if (discR > 0) {
      canvas.drawCircle(
        center,
        discR,
        Paint()..color = BrandColors.teal.withValues(alpha: fade),
      );
    }

    // Checkmark (draws progressively) ------------------------------------
    if (checkP > 0 && discIn > 0.6) {
      final p1 = center + Offset(-r * 0.26, r * 0.02);
      final p2 = center + Offset(-r * 0.06, r * 0.22);
      final p3 = center + Offset(r * 0.28, -r * 0.20);

      final checkPaint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = r * 0.10
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..color = Colors.white.withValues(alpha: fade);

      // First leg fills 0→0.4 of checkP, second leg 0.4→1.
      final path = Path()..moveTo(p1.dx, p1.dy);
      final leg1 = (checkP / 0.4).clamp(0.0, 1.0);
      path.lineTo(
        p1.dx + (p2.dx - p1.dx) * leg1,
        p1.dy + (p2.dy - p1.dy) * leg1,
      );
      if (checkP > 0.4) {
        final leg2 = ((checkP - 0.4) / 0.6).clamp(0.0, 1.0);
        path.lineTo(
          p2.dx + (p3.dx - p2.dx) * leg2,
          p2.dy + (p3.dy - p2.dy) * leg2,
        );
      }
      canvas.drawPath(path, checkPaint);
    }
  }

  /// Normalizes [t] within [start,end] to 0→1, clamped.
  double _seg(double t, double start, double end) =>
      ((t - start) / (end - start)).clamp(0.0, 1.0);

  @override
  bool shouldRepaint(_SuccessPainter old) => old.t != t;
}

/// Shows a one-shot [SuccessBurst] centered over the current screen and removes
/// it when the animation finishes. Pair with a haptic at the call site.
void showSuccessBurst(BuildContext context) {
  final overlay = Overlay.maybeOf(context, rootOverlay: true);
  if (overlay == null) return;
  late OverlayEntry entry;
  entry = OverlayEntry(
    builder: (_) => SuccessBurst(onDone: () => entry.remove()),
  );
  overlay.insert(entry);
}
