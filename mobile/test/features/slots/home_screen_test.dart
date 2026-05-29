import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:velofit/features/bookings/booking.dart';
import 'package:velofit/features/bookings/booking_repository.dart';
import 'package:velofit/features/coach/coach_info.dart';
import 'package:velofit/features/coach/coach_info_repository.dart';
import 'package:velofit/features/slots/home_screen.dart';
import 'package:velofit/features/slots/slot.dart';
import 'package:velofit/features/slots/slot_repository.dart';
import 'package:velofit/utils/url_opener.dart';

class _FakeSlotRepo extends Mock implements SlotRepository {}

class _FakeBookingRepo extends Mock implements BookingRepository {}

class _FakeCoachInfoRepo extends Mock implements CoachInfoRepository {}

class _CapturingUrlOpener implements UrlOpener {
  final List<Uri> opened = [];
  @override
  Future<void> open(Uri url) async => opened.add(url);
}

Widget _harnessWithCoach({
  required SlotRepository repo,
  BookingRepository? bookings,
  CoachInfo? coach,
  UrlOpener? urlOpener,
  DateTime? now,
}) {
  final coachRepo = _FakeCoachInfoRepo();
  when(() => coachRepo.fetch()).thenAnswer((_) async => coach);
  return ProviderScope(
    overrides: [
      slotRepositoryProvider.overrideWithValue(repo),
      if (bookings != null) bookingRepositoryProvider.overrideWithValue(bookings),
      coachInfoRepositoryProvider.overrideWithValue(coachRepo),
      if (urlOpener != null) urlOpenerProvider.overrideWithValue(urlOpener),
    ],
    child: MaterialApp(
      builder: (context, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: child ?? const SizedBox.shrink(),
      ),
      home: HomeScreen(now: now ?? DateTime(2026, 5, 20)),
    ),
  );
}

