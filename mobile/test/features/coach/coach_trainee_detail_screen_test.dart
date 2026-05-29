import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:velofit/features/coach/coach_progress_repository.dart';
import 'package:velofit/features/coach/coach_trainee_detail_screen.dart';
import 'package:velofit/features/coach/trainee_detail_repository.dart';
import 'package:velofit/features/progress/progress.dart';

class _FakeRepo extends Mock implements TraineeDetailRepository {}

class _FakeCoachProgressRepo extends Mock implements CoachProgressRepository {}

Widget _harness(TraineeDetailRepository repo) {
  final progress = _FakeCoachProgressRepo();
  when(() => progress.fetch(any())).thenAnswer(
    (_) async => const ProgressView(measurements: []),
  );
  return ProviderScope(
      overrides: [
        traineeDetailRepositoryProvider.overrideWithValue(repo),
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

TraineeDetailView _viewWith({TraineeBio? bio, List<TraineeSession>? sessions, bool active = true}) =>
    TraineeDetailView(
      id: 't1',
      name: 'יעל כהן',
      isActive: active,
      bio: bio ?? const TraineeBio(),
      sessions: sessions ?? const [],
      weekBookingsCount: 2,
    );

void main() {
  group('CoachTraineeDetailScreen', () {
    testWidgets('renders name + Hebrew status + bio fields', (tester) async {
      final repo = _FakeRepo();
      when(() => repo.fetch('t1')).thenAnswer((_) async => _viewWith(
            bio: const TraineeBio(
              phone: '+972501234567',
              dateOfBirth: '1992-04-08',
              heightCm: 168,
              weightKg: 65,
              goals: 'לרדת 5 ק״ג',
              medical: 'אין',
            ),
          ));

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      expect(find.text('יעל כהן'), findsWidgets);
      expect(find.text('פעיל'), findsOneWidget);
      expect(find.text('168 ס״מ'), findsOneWidget);
      expect(find.text('65 ק״ג'), findsOneWidget);
      expect(find.text('לרדת 5 ק״ג'), findsOneWidget);
      expect(find.text('+972501234567'), findsOneWidget);
    });

    testWidgets('renders חסר for missing bio fields', (tester) async {
      final repo = _FakeRepo();
      when(() => repo.fetch('t1')).thenAnswer((_) async => _viewWith());

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('bio-card')), findsOneWidget);
      expect(find.text('חסר'), findsWidgets);
    });

    testWidgets('renders past sessions', (tester) async {
      final repo = _FakeRepo();
      when(() => repo.fetch('t1')).thenAnswer((_) async => _viewWith(
            sessions: const [
              TraineeSession(bookingId: 'b1', date: '2026-04-10', startTime: '10:00'),
              TraineeSession(bookingId: 'b2', date: '2026-04-08', startTime: '14:00'),
            ],
          ));

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      // New layout splits time + date.
      expect(find.text('10:00'), findsOneWidget);
      expect(find.text('14:00'), findsOneWidget);
      expect(find.text('10.4'), findsOneWidget);
      expect(find.text('8.4'), findsOneWidget);
    });

    testWidgets('empty sessions uses EmptyState pattern with history icon (R24)',
        (tester) async {
      final repo = _FakeRepo();
      when(() => repo.fetch('t1')).thenAnswer((_) async => _viewWith());

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('sessions-empty')), findsOneWidget);
      expect(find.text('עדיין אין אימונים'), findsOneWidget);
      expect(
        find.descendant(
          of: find.byKey(const Key('sessions-empty')),
          matching: find.byIcon(Icons.history),
        ),
        findsOneWidget,
      );
    });

    testWidgets('empty intro_text shows muted placeholder (R23)', (tester) async {
      final repo = _FakeRepo();
      when(() => repo.fetch('t1')).thenAnswer(
        (_) async => _viewWith(bio: const TraineeBio()),
      );

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      expect(find.text('אין הצגה עצמית'), findsOneWidget);
    });

    testWidgets('shows מושבת label when inactive', (tester) async {
      final repo = _FakeRepo();
      when(() => repo.fetch('t1')).thenAnswer((_) async => _viewWith(active: false));

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      expect(find.text('מושבת'), findsOneWidget);
    });

    testWidgets('error path shows error widget', (tester) async {
      final repo = _FakeRepo();
      when(() => repo.fetch('t1')).thenThrow(Exception('boom'));

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('trainee-detail-error')), findsOneWidget);
    });
  });
}
