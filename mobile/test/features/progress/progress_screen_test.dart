import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:velofit/features/progress/progress.dart';
import 'package:velofit/features/progress/progress_repository.dart';
import 'package:velofit/features/progress/progress_screen.dart';

class _FakeProgressRepo extends Mock implements ProgressRepository {}

Widget _harness(ProgressRepository repo) {
  return ProviderScope(
    overrides: [progressRepositoryProvider.overrideWithValue(repo)],
    child: MaterialApp(
      builder: (_, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: child ?? const SizedBox.shrink(),
      ),
      home: const ProgressScreen(),
    ),
  );
}

void main() {
  setUpAll(() {
    registerFallbackValue(const MeasurementInput());
  });

  group('ProgressScreen', () {
    testWidgets('renders empty state when no measurements', (tester) async {
      final repo = _FakeProgressRepo();
      when(() => repo.fetch(days: any(named: 'days'))).thenAnswer(
        (_) async => const ProgressView(measurements: [], lastMeasurement: null),
      );

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      expect(find.text('עוד אין תיעודים'), findsOneWidget);
      expect(find.byKey(const Key('progress-log-fab')), findsOneWidget);
    });

    testWidgets('renders last snapshot + chart when 2+ measurements', (tester) async {
      final repo = _FakeProgressRepo();
      final m1 = MeasurementLog(
        id: 'm1',
        traineeId: 't1',
        loggedAt: DateTime(2026, 5, 1),
        weightKg: 73.0,
      );
      final m2 = MeasurementLog(
        id: 'm2',
        traineeId: 't1',
        loggedAt: DateTime(2026, 5, 20),
        weightKg: 71.5,
      );
      when(() => repo.fetch(days: any(named: 'days'))).thenAnswer(
        (_) async => ProgressView(
          measurements: [m2, m1], // newest first
          lastMeasurement: m2,
        ),
      );

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      // 71.5 appears in both the snapshot card AND the log row list — both valid
      expect(find.text('71.5 ק"ג'), findsAtLeast(1));
      expect(find.byKey(const Key('weight-chart')), findsOneWidget);
      expect(find.byKey(const Key('log-row-m1')), findsOneWidget);
      expect(find.byKey(const Key('log-row-m2')), findsOneWidget);
    });

    testWidgets('chart placeholder shows when only one weight point',
        (tester) async {
      final repo = _FakeProgressRepo();
      final m1 = MeasurementLog(
        id: 'm1',
        traineeId: 't1',
        loggedAt: DateTime(2026, 5, 1),
        weightKg: 73.0,
      );
      when(() => repo.fetch(days: any(named: 'days'))).thenAnswer(
        (_) async => ProgressView(measurements: [m1], lastMeasurement: m1),
      );

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      expect(find.text('נדרשים לפחות שני מדידות לגרף'), findsOneWidget);
    });
  });
}
