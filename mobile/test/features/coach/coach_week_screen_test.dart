import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:velofit/features/coach/admin_repository.dart';
import 'package:velofit/features/coach/coach_dashboard_repository.dart';
import 'package:velofit/features/coach/coach_week_screen.dart';
import 'package:velofit/features/slots/slot.dart';
import 'package:velofit/features/slots/slot_repository.dart';

class _FakeSlotRepo extends Mock implements SlotRepository {}

class _FakeAdminRepo extends Mock implements AdminRepository {}

class _FakeDashboardRepo extends Mock implements CoachDashboardRepository {}

Widget _harness({
  required SlotRepository slots,
  required AdminRepository admin,
  CoachDashboardRepository? dashboard,
  DateTime? now,
}) =>
    ProviderScope(
      overrides: [
        slotRepositoryProvider.overrideWithValue(slots),
        adminRepositoryProvider.overrideWithValue(admin),
        if (dashboard != null)
          coachDashboardRepositoryProvider.overrideWithValue(dashboard),
      ],
      child: MaterialApp(
        builder: (context, child) => Directionality(
          textDirection: TextDirection.rtl,
          child: child ?? const SizedBox.shrink(),
        ),
        home: CoachWeekScreen(now: now ?? DateTime(2026, 5, 20)),
      ),
    );

const _slot1 = Slot(
  id: 's1',
  date: '2026-05-20',
  startTime: '10:00',
  capacity: 2,
  currentBookings: 1,
  remainingCapacity: 1,
  lockoutOverride: false,
  lockedOut: false,
);

