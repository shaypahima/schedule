import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:velofit/features/auth/intro_form_screen.dart';
import 'package:velofit/features/auth/pending_approval_screen.dart';
import 'package:velofit/features/auth/rejected_screen.dart';
import 'package:velofit/features/auth/role_router.dart';
import 'package:velofit/features/coach/admin_repository.dart';
import 'package:velofit/features/coach/coach_week_screen.dart';
import 'package:velofit/features/coach/coach_info_repository.dart';
import 'package:velofit/features/bookings/booking.dart';
import 'package:velofit/features/bookings/booking_repository.dart';
import 'package:velofit/features/profile/profile.dart';
import 'package:velofit/features/profile/profile_repository.dart';
import 'package:velofit/features/slots/home_screen.dart';
import 'package:velofit/features/slots/slot_repository.dart';

class _FakeSlotRepo extends Mock implements SlotRepository {}

class _FakeAdminRepo extends Mock implements AdminRepository {}

class _FakeBookingRepo extends Mock implements BookingRepository {}

class _FakeCoachInfoRepo extends Mock implements CoachInfoRepository {}

Profile _profile({
  String role = 'trainee',
  String status = 'active',
  bool hasIntro = false,
}) =>
    Profile(
      id: 'u1',
      email: 'u1@example.com',
      name: 'דנה',
      role: role,
      status: status,
      hasIntro: hasIntro,
    );

Widget _harness(Profile profile) {
  final slots = _FakeSlotRepo();
  final admin = _FakeAdminRepo();
  final bookings = _FakeBookingRepo();
  final coachInfo = _FakeCoachInfoRepo();
  when(() => slots.fetchSlots(any())).thenAnswer((_) async => []);
  when(() => admin.fetchBookings(date: any(named: 'date')))
      .thenAnswer((_) async => []);
  when(() => bookings.fetchMyBookings()).thenAnswer(
      (_) async => const MyBookingsView(remainingEdits: 3, bookings: []));
  when(() => coachInfo.fetch()).thenAnswer((_) async => null);

  return ProviderScope(
    overrides: [
      profileProvider.overrideWith((ref) => Future.value(profile)),
      slotRepositoryProvider.overrideWithValue(slots),
      adminRepositoryProvider.overrideWithValue(admin),
      bookingRepositoryProvider.overrideWithValue(bookings),
      coachInfoRepositoryProvider.overrideWithValue(coachInfo),
    ],
    child: MaterialApp(
      builder: (context, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: child ?? const SizedBox.shrink(),
      ),
      home: const RoleRouter(),
    ),
  );
}

void main() {
  setUpAll(() {
    registerFallbackValue('');
  });

  group('RoleRouter', () {
    testWidgets('coach lands on the coach week screen', (tester) async {
      await tester.pumpWidget(_harness(_profile(role: 'coach')));
      await tester.pumpAndSettle();

      expect(find.byType(CoachWeekScreen), findsOneWidget);
      expect(find.byType(HomeScreen), findsNothing);
    });

    testWidgets('active trainee lands on home', (tester) async {
      await tester.pumpWidget(_harness(_profile(status: 'active')));
      await tester.pumpAndSettle();

      expect(find.byType(HomeScreen), findsOneWidget);
    });

    testWidgets('self-signup without intro is sent to the intro form',
        (tester) async {
      await tester
          .pumpWidget(_harness(_profile(status: 'pending', hasIntro: false)));
      await tester.pumpAndSettle();

      expect(find.byType(IntroFormScreen), findsOneWidget);
    });

    testWidgets('pending trainee with intro waits for coach approval',
        (tester) async {
      await tester
          .pumpWidget(_harness(_profile(status: 'pending', hasIntro: true)));
      await tester.pumpAndSettle();

      expect(find.byType(PendingApprovalScreen), findsOneWidget);
      expect(find.byType(IntroFormScreen), findsNothing);
    });

    testWidgets('rejected trainee sees the rejected screen', (tester) async {
      await tester.pumpWidget(_harness(_profile(status: 'rejected')));
      await tester.pumpAndSettle();

      expect(find.byType(RejectedScreen), findsOneWidget);
      expect(find.byType(HomeScreen), findsNothing);
    });

    testWidgets('deactivated trainee sees the rejected screen too',
        (tester) async {
      await tester.pumpWidget(_harness(_profile(status: 'deactivated')));
      await tester.pumpAndSettle();

      final screen = tester
          .widget<RejectedScreen>(find.byType(RejectedScreen));
      expect(screen.deactivated, isTrue);
    });
  });
}
