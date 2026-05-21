import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:velofit/features/coach/change_requests_repository.dart';
import 'package:velofit/features/coach/change_requests_screen.dart';

class _FakeRepo extends Mock implements ChangeRequestsRepository {}

Widget _harness(ChangeRequestsRepository repo) => ProviderScope(
      overrides: [changeRequestsRepositoryProvider.overrideWithValue(repo)],
      child: MaterialApp(
        builder: (context, child) => Directionality(
          textDirection: TextDirection.rtl,
          child: child ?? const SizedBox.shrink(),
        ),
        home: const ChangeRequestsScreen(),
      ),
    );

void main() {
  group('ChangeRequestsScreen', () {
    testWidgets('shows empty placeholder', (tester) async {
      final repo = _FakeRepo();
      when(() => repo.fetch()).thenAnswer((_) async => []);

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('change-requests-empty')), findsOneWidget);
      expect(find.text('אין בקשות שינוי פתוחות'), findsOneWidget);
    });

    testWidgets('renders cancel + reschedule requests', (tester) async {
      final repo = _FakeRepo();
      when(() => repo.fetch()).thenAnswer((_) async => const [
            ChangeRequest(
              id: 'r1',
              requestedAt: '2026-04-08T10:00:00Z',
              reason: 'חולה',
              traineeId: 't1',
              traineeName: 'יעל',
              fromSlotStartsAt: '2026-04-09T07:00:00Z',
              toSlotStartsAt: null,
            ),
            ChangeRequest(
              id: 'r2',
              requestedAt: '2026-04-08T11:00:00Z',
              reason: '',
              traineeId: 't2',
              traineeName: 'דנה',
              fromSlotStartsAt: '2026-04-10T07:00:00Z',
              toSlotStartsAt: '2026-04-11T07:00:00Z',
            ),
          ]);

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('cr-tile-r1')), findsOneWidget);
      expect(find.byKey(const Key('cr-tile-r2')), findsOneWidget);
      expect(find.text('יעל'), findsOneWidget);
      expect(find.text('דנה'), findsOneWidget);
      expect(find.text('חולה'), findsOneWidget);
    });

    testWidgets('tap approve → repo.decide(approve) + invalidate', (tester) async {
      final repo = _FakeRepo();
      var fetchCount = 0;
      when(() => repo.fetch()).thenAnswer((_) async {
        fetchCount++;
        if (fetchCount == 1) {
          return const [
            ChangeRequest(
              id: 'r1',
              requestedAt: '2026-04-08T10:00:00Z',
              reason: '',
              traineeId: 't1',
              traineeName: 'יעל',
              fromSlotStartsAt: '2026-04-09T07:00:00Z',
              toSlotStartsAt: null,
            ),
          ];
        }
        return [];
      });
      when(() => repo.decide(any(),
          decision: any(named: 'decision'),
          note: any(named: 'note'))).thenAnswer((_) async {});

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('approve-r1')));
      await tester.pumpAndSettle();

      verify(() => repo.decide('r1', decision: 'approve')).called(1);
      expect(find.text('אושר'), findsOneWidget);
    });

    testWidgets('tap reject → repo.decide(reject)', (tester) async {
      final repo = _FakeRepo();
      when(() => repo.fetch()).thenAnswer((_) async => const [
            ChangeRequest(
              id: 'r1',
              requestedAt: '2026-04-08T10:00:00Z',
              reason: '',
              traineeId: 't1',
              traineeName: 'יעל',
              fromSlotStartsAt: '2026-04-09T07:00:00Z',
              toSlotStartsAt: null,
            ),
          ]);
      when(() => repo.decide(any(),
          decision: any(named: 'decision'),
          note: any(named: 'note'))).thenAnswer((_) async {});

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('reject-r1')));
      await tester.pumpAndSettle();

      verify(() => repo.decide('r1', decision: 'reject')).called(1);
      expect(find.text('נדחה'), findsOneWidget);
    });

    testWidgets('error path shows error widget', (tester) async {
      final repo = _FakeRepo();
      when(() => repo.fetch()).thenThrow(Exception('boom'));

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('change-requests-error')), findsOneWidget);
    });
  });
}
