import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:velofit/features/bookings/booking.dart';
import 'package:velofit/features/bookings/booking_repository.dart';
import 'package:velofit/features/slots/home_screen.dart';
import 'package:velofit/features/slots/slot.dart';
import 'package:velofit/features/slots/slot_repository.dart';

class _FakeSlotRepo extends Mock implements SlotRepository {}

class _FakeBookingRepo extends Mock implements BookingRepository {}

Widget _harness({
  required SlotRepository repo,
  BookingRepository? bookings,
  DateTime? now,
}) =>
    ProviderScope(
      overrides: [
        slotRepositoryProvider.overrideWithValue(repo),
        if (bookings != null) bookingRepositoryProvider.overrideWithValue(bookings),
      ],
      child: MaterialApp(
        builder: (context, child) => Directionality(
          textDirection: TextDirection.rtl,
          child: child ?? const SizedBox.shrink(),
        ),
        home: HomeScreen(now: now ?? DateTime(2026, 5, 20)), // Wed 2026-05-20
      ),
    );

const _aSlot = Slot(
  id: 's1',
  date: '2026-05-20',
  startTime: '10:00',
  capacity: 2,
  currentBookings: 0,
  remainingCapacity: 2,
  lockoutOverride: false,
  lockedOut: false,
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

    testWidgets('reschedule failure surfaces server error and keeps booking',
        (tester) async {
      final repo = _FakeSlotRepo();
      final bookings = _FakeBookingRepo();
      when(() => repo.fetchSlots(any())).thenAnswer((_) async => [_aSlot]);
      when(() => bookings.fetchMyBookings()).thenAnswer((_) async => const MyBookingsView(
            remainingEdits: 3,
            bookings: [
              Booking(
                id: 'b1',
                slotId: 'other-slot',
                traineeId: 't1',
                status: 'confirmed',
                slotDate: '2026-05-20',
                slotStartTime: '11:00',
              ),
            ],
          ));
      when(() => bookings.reschedule(any(), any())).thenThrow(
        const BookingFailure('השעה אינה זמינה', statusCode: 409),
      );

      await tester.pumpWidget(_harness(repo: repo, bookings: bookings));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('reschedule-booking-b1')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('picker-slot-2026-05-17-10:00')));
      await tester.pumpAndSettle();

      expect(find.text('השעה אינה זמינה'), findsOneWidget);
      // Original booking still rendered:
      expect(find.byKey(const Key('my-booking-b1')), findsOneWidget);
    });

    testWidgets('picking a slot in picker fires reschedule()', (tester) async {
      final repo = _FakeSlotRepo();
      final bookings = _FakeBookingRepo();
      when(() => repo.fetchSlots(any())).thenAnswer((_) async => [_aSlot]);
      when(() => bookings.fetchMyBookings()).thenAnswer((_) async => const MyBookingsView(
            remainingEdits: 3,
            bookings: [
              Booking(
                id: 'b1',
                slotId: 'other-slot',
                traineeId: 't1',
                status: 'confirmed',
                slotDate: '2026-05-20',
                slotStartTime: '11:00',
              ),
            ],
          ));
      when(() => bookings.reschedule(any(), any())).thenAnswer((_) async =>
          const Booking(
            id: 'b1',
            slotId: 's1',
            traineeId: 't1',
            status: 'confirmed',
          ));

      await tester.pumpWidget(_harness(repo: repo, bookings: bookings));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('reschedule-booking-b1')));
      await tester.pumpAndSettle();

      // Tap any picker slot (they all point to s1 since the fake returns
      // the same slot for every day).
      await tester.tap(find.byKey(const Key('picker-slot-2026-05-17-10:00')));
      await tester.pumpAndSettle();

      verify(() => bookings.reschedule('b1', 's1')).called(1);
      expect(find.text('האימון הועבר'), findsOneWidget);
    });

    testWidgets('reschedule button opens slot picker', (tester) async {
      final repo = _FakeSlotRepo();
      final bookings = _FakeBookingRepo();
      when(() => repo.fetchSlots(any())).thenAnswer((_) async => [_aSlot]);
      when(() => bookings.fetchMyBookings()).thenAnswer((_) async => const MyBookingsView(
            remainingEdits: 3,
            bookings: [
              Booking(
                id: 'b1',
                slotId: 'other-slot',
                traineeId: 't1',
                status: 'confirmed',
                slotDate: '2026-05-20',
                slotStartTime: '11:00',
              ),
            ],
          ));

      await tester.pumpWidget(_harness(repo: repo, bookings: bookings));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('reschedule-booking-b1')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('reschedule-picker')), findsOneWidget);
      expect(find.text('בחר שעה חדשה'), findsOneWidget);
    });

    testWidgets('confirm cancel fires cancel() and shows success snackbar',
        (tester) async {
      final repo = _FakeSlotRepo();
      final bookings = _FakeBookingRepo();
      when(() => repo.fetchSlots(any())).thenAnswer((_) async => []);
      when(() => bookings.fetchMyBookings()).thenAnswer((_) async => const MyBookingsView(
            remainingEdits: 3,
            bookings: [
              Booking(
                id: 'b1',
                slotId: 's1',
                traineeId: 't1',
                status: 'confirmed',
                slotDate: '2026-05-20',
                slotStartTime: '10:00',
              ),
            ],
          ));
      when(() => bookings.cancel(any())).thenAnswer((_) async {});

      await tester.pumpWidget(_harness(repo: repo, bookings: bookings));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('cancel-booking-b1')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('כן, בטל'));
      await tester.pumpAndSettle();

      verify(() => bookings.cancel('b1')).called(1);
      expect(find.text('האימון בוטל'), findsOneWidget);
    });

    testWidgets('cancel button on a booking opens Hebrew confirm dialog',
        (tester) async {
      final repo = _FakeSlotRepo();
      final bookings = _FakeBookingRepo();
      when(() => repo.fetchSlots(any())).thenAnswer((_) async => []);
      when(() => bookings.fetchMyBookings()).thenAnswer((_) async => const MyBookingsView(
            remainingEdits: 3,
            bookings: [
              Booking(
                id: 'b1',
                slotId: 's1',
                traineeId: 't1',
                status: 'confirmed',
                slotDate: '2026-05-20',
                slotStartTime: '10:00',
              ),
            ],
          ));

      await tester.pumpWidget(_harness(repo: repo, bookings: bookings));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('cancel-booking-b1')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('cancel-confirm-dialog')), findsOneWidget);
      expect(find.text('לבטל את האימון בשעה 10:00?'), findsOneWidget);
    });

    testWidgets('edit counter banner shows X/3 from server', (tester) async {
      final repo = _FakeSlotRepo();
      final bookings = _FakeBookingRepo();
      when(() => repo.fetchSlots(any())).thenAnswer((_) async => []);
      when(() => bookings.fetchMyBookings()).thenAnswer((_) async =>
          const MyBookingsView(bookings: [], remainingEdits: 2));

      await tester.pumpWidget(_harness(repo: repo, bookings: bookings));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('edit-counter-banner')), findsOneWidget);
      expect(find.text('עריכות שנותרו השבוע: 2/3'), findsOneWidget);
    });

    testWidgets('booking failure surfaces server error message in snackbar',
        (tester) async {
      final repo = _FakeSlotRepo();
      final bookings = _FakeBookingRepo();
      when(() => repo.fetchSlots(any())).thenAnswer((_) async => [_aSlot]);
      when(() => bookings.fetchMyBookings()).thenAnswer((_) async => const MyBookingsView(bookings: [], remainingEdits: 3));
      when(() => bookings.book(any())).thenThrow(
        const BookingFailure('הגעת למכסת 2 אימונים בשבוע', statusCode: 409),
      );

      await tester.pumpWidget(_harness(repo: repo, bookings: bookings));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('slot-10:00')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('אישור'));
      await tester.pumpAndSettle();

      expect(find.text('הגעת למכסת 2 אימונים בשבוע'), findsOneWidget);
    });

    testWidgets('optimistic-lock failure shows slot just filled + re-fetches',
        (tester) async {
      final repo = _FakeSlotRepo();
      final bookings = _FakeBookingRepo();
      when(() => repo.fetchSlots(any())).thenAnswer((_) async => [_aSlot]);
      when(() => bookings.fetchMyBookings()).thenAnswer((_) async => const MyBookingsView(bookings: [], remainingEdits: 3));
      when(() => bookings.book(any())).thenThrow(
        const BookingFailure('השעה התמלאה בדיוק עכשיו', statusCode: 409),
      );

      await tester.pumpWidget(_harness(repo: repo, bookings: bookings));
      await tester.pumpAndSettle();
      // initial fetch
      verify(() => repo.fetchSlots(any())).called(1);

      await tester.tap(find.byKey(const Key('slot-10:00')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('אישור'));
      await tester.pumpAndSettle();

      expect(find.text('השעה התמלאה בדיוק עכשיו'), findsOneWidget);
      // a refresh was triggered after the failure
      verify(() => repo.fetchSlots(any())).called(1);
    });

    testWidgets('already-booked slot shows מוזמן and is not tappable',
        (tester) async {
      final repo = _FakeSlotRepo();
      final bookings = _FakeBookingRepo();
      when(() => repo.fetchSlots(any())).thenAnswer((_) async => [_aSlot]);
      when(() => bookings.fetchMyBookings()).thenAnswer((_) async => const MyBookingsView(remainingEdits: 3, bookings: [
            Booking(
              id: 'b1',
              slotId: 's1', // matches _aSlot.id
              traineeId: 't1',
              status: 'confirmed',
              slotDate: '2026-05-20',
              slotStartTime: '10:00',
            ),
          ]));

      await tester.pumpWidget(_harness(repo: repo, bookings: bookings));
      await tester.pumpAndSettle();

      expect(find.descendant(
        of: find.byKey(const Key('slot-10:00')),
        matching: find.text('מוזמן'),
      ), findsOneWidget);

      // Tapping the booked slot should NOT open the dialog.
      await tester.tap(find.byKey(const Key('slot-10:00')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('booking-confirm-dialog')), findsNothing);
    });

    testWidgets('My Bookings section lists this week\'s bookings sorted by date',
        (tester) async {
      final repo = _FakeSlotRepo();
      final bookings = _FakeBookingRepo();
      when(() => repo.fetchSlots(any())).thenAnswer((_) async => []);
      when(() => bookings.fetchMyBookings()).thenAnswer((_) async => const MyBookingsView(remainingEdits: 3, bookings: [
            Booking(
              id: 'b-later',
              slotId: 's-later',
              traineeId: 't1',
              status: 'confirmed',
              slotDate: '2026-05-21',
              slotStartTime: '09:00',
            ),
            Booking(
              id: 'b-earlier',
              slotId: 's-earlier',
              traineeId: 't1',
              status: 'confirmed',
              slotDate: '2026-05-18',
              slotStartTime: '14:00',
            ),
          ]));

      await tester.pumpWidget(_harness(repo: repo, bookings: bookings));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('my-bookings-section')), findsOneWidget);
      expect(find.text('האימונים שלי'), findsOneWidget);

      // Earlier (2026-05-18) should be listed before later (2026-05-21).
      final firstY = tester.getTopLeft(find.byKey(const Key('my-booking-b-earlier'))).dy;
      final secondY = tester.getTopLeft(find.byKey(const Key('my-booking-b-later'))).dy;
      expect(firstY, lessThan(secondY));
    });

    testWidgets('confirm in dialog fires book() and shows success snackbar',
        (tester) async {
      final repo = _FakeSlotRepo();
      final bookings = _FakeBookingRepo();
      when(() => repo.fetchSlots(any())).thenAnswer((_) async => [_aSlot]);
      when(() => bookings.fetchMyBookings()).thenAnswer((_) async => const MyBookingsView(bookings: [], remainingEdits: 3));
      when(() => bookings.book(any())).thenAnswer((_) async => const Booking(
            id: 'b1',
            slotId: 's1',
            traineeId: 't1',
            status: 'confirmed',
          ));

      await tester.pumpWidget(_harness(repo: repo, bookings: bookings));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('slot-10:00')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('אישור'));
      await tester.pumpAndSettle();

      verify(() => bookings.book('s1')).called(1);
      expect(find.text('האימון נקבע'), findsOneWidget);
    });

    testWidgets('tapping a slot opens Hebrew confirm dialog', (tester) async {
      final repo = _FakeSlotRepo();
      final bookings = _FakeBookingRepo();
      when(() => repo.fetchSlots(any())).thenAnswer((_) async => [_aSlot]);
      when(() => bookings.fetchMyBookings()).thenAnswer((_) async => const MyBookingsView(bookings: [], remainingEdits: 3));

      await tester.pumpWidget(_harness(repo: repo, bookings: bookings));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('slot-10:00')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('booking-confirm-dialog')), findsOneWidget);
      expect(find.text('לקבוע אימון בשעה 10:00?'), findsOneWidget);
      expect(find.text('אישור'), findsOneWidget);
      expect(find.text('ביטול'), findsOneWidget);
    });
  });
}
