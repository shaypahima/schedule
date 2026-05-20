import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:velofit/features/coach/admin_repository.dart';
import 'package:velofit/features/coach/coach_week_screen.dart';
import 'package:velofit/features/slots/slot.dart';
import 'package:velofit/features/slots/slot_repository.dart';

class _FakeSlotRepo extends Mock implements SlotRepository {}

class _FakeAdminRepo extends Mock implements AdminRepository {}

Widget _harness({
  required SlotRepository slots,
  required AdminRepository admin,
}) =>
    ProviderScope(
      overrides: [
        slotRepositoryProvider.overrideWithValue(slots),
        adminRepositoryProvider.overrideWithValue(admin),
      ],
      child: MaterialApp(
        builder: (context, child) => Directionality(
          textDirection: TextDirection.rtl,
          child: child ?? const SizedBox.shrink(),
        ),
        home: CoachWeekScreen(now: DateTime(2026, 5, 20)),
      ),
    );

void main() {
  setUpAll(() {
    registerFallbackValue('');
  });

  group('Coach slot overrides', () {
    testWidgets('long-press opens overrides sheet', (tester) async {
      final slots = _FakeSlotRepo();
      final admin = _FakeAdminRepo();
      when(() => slots.fetchSlots(any())).thenAnswer((_) async => [
            const Slot(
              id: 's1',
              date: '2026-05-20',
              startTime: '10:00',
              capacity: 2,
              currentBookings: 0,
              remainingCapacity: 2,
              lockoutOverride: false,
              lockedOut: false,
            ),
          ]);
      when(() => admin.fetchBookings(date: any(named: 'date'))).thenAnswer((_) async => []);

      await tester.pumpWidget(_harness(slots: slots, admin: admin));
      await tester.pumpAndSettle();

      await tester.longPress(find.byKey(const Key('coach-slot-10:00')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('slot-overrides-sheet')), findsOneWidget);
      expect(find.byKey(const Key('override-capacity-3')), findsOneWidget);
      expect(find.byKey(const Key('override-lockout')), findsOneWidget);
    });

    testWidgets('toggling capacity → updateSlot capacity:3', (tester) async {
      final slots = _FakeSlotRepo();
      final admin = _FakeAdminRepo();
      when(() => slots.fetchSlots(any())).thenAnswer((_) async => [
            const Slot(
              id: 's1',
              date: '2026-05-20',
              startTime: '10:00',
              capacity: 2,
              currentBookings: 0,
              remainingCapacity: 2,
              lockoutOverride: false,
              lockedOut: false,
            ),
          ]);
      when(() => admin.fetchBookings(date: any(named: 'date'))).thenAnswer((_) async => []);
      when(() => admin.updateSlot(
            slotId: any(named: 'slotId'),
            date: any(named: 'date'),
            startTime: any(named: 'startTime'),
            capacity: any(named: 'capacity'),
            lockoutOverride: any(named: 'lockoutOverride'),
          )).thenAnswer((_) async {});

      await tester.pumpWidget(_harness(slots: slots, admin: admin));
      await tester.pumpAndSettle();

      await tester.longPress(find.byKey(const Key('coach-slot-10:00')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('override-capacity-3')));
      await tester.pumpAndSettle();

      verify(() => admin.updateSlot(
            slotId: 's1',
            date: '2026-05-20',
            startTime: '10:00',
            capacity: 3,
          )).called(1);
    });

    testWidgets('reset edits button → resetEdits called', (tester) async {
      final slots = _FakeSlotRepo();
      final admin = _FakeAdminRepo();
      when(() => slots.fetchSlots(any())).thenAnswer((_) async => [
            const Slot(
              id: 's1',
              date: '2026-05-20',
              startTime: '10:00',
              capacity: 2,
              currentBookings: 1,
              remainingCapacity: 1,
              lockoutOverride: false,
              lockedOut: false,
            ),
          ]);
      when(() => admin.fetchBookings(date: any(named: 'date'))).thenAnswer((_) async => [
            const AdminBooking(
              id: 'b1',
              slotId: 's1',
              traineeId: 't1',
              traineeName: 'יעל',
              slotDate: '2026-05-20',
              startTime: '10:00',
            ),
          ]);
      when(() => admin.resetEdits(any())).thenAnswer((_) async {});

      await tester.pumpWidget(_harness(slots: slots, admin: admin));
      await tester.pumpAndSettle();

      await tester.longPress(find.byKey(const Key('coach-slot-10:00')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('reset-edits-t1')));
      await tester.pumpAndSettle();

      verify(() => admin.resetEdits('t1')).called(1);
    });
  });
}
