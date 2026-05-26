import 'package:flutter/material.dart';

import '../../theme.dart';
import 'progress.dart';

/// Lightweight CustomPainter line chart for weight-over-time. Renders nothing
/// when there are <2 weight points (caller decides what placeholder to show).
class WeightChart extends StatelessWidget {
  final List<MeasurementLog> measurements;
  final double height;

  const WeightChart({
    super.key,
    required this.measurements,
    this.height = 180,
  });

  @override
  Widget build(BuildContext context) {
    final points = measurements
        .where((m) => m.weightKg != null)
        .toList()
        .reversed
        .toList(); // chronological L→R
    if (points.length < 2) {
      return SizedBox(
        height: height,
        child: Center(
          child: Text(
            points.isEmpty
                ? 'אין נתונים עדיין — תיעוד ראשון יראה גרף'
                : 'נדרשים לפחות שני מדידות לגרף',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
            textAlign: TextAlign.center,
          ),
        ),
      );
    }

    return SizedBox(
      key: const Key('weight-chart'),
      height: height,
      child: CustomPaint(
        size: Size.infinite,
        painter: _WeightChartPainter(
          points: points,
          line: BrandColors.teal,
          fill: BrandColors.teal.withValues(alpha: 0.10),
          axis: BrandColors.line,
          label: Theme.of(context).colorScheme.onSurfaceVariant,
        ),
      ),
    );
  }
}

class _WeightChartPainter extends CustomPainter {
  final List<MeasurementLog> points;
  final Color line;
  final Color fill;
  final Color axis;
  final Color label;

  _WeightChartPainter({
    required this.points,
    required this.line,
    required this.fill,
    required this.axis,
    required this.label,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final weights = points.map((p) => p.weightKg!).toList();
    final minW = weights.reduce((a, b) => a < b ? a : b);
    final maxW = weights.reduce((a, b) => a > b ? a : b);
    // Pad the range so a flat trend still draws a band, and avoid /0.
    final spread = (maxW - minW).abs();
    final pad = spread < 0.5 ? 1.0 : spread * 0.15;
    final lo = minW - pad;
    final hi = maxW + pad;

    final leftPad = 32.0;
    final rightPad = 8.0;
    final topPad = 8.0;
    final bottomPad = 22.0;

    final chartW = size.width - leftPad - rightPad;
    final chartH = size.height - topPad - bottomPad;

    // Axes
    final axisPaint = Paint()
      ..color = axis
      ..strokeWidth = 1;
    canvas.drawLine(
      Offset(leftPad, topPad + chartH),
      Offset(leftPad + chartW, topPad + chartH),
      axisPaint,
    );

    // Plot points
    final dx = chartW / (points.length - 1);
    final offsets = <Offset>[];
    for (var i = 0; i < points.length; i++) {
      final w = points[i].weightKg!;
      final t = (w - lo) / (hi - lo);
      final y = topPad + chartH - t * chartH;
      offsets.add(Offset(leftPad + i * dx, y));
    }

    // Fill under the line
    final fillPath = Path()
      ..moveTo(offsets.first.dx, topPad + chartH)
      ..lineTo(offsets.first.dx, offsets.first.dy);
    for (var i = 1; i < offsets.length; i++) {
      fillPath.lineTo(offsets[i].dx, offsets[i].dy);
    }
    fillPath.lineTo(offsets.last.dx, topPad + chartH);
    fillPath.close();
    canvas.drawPath(fillPath, Paint()..color = fill);

    // Line
    final linePaint = Paint()
      ..color = line
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final linePath = Path()..moveTo(offsets.first.dx, offsets.first.dy);
    for (var i = 1; i < offsets.length; i++) {
      linePath.lineTo(offsets[i].dx, offsets[i].dy);
    }
    canvas.drawPath(linePath, linePaint);

    // Dots
    final dotPaint = Paint()..color = line;
    for (final o in offsets) {
      canvas.drawCircle(o, 3.5, dotPaint);
    }

    // Y labels (min + max)
    _drawText(canvas, hi.toStringAsFixed(1), Offset(0, topPad - 4));
    _drawText(
      canvas,
      lo.toStringAsFixed(1),
      Offset(0, topPad + chartH - 8),
    );

    // X labels (first + last date as DD/MM)
    _drawText(
      canvas,
      _fmt(points.first.loggedAt),
      Offset(leftPad - 12, topPad + chartH + 6),
    );
    _drawText(
      canvas,
      _fmt(points.last.loggedAt),
      Offset(leftPad + chartW - 22, topPad + chartH + 6),
    );
  }

  void _drawText(Canvas canvas, String text, Offset pos) {
    final tp = TextPainter(
      text: TextSpan(
        text: text,
        style: TextStyle(color: label, fontSize: 10),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, pos);
  }

  String _fmt(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}';

  @override
  bool shouldRepaint(covariant _WeightChartPainter old) =>
      old.points != points || old.line != line || old.fill != fill;
}
