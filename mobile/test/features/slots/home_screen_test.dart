import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:velofit/features/slots/home_screen.dart';
import 'package:velofit/features/slots/slot.dart';
import 'package:velofit/features/slots/slot_repository.dart';

class _FakeSlotRepo extends Mock implements SlotRepository {}

Widget _harness({
  required SlotRepository repo,
  DateTime? now,
}) =>
    ProviderScope(
      overrides: [slotRepositoryProvider.overrideWithValue(repo)],
      child: MaterialApp(
        builder: (context, child) => Directionality(
          textDirection: TextDirection.rtl,
          child: child ?? const SizedBox.shrink(),
        ),
        home: HomeScreen(now: now ?? DateTime(2026, 5, 20)), // Wed 2026-05-20
      ),
    );

void main() {
  group('HomeScreen', () {
    testWidgets('day picker renders Sun–Fri under RTL', (tester) async {
      final repo = _FakeSlotRepo();
      when(() => repo.fetchSlots(any())).thenAnswer((_) async => []);

      await tester.pumpWidget(_harness(repo: repo));

      for (final label in ['א', 'ב', 'ג', 'ד', 'ה', 'ו']) {
        expect(find.text(label), findsOneWidget);
      }
      final dir = Directionality.of(tester.element(find.byType(HomeScreen)));
      expect(dir, TextDirection.rtl);
    });

    testWidgets('tapping Sunday tab fetches slots for that date',
        (tester) async {
      final repo = _FakeSlotRepo();
      when(() => repo.fetchSlots(any())).thenAnswer((_) async => []);

      // 2026-05-20 is a Wednesday → initial fetch is for 2026-05-20.
      await tester.pumpWidget(_harness(repo: repo));
      await tester.pumpAndSettle();
      verify(() => repo.fetchSlots('2026-05-20')).called(1);

      // Tap day index 0 → Sunday of the same week = 2026-05-17.
      await tester.tap(find.byKey(const Key('day-chip-0')));
      await tester.pumpAndSettle();

      verify(() => repo.fetchSlots('2026-05-17')).called(1);
    });

    testWidgets('slot list shows 24h time and Hebrew capacity labels',
        (tester) async {
      final repo = _FakeSlotRepo();
      when(() => repo.fetchSlots(any())).thenAnswer((_) async => const [
            Slot(
              id: 's1',
              date: '2026-05-20',
              startTime: '10:00',
              capacity: 2,
              currentBookings: 1,
              remainingCapacity: 1,
              lockoutOverride: false,
              lockedOut: false,
            ),
            Slot(
              id: 's2',
              date: '2026-05-20',
              startTime: '11:00',
              capacity: 2,
              currentBookings: 2,
              remainingCapacity: 0,
              lockoutOverride: false,
              lockedOut: false,
            ),
          ]);

      await tester.pumpWidget(_harness(repo: repo));
      await tester.pumpAndSettle();

      expect(find.text('10:00'), findsOneWidget);
      expect(find.text('11:00'), findsOneWidget);
      expect(find.text('נשאר מקום 1'), findsOneWidget);
      expect(find.text('מלא'), findsOneWidget);
    });

    testWidgets('empty day shows Hebrew placeholder', (tester) async {
      final repo = _FakeSlotRepo();
      when(() => repo.fetchSlots(any())).thenAnswer((_) async => []);

      await tester.pumpWidget(_harness(repo: repo));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('slots-empty')), findsOneWidget);
      expect(find.text('אין שעות פנויות'), findsOneWidget);
    });

    testWidgets('shows spinner while loading', (tester) async {
      final repo = _FakeSlotRepo();
      final completer = Completer<List<Slot>>();
      when(() => repo.fetchSlots(any())).thenAnswer((_) => completer.future);

      await tester.pumpWidget(_harness(repo: repo));
      await tester.pump(); // initial frame

      expect(find.byKey(const Key('slots-loading')), findsOneWidget);

      completer.complete(const []);
      await tester.pumpAndSettle();
    });

    testWidgets('shows Hebrew error when fetch throws', (tester) async {
      final repo = _FakeSlotRepo();
      when(() => repo.fetchSlots(any())).thenThrow(Exception('boom'));

      await tester.pumpWidget(_harness(repo: repo));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('slots-error')), findsOneWidget);
      expect(find.text('שגיאה בטעינת השעות'), findsOneWidget);
    });
  });
}
