import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:velofit/features/history/history_repository.dart';
import 'package:velofit/features/history/history_screen.dart';

class _FakeRepo extends Mock implements HistoryRepository {}

Widget _harness(HistoryRepository repo) => ProviderScope(
      overrides: [historyRepositoryProvider.overrideWithValue(repo)],
      child: MaterialApp(
        builder: (context, child) => Directionality(
          textDirection: TextDirection.rtl,
          child: child ?? const SizedBox.shrink(),
        ),
        home: const HistoryScreen(),
      ),
    );

void main() {
  group('HistoryScreen', () {
    testWidgets('empty state shows Hebrew placeholder', (tester) async {
      final repo = _FakeRepo();
      when(() => repo.fetch()).thenAnswer((_) async => []);

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('history-empty')), findsOneWidget);
      expect(find.text('עדיין אין היסטוריית אימונים'), findsOneWidget);
    });

    testWidgets('groups entries by month with Hebrew month names', (tester) async {
      final repo = _FakeRepo();
      when(() => repo.fetch()).thenAnswer((_) async => const [
            HistoryEntry(
              bookingId: 'b1',
              slotId: 's1',
              date: '2026-04-10',
              startTime: '10:00',
              status: 'confirmed',
              startsAt: '2026-04-10T07:00:00.000Z',
              isPast: true,
            ),
            HistoryEntry(
              bookingId: 'b2',
              slotId: 's2',
              date: '2026-03-15',
              startTime: '11:00',
              status: 'no_show',
              startsAt: '2026-03-15T08:00:00.000Z',
              isPast: true,
            ),
          ]);

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      expect(find.text('אפריל 2026'), findsOneWidget);
      expect(find.text('מרץ 2026'), findsOneWidget);
    });

    testWidgets('renders status labels for confirmed/cancelled/no_show', (tester) async {
      final repo = _FakeRepo();
      when(() => repo.fetch()).thenAnswer((_) async => const [
            HistoryEntry(
              bookingId: 'b1',
              slotId: 's1',
              date: '2026-04-10',
              startTime: '10:00',
              status: 'confirmed',
              startsAt: '2026-04-10T07:00:00.000Z',
              isPast: true,
            ),
            HistoryEntry(
              bookingId: 'b2',
              slotId: 's2',
              date: '2026-04-12',
              startTime: '11:00',
              status: 'cancelled',
              startsAt: '2026-04-12T08:00:00.000Z',
              isPast: true,
            ),
            HistoryEntry(
              bookingId: 'b3',
              slotId: 's3',
              date: '2026-04-14',
              startTime: '12:00',
              status: 'no_show',
              startsAt: '2026-04-14T09:00:00.000Z',
              isPast: true,
            ),
          ]);

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      expect(find.text('הושלם'), findsOneWidget);
      expect(find.text('בוטל'), findsOneWidget);
      expect(find.text('לא הגיע'), findsOneWidget);
    });

    testWidgets('shows error when fetch fails', (tester) async {
      final repo = _FakeRepo();
      when(() => repo.fetch()).thenThrow(Exception('boom'));

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('history-error')), findsOneWidget);
    });
  });
}
