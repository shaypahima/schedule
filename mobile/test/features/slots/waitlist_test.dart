import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:velofit/features/coach/coach_info_repository.dart';
import 'package:velofit/features/slots/home_screen.dart';
import 'package:velofit/features/slots/slot.dart';
import 'package:velofit/features/slots/slot_repository.dart';
import 'package:velofit/features/slots/waitlist_repository.dart';

class _FakeSlotRepo extends Mock implements SlotRepository {}

class _FakeWaitlistRepo extends Mock implements WaitlistRepository {}

class _FakeCoachInfoRepo extends Mock implements CoachInfoRepository {}

const _fullSlot = Slot(
  id: 's-full',
  date: '2026-05-20',
  startTime: '10:00',
  capacity: 2,
  currentBookings: 2,
  remainingCapacity: 0,
  lockoutOverride: false,
  lockedOut: false,
);

Widget _harness({
  required SlotRepository slots,
  required WaitlistRepository waitlist,
}) {
  final coachRepo = _FakeCoachInfoRepo();
  when(() => coachRepo.fetch()).thenAnswer((_) async => null);
  return ProviderScope(
    overrides: [
      slotRepositoryProvider.overrideWithValue(slots),
      waitlistRepositoryProvider.overrideWithValue(waitlist),
      coachInfoRepositoryProvider.overrideWithValue(coachRepo),
    ],
    child: MaterialApp(
      builder: (context, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: child ?? const SizedBox.shrink(),
      ),
      home: HomeScreen(now: DateTime(2026, 5, 20)),
    ),
  );
}

void main() {
  setUpAll(() => registerFallbackValue(''));

  group('waitlist on full slots', () {
    testWidgets('full slot offers a join-waitlist action; tapping joins',
        (tester) async {
      final slots = _FakeSlotRepo();
      final waitlist = _FakeWaitlistRepo();
      when(() => slots.fetchSlots(any())).thenAnswer((_) async => [_fullSlot]);
      when(() => waitlist.mySlotIds()).thenAnswer((_) async => {});
      when(() => waitlist.join(any())).thenAnswer((_) async {});

      await tester.pumpWidget(_harness(slots: slots, waitlist: waitlist));
      await tester.pumpAndSettle();

      final joinBtn = find.byKey(const Key('waitlist-join-s-full'));
      expect(joinBtn, findsOneWidget);

      await tester.tap(joinBtn);
      await tester.pumpAndSettle();

      verify(() => waitlist.join('s-full')).called(1);
    });

    testWidgets('waitlisted slot shows the joined state; tapping leaves',
        (tester) async {
      final slots = _FakeSlotRepo();
      final waitlist = _FakeWaitlistRepo();
      when(() => slots.fetchSlots(any())).thenAnswer((_) async => [_fullSlot]);
      when(() => waitlist.mySlotIds()).thenAnswer((_) async => {'s-full'});
      when(() => waitlist.leave(any())).thenAnswer((_) async {});

      await tester.pumpWidget(_harness(slots: slots, waitlist: waitlist));
      await tester.pumpAndSettle();

      final leaveBtn = find.byKey(const Key('waitlist-leave-s-full'));
      expect(leaveBtn, findsOneWidget);
      expect(find.text('ברשימת ההמתנה'), findsOneWidget);

      await tester.tap(leaveBtn);
      await tester.pumpAndSettle();

      verify(() => waitlist.leave('s-full')).called(1);
    });

    testWidgets('non-full slot shows no waitlist affordance', (tester) async {
      final slots = _FakeSlotRepo();
      final waitlist = _FakeWaitlistRepo();
      when(() => slots.fetchSlots(any())).thenAnswer((_) async => [
            const Slot(
              id: 's-open',
              date: '2026-05-20',
              startTime: '11:00',
              capacity: 2,
              currentBookings: 1,
              remainingCapacity: 1,
              lockoutOverride: false,
              lockedOut: false,
            )
          ]);
      when(() => waitlist.mySlotIds()).thenAnswer((_) async => {});

      await tester.pumpWidget(_harness(slots: slots, waitlist: waitlist));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('waitlist-join-s-open')), findsNothing);
    });
  });
}