Widget _harness({
  required SlotRepository repo,
  BookingRepository? bookings,
  DateTime? now,
}) {
  final coachRepo = _FakeCoachInfoRepo();
  when(() => coachRepo.fetch()).thenAnswer((_) async => null);
  return ProviderScope(
    overrides: [
      slotRepositoryProvider.overrideWithValue(repo),
      if (bookings != null) bookingRepositoryProvider.overrideWithValue(bookings),
      coachInfoRepositoryProvider.overrideWithValue(coachRepo),
    ],
    child: MaterialApp(
      builder: (context, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: child ?? const SizedBox.shrink(),
      ),
      home: HomeScreen(now: now ?? DateTime(2026, 5, 20)), // Wed 2026-05-20
    ),
  );
}

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

    testWidgets('empty day shows icon + headline + helper (R4)', (tester) async {
      final repo = _FakeSlotRepo();
      when(() => repo.fetchSlots(any())).thenAnswer((_) async => []);

      await tester.pumpWidget(_harness(repo: repo));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('slots-empty')), findsOneWidget);
      expect(find.text('אין מועדים פנויים בתאריך זה'), findsOneWidget);
      // Helper directs user back to day picker (no separate button needed).
      expect(find.text('בחר יום אחר מהשורה למעלה'), findsOneWidget);
      // Icon present inside the empty state.
      expect(
        find.descendant(
          of: find.byKey(const Key('slots-empty')),
          matching: find.byIcon(Icons.event_busy_outlined),
        ),
        findsOneWidget,
      );
    });

    testWidgets('loading state renders skeleton (not bare spinner) — R3',
        (tester) async {
      final repo = _FakeSlotRepo();
      final completer = Completer<List<Slot>>();
      when(() => repo.fetchSlots(any())).thenAnswer((_) => completer.future);

      await tester.pumpWidget(_harness(repo: repo));
      await tester.pump(); // initial frame

      expect(find.byKey(const Key('slots-loading-skeleton')), findsOneWidget);
      // Skeleton replaces the bare CircularProgressIndicator entirely.
      expect(
        find.descendant(
          of: find.byKey(const Key('slots-loading-skeleton')),
          matching: find.byType(CircularProgressIndicator),
        ),
        findsNothing,
      );

      completer.complete(const []);
      await tester.pumpAndSettle();
    });

    testWidgets('shows Hebrew error when fetch throws', (tester) async {
      final repo = _FakeSlotRepo();
      when(() => repo.fetchSlots(any())).thenThrow(Exception('boom'));

      await tester.pumpWidget(_harness(repo: repo));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('slots-error')), findsOneWidget);
      expect(find.text('שגיאה בטעינת המועדים'), findsOneWidget);
    });

    testWidgets('whatsapp tap opens wa.me URL with Hebrew prefilled message',
        (tester) async {
      final repo = _FakeSlotRepo();
      final bookings = _FakeBookingRepo();
      final opener = _CapturingUrlOpener();
      when(() => repo.fetchSlots(any())).thenAnswer((_) async => []);
      when(() => bookings.fetchMyBookings()).thenAnswer((_) async => const MyBookingsView(
            remainingEdits: 3,
            bookings: [
              Booking(
                id: 'b-locked',
                slotId: 's-locked',
                traineeId: 't1',
                status: 'confirmed',
                slotDate: '2026-05-20',
                slotStartTime: '10:00',
                isLocked: true,
              ),
            ],
          ));

      await tester.pumpWidget(_harnessWithCoach(
        repo: repo,
        bookings: bookings,
        coach: const CoachInfo(name: 'דני', contactPhone: '+972501234567'),
        urlOpener: opener,
      ));
      await tester.pumpAndSettle();

      await tester.ensureVisible(find.byKey(const Key('contact-coach-whatsapp')));
      await tester.tap(find.byKey(const Key('contact-coach-whatsapp')));
      await tester.pumpAndSettle();

      expect(opener.opened, hasLength(1));
      expect(opener.opened.first.scheme, 'https');
      expect(opener.opened.first.host, 'wa.me');
      expect(opener.opened.first.path, '/972501234567');
      expect(
        opener.opened.first.queryParameters['text'],
        'היי, אני נעול מהאימון ב-10:00, אפשר חריג?',
      );
    });

    testWidgets('call tap opens tel: URL', (tester) async {
      final repo = _FakeSlotRepo();
      final bookings = _FakeBookingRepo();
      final opener = _CapturingUrlOpener();
      when(() => repo.fetchSlots(any())).thenAnswer((_) async => []);
      when(() => bookings.fetchMyBookings()).thenAnswer((_) async => const MyBookingsView(
            remainingEdits: 3,
            bookings: [
              Booking(
                id: 'b-locked',
                slotId: 's-locked',
                traineeId: 't1',
                status: 'confirmed',
                slotDate: '2026-05-20',
                slotStartTime: '10:00',
                isLocked: true,
              ),
            ],
          ));

      await tester.pumpWidget(_harnessWithCoach(
        repo: repo,
        bookings: bookings,
        coach: const CoachInfo(name: 'דני', contactPhone: '+972501234567'),
        urlOpener: opener,
      ));
      await tester.pumpAndSettle();

      await tester.ensureVisible(find.byKey(const Key('contact-coach-call')));
      await tester.tap(find.byKey(const Key('contact-coach-call')));
      await tester.pumpAndSettle();

      expect(opener.opened, hasLength(1));
      expect(opener.opened.first.toString(), 'tel:+972501234567');
    });

    testWidgets('null contact phone shows Hebrew missing-contact text',
        (tester) async {
      final repo = _FakeSlotRepo();
      final bookings = _FakeBookingRepo();
      when(() => repo.fetchSlots(any())).thenAnswer((_) async => []);
      when(() => bookings.fetchMyBookings()).thenAnswer((_) async => const MyBookingsView(
            remainingEdits: 3,
            bookings: [
              Booking(
                id: 'b-locked',
                slotId: 's-locked',
                traineeId: 't1',
                status: 'confirmed',
                slotDate: '2026-05-20',
                slotStartTime: '10:00',
                isLocked: true,
              ),
            ],
          ));

      await tester.pumpWidget(_harnessWithCoach(
        repo: repo,
        bookings: bookings,
        coach: const CoachInfo(name: 'דני', contactPhone: null),
      ));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('contact-coach-missing')), findsOneWidget);
      expect(find.text('פרטי קשר של המאמן חסרים — פנה למאמן'), findsOneWidget);
    });

    testWidgets('locked booking shows Contact Coach card with WhatsApp + Call',
        (tester) async {
      final repo = _FakeSlotRepo();
      final bookings = _FakeBookingRepo();
      when(() => repo.fetchSlots(any())).thenAnswer((_) async => []);
      when(() => bookings.fetchMyBookings()).thenAnswer((_) async => const MyBookingsView(
            remainingEdits: 3,
            bookings: [
              Booking(
                id: 'b-locked',
                slotId: 's-locked',
                traineeId: 't1',
                status: 'confirmed',
                slotDate: '2026-05-20',
                slotStartTime: '10:00',
                isLocked: true,
              ),
            ],
          ));

      // Override coach info via the harness — provide a fake repo that returns coach
      await tester.pumpWidget(_harnessWithCoach(
        repo: repo,
        bookings: bookings,
        coach: const CoachInfo(name: 'דני אמסלם', contactPhone: '+972501234567'),
      ));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('contact-coach-card')), findsOneWidget);
      expect(find.byKey(const Key('contact-coach-whatsapp')), findsOneWidget);
      expect(find.byKey(const Key('contact-coach-call')), findsOneWidget);
    });

    testWidgets(
        'locked booking: cancel button opens request sheet, reschedule is still disabled',
        (tester) async {
      final repo = _FakeSlotRepo();
      final bookings = _FakeBookingRepo();
      when(() => repo.fetchSlots(any())).thenAnswer((_) async => []);
      when(() => bookings.fetchMyBookings()).thenAnswer((_) async => const MyBookingsView(
            remainingEdits: 3,
            bookings: [
              Booking(
                id: 'b-locked',
                slotId: 's-locked',
                traineeId: 't1',
                status: 'confirmed',
                slotDate: '2026-05-20',
                slotStartTime: '10:00',
                isLocked: true,
              ),
            ],
          ));

      await tester.pumpWidget(_harness(repo: repo, bookings: bookings));
      await tester.pumpAndSettle();

      // Cancel button is enabled (opens the cancel-request sheet per Phase 15).
      final cancelBtn = tester.widget<IconButton>(
        find.byKey(const Key('cancel-booking-b-locked')),
      );
      expect(cancelBtn.onPressed, isNotNull);

      // Reschedule still disabled while locked.
      final rescheduleBtn = tester.widget<IconButton>(
        find.byKey(const Key('reschedule-booking-b-locked')),
      );
      expect(rescheduleBtn.onPressed, isNull);
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
      expect(find.text('בחר מועד חדש'), findsOneWidget);
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

    testWidgets('QuickActions no longer shows weak עזרה chip (R6)',
        (tester) async {
      final repo = _FakeSlotRepo();
      when(() => repo.fetchSlots(any())).thenAnswer((_) async => []);

      await tester.pumpWidget(_harness(repo: repo));
      await tester.pumpAndSettle();

      expect(find.text('עזרה'), findsNothing);
      // Profile + history chips remain.
      expect(find.text('הפרופיל'), findsOneWidget);
      expect(find.text('היסטוריה'), findsOneWidget);
    });

    testWidgets('hero renders 2 stats (streak + sessions); attendance dropped (R5)',
        (tester) async {
      final repo = _FakeSlotRepo();
      when(() => repo.fetchSlots(any())).thenAnswer((_) async => []);

      await tester.pumpWidget(_harness(repo: repo));
      await tester.pumpAndSettle();

      expect(find.text('רצף'), findsOneWidget);
      expect(find.text('אימונים השבוע'), findsOneWidget);
      expect(find.text('נוכחות'), findsNothing);
    });

    testWidgets('AppBar has no greeting text — hero owns greeting (R1)',
        (tester) async {
      final repo = _FakeSlotRepo();
      when(() => repo.fetchSlots(any())).thenAnswer((_) async => []);

      await tester.pumpWidget(_harness(repo: repo));
      await tester.pumpAndSettle();

      final greetingInAppBar = find.descendant(
        of: find.byType(AppBar),
        matching: find.byWidgetPredicate((w) {
          if (w is! Text) return false;
          final t = w.data ?? '';
          return t.startsWith('שלום') ||
              t.startsWith('בוקר טוב') ||
              t.startsWith('צהריים טובים') ||
              t.startsWith('ערב טוב');
        }),
      );
      expect(greetingInAppBar, findsNothing);
    });

    testWidgets('no edit-counter banner shown anymore (24h approval replaced the 3/week cap)',
        (tester) async {
      final repo = _FakeSlotRepo();
      final bookings = _FakeBookingRepo();
      when(() => repo.fetchSlots(any())).thenAnswer((_) async => []);
      when(() => bookings.fetchMyBookings()).thenAnswer((_) async =>
          const MyBookingsView(bookings: [], remainingEdits: 2));

      await tester.pumpWidget(_harness(repo: repo, bookings: bookings));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('edit-counter-banner')), findsNothing);
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

      await tester.ensureVisible(find.byKey(const Key('slot-10:00')));
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

      await tester.ensureVisible(find.byKey(const Key('slot-10:00')));
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
      await tester.ensureVisible(find.byKey(const Key('slot-10:00')));
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

      await tester.ensureVisible(find.byKey(const Key('slot-10:00')));
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

      await tester.ensureVisible(find.byKey(const Key('slot-10:00')));
      await tester.tap(find.byKey(const Key('slot-10:00')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('booking-confirm-dialog')), findsOneWidget);
      expect(find.text('לקבוע אימון לשעה 10:00?'), findsOneWidget);
      expect(find.text('אישור'), findsOneWidget);
      expect(find.text('ביטול'), findsOneWidget);
    });

    testWidgets('first-session CTA shows when trainee has no confirmed bookings (#68)',
        (tester) async {
      final repo = _FakeSlotRepo();
      final bookings = _FakeBookingRepo();
      when(() => repo.fetchSlots(any())).thenAnswer((_) async => [_aSlot]);
      when(() => bookings.fetchMyBookings()).thenAnswer((_) async =>
          const MyBookingsView(remainingEdits: 3, bookings: []));

      await tester.pumpWidget(_harness(repo: repo, bookings: bookings));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('first-session-cta')), findsOneWidget);
      expect(find.byKey(const Key('find-slot-cta')), findsOneWidget);
    });

    testWidgets('first-session CTA hidden when a confirmed booking exists (#68)',
        (tester) async {
      final repo = _FakeSlotRepo();
      final bookings = _FakeBookingRepo();
      when(() => repo.fetchSlots(any())).thenAnswer((_) async => [_aSlot]);
      when(() => bookings.fetchMyBookings()).thenAnswer((_) async =>
          const MyBookingsView(remainingEdits: 3, bookings: [
            Booking(
              id: 'b1',
              slotId: 's1',
              traineeId: 't1',
              status: 'confirmed',
              slotDate: '2026-05-20',
              slotStartTime: '10:00',
            ),
          ]));

      await tester.pumpWidget(_harness(repo: repo, bookings: bookings));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('first-session-cta')), findsNothing);
    });

    testWidgets('tapping find-slot CTA does not throw (#68)', (tester) async {
      final repo = _FakeSlotRepo();
      final bookings = _FakeBookingRepo();
      when(() => repo.fetchSlots(any())).thenAnswer((_) async => [_aSlot]);
      when(() => bookings.fetchMyBookings()).thenAnswer((_) async =>
          const MyBookingsView(remainingEdits: 3, bookings: []));

      await tester.pumpWidget(_harness(repo: repo, bookings: bookings));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('find-slot-cta')));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
    });
  });
}