void main() {
  setUpAll(() {
    registerFallbackValue('');
  });

  group('CoachWeekScreen', () {
    testWidgets('renders trainee names alongside slot times', (tester) async {
      final slots = _FakeSlotRepo();
      final admin = _FakeAdminRepo();
      when(() => slots.fetchSlots(any())).thenAnswer((_) async => [_slot1]);
      when(() => admin.fetchBookings(date: any(named: 'date'))).thenAnswer((_) async => [
            const AdminBooking(
              id: 'b1',
              slotId: 's1',
              traineeId: 't1',
              traineeName: 'יעל כהן',
              slotDate: '2026-05-20',
              startTime: '10:00',
            ),
          ]);

      await tester.pumpWidget(_harness(slots: slots, admin: admin));
      await tester.pumpAndSettle();

      expect(find.text('10:00'), findsOneWidget);
      expect(find.text('נותר מקום 1'), findsOneWidget);
      expect(find.text('יעל כהן'), findsOneWidget);
      // Add-trainee button visible because slot has remaining capacity
      expect(find.byKey(const Key('add-trainee-s1')), findsOneWidget);
      // Remove button visible per booking
      expect(find.byKey(const Key('remove-booking-b1')), findsOneWidget);
    });

    testWidgets('next/prev week buttons update the week range', (tester) async {
      final slots = _FakeSlotRepo();
      final admin = _FakeAdminRepo();
      when(() => slots.fetchSlots(any())).thenAnswer((_) async => []);
      when(() => admin.fetchBookings(date: any(named: 'date'))).thenAnswer((_) async => []);

      await tester.pumpWidget(_harness(slots: slots, admin: admin));
      await tester.pumpAndSettle();

      // 2026-05-20 is Wed → Sun=2026-05-17, Fri=2026-05-22
      expect(find.text('17.5 – 22.5'), findsOneWidget);

      await tester.tap(find.byKey(const Key('week-next')));
      await tester.pumpAndSettle();
      expect(find.text('24.5 – 29.5'), findsOneWidget);

      await tester.tap(find.byKey(const Key('week-prev')));
      await tester.tap(find.byKey(const Key('week-prev')));
      await tester.pumpAndSettle();
      expect(find.text('10.5 – 15.5'), findsOneWidget);
    });

    testWidgets('empty day renders EmptyState pattern (R18)', (tester) async {
      final slots = _FakeSlotRepo();
      final admin = _FakeAdminRepo();
      when(() => slots.fetchSlots(any())).thenAnswer((_) async => []);
      when(() => admin.fetchBookings(date: any(named: 'date')))
          .thenAnswer((_) async => []);

      await tester.pumpWidget(_harness(slots: slots, admin: admin));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('week-empty')), findsOneWidget);
      expect(find.text('אין שעות פנויות ביום זה'), findsOneWidget);
      expect(find.text('בחר יום אחר או עבור לשבוע אחר'), findsOneWidget);
      expect(
        find.descendant(
          of: find.byKey(const Key('week-empty')),
          matching: find.byIcon(Icons.event_busy_outlined),
        ),
        findsOneWidget,
      );
    });

    testWidgets('fetch error renders ErrorCard with retry (R17)', (tester) async {
      final slots = _FakeSlotRepo();
      final admin = _FakeAdminRepo();
      when(() => slots.fetchSlots(any())).thenThrow(Exception('boom'));
      when(() => admin.fetchBookings(date: any(named: 'date')))
          .thenAnswer((_) async => []);

      await tester.pumpWidget(_harness(slots: slots, admin: admin));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('week-error')), findsOneWidget);
      expect(find.text('שגיאה בטעינת המועדים'), findsOneWidget);
      expect(find.byKey(const Key('week-error-retry')), findsOneWidget);
    });

    testWidgets('monthly overview card shows month stats with deltas (#84)',
        (tester) async {
      final slots = _FakeSlotRepo();
      final admin = _FakeAdminRepo();
      final dashboard = _FakeDashboardRepo();
      when(() => slots.fetchSlots(any())).thenAnswer((_) async => []);
      when(() => admin.fetchBookings(date: any(named: 'date')))
          .thenAnswer((_) async => []);
      when(() => dashboard.fetch()).thenAnswer((_) async =>
          const CoachDashboardView(
            pendingApprovals: 0,
            pendingChangeRequests: 0,
            noShowsThisWeek: 0,
            todayRosterCount: 0,
            monthly: MonthlyStats(
              sessionsHeld: 12,
              noShows: 1,
              attendanceRate: 0.92,
              activeTrainees: 7,
              prev: MonthlyStats(
                sessionsHeld: 9,
                noShows: 3,
                attendanceRate: 0.75,
                activeTrainees: 6,
              ),
            ),
          ));

      await tester.pumpWidget(
          _harness(slots: slots, admin: admin, dashboard: dashboard));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('monthly-overview')), findsOneWidget);
      expect(find.text('החודש'), findsOneWidget);
      expect(find.text('12'), findsOneWidget); // sessions held
      expect(find.text('92%'), findsOneWidget); // attendance
      expect(find.text('+3'), findsOneWidget); // sessions delta vs prev
    });

    testWidgets('monthly card hidden when backend has no monthly data',
        (tester) async {
      final slots = _FakeSlotRepo();
      final admin = _FakeAdminRepo();
      final dashboard = _FakeDashboardRepo();
      when(() => slots.fetchSlots(any())).thenAnswer((_) async => []);
      when(() => admin.fetchBookings(date: any(named: 'date')))
          .thenAnswer((_) async => []);
      when(() => dashboard.fetch()).thenAnswer((_) async =>
          const CoachDashboardView(
            pendingApprovals: 0,
            pendingChangeRequests: 0,
            noShowsThisWeek: 0,
            todayRosterCount: 0,
          ));

      await tester.pumpWidget(
          _harness(slots: slots, admin: admin, dashboard: dashboard));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('monthly-overview')), findsNothing);
    });

    testWidgets('full slot with waitlisted trainees shows ממתינים count',
        (tester) async {
      final slots = _FakeSlotRepo();
      final admin = _FakeAdminRepo();
      when(() => slots.fetchSlots(any())).thenAnswer((_) async => [
            const Slot(
              id: 's-full',
              date: '2026-05-20',
              startTime: '10:00',
              capacity: 2,
              currentBookings: 2,
              remainingCapacity: 0,
              lockoutOverride: false,
              lockedOut: false,
            )
          ]);
      when(() => admin.fetchBookings(date: any(named: 'date')))
          .thenAnswer((_) async => []);
      when(() => admin.fetchWaitlistCounts(any()))
          .thenAnswer((_) async => {'s-full': 2});

      await tester.pumpWidget(_harness(slots: slots, admin: admin));
      await tester.pumpAndSettle();

      expect(find.textContaining('ממתינים 2'), findsOneWidget);
    });

    testWidgets('remove booking → confirm dialog → admin.removeBooking',
        (tester) async {
      final slots = _FakeSlotRepo();
      final admin = _FakeAdminRepo();
      when(() => slots.fetchSlots(any())).thenAnswer((_) async => [_slot1]);
      when(() => admin.fetchBookings(date: any(named: 'date'))).thenAnswer((_) async => [
            const AdminBooking(
              id: 'b1',
              slotId: 's1',
              traineeId: 't1',
              traineeName: 'יעל כהן',
              slotDate: '2026-05-20',
              startTime: '10:00',
            ),
          ]);
      when(() => admin.removeBooking(any())).thenAnswer((_) async {});

      await tester.pumpWidget(_harness(slots: slots, admin: admin));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('remove-booking-b1')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('remove-booking-dialog')), findsOneWidget);
      await tester.tap(find.text('כן, הסר'));
      await tester.pumpAndSettle();

      verify(() => admin.removeBooking('b1')).called(1);
    });
  });
}
