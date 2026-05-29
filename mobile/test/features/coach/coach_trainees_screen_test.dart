import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:velofit/features/coach/admin_repository.dart';
import 'package:velofit/features/coach/coach_trainees_screen.dart';

class _FakeAdminRepo extends Mock implements AdminRepository {}

Widget _harness({required AdminRepository admin}) => ProviderScope(
      overrides: [adminRepositoryProvider.overrideWithValue(admin)],
      child: MaterialApp(
        builder: (context, child) => Directionality(
          textDirection: TextDirection.rtl,
          child: child ?? const SizedBox.shrink(),
        ),
        home: const CoachTraineesScreen(),
      ),
    );

void main() {
  setUpAll(() {
    registerFallbackValue(<String, dynamic>{});
  });

  group('CoachTraineesScreen', () {
    testWidgets('renders trainees with Hebrew status badges', (tester) async {
      final admin = _FakeAdminRepo();
      when(() => admin.listTrainees()).thenAnswer((_) async => [
            const TraineeRecord(
              id: 't1',
              name: 'יעל כהן',
              email: 'yael@example.com',
              status: 'active',
              isRecurring: false,
            ),
            const TraineeRecord(
              id: 't2',
              name: 'איתי לוי',
              email: 'itai@example.com',
              status: 'pending',
              isRecurring: false,
            ),
            const TraineeRecord(
              id: 't3',
              name: 'נועה מזרחי',
              email: 'noa@example.com',
              status: 'deactivated',
              isRecurring: false,
            ),
          ]);

      await tester.pumpWidget(_harness(admin: admin));
      await tester.pumpAndSettle();

      expect(find.text('יעל כהן'), findsOneWidget);
      expect(find.text('פעיל'), findsOneWidget);
      expect(find.text('ממתין'), findsOneWidget);
      expect(find.text('מושבת'), findsOneWidget);
      // Pending shows resend; deactivated does NOT show deactivate button
      expect(find.byKey(const Key('resend-t2')), findsOneWidget);
      expect(find.byKey(const Key('deactivate-t3')), findsNothing);
    });

    testWidgets('shows weight chip with trend arrow + attendance chip', (tester) async {
      final admin = _FakeAdminRepo();
      when(() => admin.listTrainees()).thenAnswer((_) async => [
            const TraineeRecord(
              id: 't1',
              name: 'יעל כהן',
              status: 'active',
              isRecurring: false,
              lastWeightKg: 68.0,
              weightTrend14d: 'down',
              attendanceRate: 0.8,
            ),
          ]);

      await tester.pumpWidget(_harness(admin: admin));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('weight-chip-t1')), findsOneWidget);
      expect(
        find.descendant(
          of: find.byKey(const Key('weight-chip-t1')),
          matching: find.byIcon(Icons.south_east),
        ),
        findsOneWidget,
      );
      expect(find.text('68.0 ק״ג'), findsOneWidget);
      expect(find.byKey(const Key('attendance-chip-t1')), findsOneWidget);
      expect(find.text('80%'), findsOneWidget);
    });

    testWidgets('weight chip uses up/flat arrows per trend', (tester) async {
      final admin = _FakeAdminRepo();
      when(() => admin.listTrainees()).thenAnswer((_) async => [
            const TraineeRecord(
                id: 't1', name: 'A', status: 'active', isRecurring: false,
                lastWeightKg: 70, weightTrend14d: 'up'),
            const TraineeRecord(
                id: 't2', name: 'B', status: 'active', isRecurring: false,
                lastWeightKg: 70, weightTrend14d: 'flat'),
          ]);

      await tester.pumpWidget(_harness(admin: admin));
      await tester.pumpAndSettle();

      expect(
        find.descendant(
            of: find.byKey(const Key('weight-chip-t1')),
            matching: find.byIcon(Icons.north_east)),
        findsOneWidget,
      );
      expect(
        find.descendant(
            of: find.byKey(const Key('weight-chip-t2')),
            matching: find.byIcon(Icons.east)),
        findsOneWidget,
      );
    });

    testWidgets('chips hidden when aggregates are null', (tester) async {
      final admin = _FakeAdminRepo();
      when(() => admin.listTrainees()).thenAnswer((_) async => [
            const TraineeRecord(
                id: 't1', name: 'יעל', status: 'active', isRecurring: false),
          ]);

      await tester.pumpWidget(_harness(admin: admin));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('weight-chip-t1')), findsNothing);
      expect(find.byKey(const Key('attendance-chip-t1')), findsNothing);
    });

    testWidgets('invite form submits email + name', (tester) async {
      final admin = _FakeAdminRepo();
      when(() => admin.listTrainees()).thenAnswer((_) async => []);
      when(() => admin.inviteTrainee(
            email: any(named: 'email'),
            name: any(named: 'name'),
            isRecurring: any(named: 'isRecurring'),
            preferredDay: any(named: 'preferredDay'),
            preferredTime: any(named: 'preferredTime'),
          )).thenAnswer((_) async {});

      await tester.pumpWidget(_harness(admin: admin));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('invite-trainee-button')));
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('invite-email')), 'new@example.com');
      await tester.enterText(find.byKey(const Key('invite-name')), 'מתאמן חדש');
      await tester.tap(find.byKey(const Key('invite-submit')));
      await tester.pumpAndSettle();

      verify(() => admin.inviteTrainee(
            email: 'new@example.com',
            name: 'מתאמן חדש',
            isRecurring: false,
            preferredDay: null,
            preferredTime: null,
          )).called(1);
    });

    testWidgets('deactivate confirm → updateTrainee with isActive:false',
        (tester) async {
      final admin = _FakeAdminRepo();
      when(() => admin.listTrainees()).thenAnswer((_) async => [
            const TraineeRecord(
              id: 't1',
              name: 'יעל',
              email: 'yael@example.com',
              status: 'active',
              isRecurring: false,
            ),
          ]);
      when(() => admin.updateTrainee(any(), any())).thenAnswer((_) async {});

      await tester.pumpWidget(_harness(admin: admin));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('deactivate-t1')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('כן, השבת'));
      await tester.pumpAndSettle();

      verify(() => admin.updateTrainee('t1', {'isActive': false})).called(1);
    });
  });
}
