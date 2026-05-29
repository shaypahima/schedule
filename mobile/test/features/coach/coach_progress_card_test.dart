import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:velofit/features/coach/coach_progress_repository.dart';
import 'package:velofit/features/coach/coach_trainee_detail_screen.dart';
import 'package:velofit/features/coach/trainee_detail_repository.dart';
import 'package:velofit/features/progress/progress.dart';

class _FakeDetailRepo extends Mock implements TraineeDetailRepository {}

class _FakeCoachProgressRepo extends Mock implements CoachProgressRepository {}

MeasurementLog _m(double? w, DateTime at, {String? note}) =>
    MeasurementLog(id: 'm${at.day}', traineeId: 't1', loggedAt: at, weightKg: w, note: note);

Widget _harness(CoachProgressRepository progress) {
  final detail = _FakeDetailRepo();
  when(() => detail.fetch('t1')).thenAnswer((_) async => const TraineeDetailView(
        id: 't1',
        name: 'יעל כהן',
        isActive: true,
        bio: TraineeBio(),
        sessions: [],
        weekBookingsCount: 0,
      ));
  return ProviderScope(
    overrides: [
      traineeDetailRepositoryProvider.overrideWithValue(detail),
      coachProgressRepositoryProvider.overrideWithValue(progress),
    ],
    child: MaterialApp(
      builder: (context, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: child ?? const SizedBox.shrink(),
      ),
      home: const CoachTraineeDetailScreen(traineeId: 't1'),
    ),
  );
}

/// Tall viewport so the whole detail ListView (progress card is last) lays out
/// — otherwise the lazy ListView never builds the off-screen card.
Future<void> _pump(WidgetTester tester, Widget w) async {
  tester.view.physicalSize = const Size(1200, 3200);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(w);
  await tester.pumpAndSettle();
}

void main() {
  group('CoachTraineeDetailScreen progress card', () {
    testWidgets('renders SectionHeader + chart + weight rows when measurements exist',
        (tester) async {
      final repo = _FakeCoachProgressRepo();
      final newest = _m(68.0, DateTime(2026, 5, 20));
      when(() => repo.fetch('t1')).thenAnswer((_) async => ProgressView(
            measurements: [newest, _m(70.0, DateTime(2026, 5, 1))],
            lastMeasurement: newest,
          ));

      await _pump(tester, _harness(repo));

      expect(find.text('התקדמות'), findsOneWidget);
      expect(find.byKey(const Key('weight-chart')), findsOneWidget);
      expect(find.text('68.0 ק״ג'), findsOneWidget);
    });

    testWidgets('shows progress-empty EmptyState when no measurements', (tester) async {
      final repo = _FakeCoachProgressRepo();
      when(() => repo.fetch('t1'))
          .thenAnswer((_) async => const ProgressView(measurements: []));

      await _pump(tester, _harness(repo));

      expect(find.byKey(const Key('progress-empty')), findsOneWidget);
      expect(find.text('אין מדידות עדיין'), findsOneWidget);
    });

    testWidgets('shows chart placeholder when only one weight point', (tester) async {
      final repo = _FakeCoachProgressRepo();
      when(() => repo.fetch('t1')).thenAnswer((_) async =>
          ProgressView(measurements: [_m(70.0, DateTime(2026, 5, 20))]));

      await _pump(tester, _harness(repo));

      // <2 weight points → WeightChart renders its placeholder, not the chart.
      expect(find.byKey(const Key('weight-chart')), findsNothing);
      expect(find.text('נדרשים לפחות שני מדידות לגרף'), findsOneWidget);
    });

    testWidgets('error path shows progress-error', (tester) async {
      final repo = _FakeCoachProgressRepo();
      when(() => repo.fetch('t1')).thenThrow(Exception('boom'));

      await _pump(tester, _harness(repo));

      expect(find.byKey(const Key('progress-error')), findsOneWidget);
    });
  });
}
