import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:velofit/features/progress/measurement_logger_sheet.dart';
import 'package:velofit/features/progress/progress.dart';
import 'package:velofit/features/progress/progress_repository.dart';

class _FakeProgressRepo extends Mock implements ProgressRepository {}

Widget _harness(ProgressRepository repo) {
  return ProviderScope(
    overrides: [progressRepositoryProvider.overrideWithValue(repo)],
    child: MaterialApp(
      builder: (_, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: child ?? const SizedBox.shrink(),
      ),
      home: const Scaffold(body: MeasurementLoggerSheet()),
    ),
  );
}

void main() {
  setUpAll(() {
    registerFallbackValue(const MeasurementInput());
  });

  group('MeasurementLoggerSheet', () {
    testWidgets('empty submit shows hint, does not call repo', (tester) async {
      final repo = _FakeProgressRepo();
      await tester.pumpWidget(_harness(repo));

      await tester.tap(find.byKey(const Key('measurement-submit')));
      await tester.pump();

      expect(find.text('יש להזין לפחות שדה אחד'), findsOneWidget);
      verifyNever(() => repo.logMeasurement(any()));
    });

    testWidgets('submits weight via parsed number', (tester) async {
      final repo = _FakeProgressRepo();
      when(() => repo.logMeasurement(any())).thenAnswer((inv) async {
        final input = inv.positionalArguments.first as MeasurementInput;
        return MeasurementLog(
          id: 'm1',
          traineeId: 't1',
          loggedAt: DateTime.now(),
          weightKg: input.weightKg,
        );
      });
      await tester.pumpWidget(_harness(repo));

      await tester.enterText(find.byKey(const Key('weight-input')), '72.5');
      await tester.tap(find.byKey(const Key('measurement-submit')));
      await tester.pump();

      final captured = verify(() => repo.logMeasurement(captureAny()))
          .captured
          .single as MeasurementInput;
      expect(captured.weightKg, 72.5);
    });

    testWidgets('accepts comma as decimal separator', (tester) async {
      final repo = _FakeProgressRepo();
      when(() => repo.logMeasurement(any())).thenAnswer((_) async =>
          MeasurementLog(
            id: 'm1',
            traineeId: 't1',
            loggedAt: DateTime.now(),
            weightKg: 72.5,
          ));
      await tester.pumpWidget(_harness(repo));

      await tester.enterText(find.byKey(const Key('weight-input')), '72,5');
      await tester.tap(find.byKey(const Key('measurement-submit')));
      await tester.pump();

      final captured = verify(() => repo.logMeasurement(captureAny()))
          .captured
          .single as MeasurementInput;
      expect(captured.weightKg, 72.5);
    });

    testWidgets('energy + soreness rating goes into metrics', (tester) async {
      final repo = _FakeProgressRepo();
      when(() => repo.logMeasurement(any())).thenAnswer((_) async =>
          MeasurementLog(
            id: 'm1',
            traineeId: 't1',
            loggedAt: DateTime.now(),
            metrics: const {'energy_1to5': 4, 'soreness_1to5': 2},
          ));
      await tester.pumpWidget(_harness(repo));

      await tester.tap(find.byKey(const Key('energy-4')));
      await tester.tap(find.byKey(const Key('soreness-2')));
      await tester.tap(find.byKey(const Key('measurement-submit')));
      await tester.pump();

      final captured = verify(() => repo.logMeasurement(captureAny()))
          .captured
          .single as MeasurementInput;
      expect(captured.metrics, {'energy_1to5': 4, 'soreness_1to5': 2});
    });

    testWidgets('shows server validation error in Hebrew', (tester) async {
      final repo = _FakeProgressRepo();
      when(() => repo.logMeasurement(any())).thenThrow(
        const MeasurementValidationFailure('INVALID_WEIGHT', 'משקל לא תקין'),
      );
      await tester.pumpWidget(_harness(repo));

      await tester.enterText(find.byKey(const Key('weight-input')), '600');
      await tester.tap(find.byKey(const Key('measurement-submit')));
      await tester.pump();

      expect(find.text('משקל לא תקין'), findsOneWidget);
    });
  });
}
