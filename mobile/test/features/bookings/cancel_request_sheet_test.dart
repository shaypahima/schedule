import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:velofit/features/bookings/booking.dart';
import 'package:velofit/features/bookings/booking_repository.dart';
import 'package:velofit/features/bookings/cancel_request_sheet.dart';

class _FakeBookingRepo extends Mock implements BookingRepository {}

const _booking = Booking(
  id: 'b1',
  slotId: 's1',
  traineeId: 't1',
  status: 'confirmed',
  slotDate: '2026-05-20',
  slotStartTime: '10:00',
  isLocked: true,
);

/// Opens the sheet the way production does — via showModalBottomSheet —
/// so Navigator.pop() inside the sheet behaves like the real flow.
Widget _harness(BookingRepository repo) => ProviderScope(
      overrides: [bookingRepositoryProvider.overrideWithValue(repo)],
      child: MaterialApp(
        builder: (context, child) => Directionality(
          textDirection: TextDirection.rtl,
          child: child ?? const SizedBox.shrink(),
        ),
        home: Scaffold(
          body: Builder(
            builder: (context) => Center(
              child: ElevatedButton(
                key: const Key('open-sheet'),
                onPressed: () => showModalBottomSheet<void>(
                  context: context,
                  isScrollControlled: true,
                  builder: (_) => const CancelRequestSheet(booking: _booking),
                ),
                child: const Text('פתח'),
              ),
            ),
          ),
        ),
      ),
    );

Future<void> _openSheet(WidgetTester tester, BookingRepository repo) async {
  await tester.pumpWidget(_harness(repo));
  await tester.tap(find.byKey(const Key('open-sheet')));
  await tester.pumpAndSettle();
}

void main() {
  group('CancelRequestSheet', () {
    testWidgets('submitting without a reason shows error and sends nothing',
        (tester) async {
      final repo = _FakeBookingRepo();
      await _openSheet(tester, repo);

      await tester.tap(find.byKey(const Key('cancel-request-submit')));
      await tester.pumpAndSettle();

      expect(find.text('נדרשת סיבה'), findsOneWidget);
      verifyNever(() => repo.requestCancel(any(), reason: any(named: 'reason')));
    });

    testWidgets('valid reason sends the request, closes sheet, confirms in Hebrew',
        (tester) async {
      final repo = _FakeBookingRepo();
      when(() => repo.requestCancel(any(), reason: any(named: 'reason')))
          .thenAnswer((_) async => 'cr1');
      await _openSheet(tester, repo);

      await tester.enterText(
          find.byKey(const Key('cancel-request-reason')), 'לא מרגיש טוב');
      await tester.tap(find.byKey(const Key('cancel-request-submit')));
      await tester.pumpAndSettle();

      verify(() => repo.requestCancel('b1', reason: 'לא מרגיש טוב')).called(1);
      expect(find.byType(CancelRequestSheet), findsNothing);
      expect(find.text('הבקשה נשלחה למאמן'), findsOneWidget);
    });

    testWidgets('ALREADY_REQUESTED failure shows Hebrew message, sheet stays open',
        (tester) async {
      final repo = _FakeBookingRepo();
      when(() => repo.requestCancel(any(), reason: any(named: 'reason')))
          .thenThrow(const BookingFailure('ALREADY_REQUESTED', statusCode: 409));
      await _openSheet(tester, repo);

      await tester.enterText(
          find.byKey(const Key('cancel-request-reason')), 'סיבה כלשהי');
      await tester.tap(find.byKey(const Key('cancel-request-submit')));
      await tester.pumpAndSettle();

      expect(find.text('כבר נשלחה בקשה לאימון הזה'), findsOneWidget);
      expect(find.byType(CancelRequestSheet), findsOneWidget);
    });
  });
}
