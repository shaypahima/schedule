import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:velofit/features/coach/admin_repository.dart';
import 'package:velofit/features/coach/coach_dashboard_repository.dart';
import 'package:velofit/features/coach/coach_week_screen.dart';
import 'package:velofit/features/coach/pending_approvals_screen.dart';
import 'package:velofit/features/slots/slot_repository.dart';

class _FakeSlotRepo extends Mock implements SlotRepository {}

class _FakeAdminRepo extends Mock implements AdminRepository {}

class _FakeDashboardRepo extends Mock implements CoachDashboardRepository {}

Widget _harness({required int approvals, required int requests}) {
  final slots = _FakeSlotRepo();
  final admin = _FakeAdminRepo();
  final dash = _FakeDashboardRepo();
  when(() => slots.fetchSlots(any())).thenAnswer((_) async => []);
  when(() => admin.fetchBookings(date: any(named: 'date')))
      .thenAnswer((_) async => []);
  when(() => admin.listTrainees()).thenAnswer((_) async => []);
  when(() => dash.fetch()).thenAnswer((_) async => CoachDashboardView(
        pendingApprovals: approvals,
        pendingChangeRequests: requests,
        noShowsThisWeek: 0,
        todayRosterCount: 0,
      ));
  return ProviderScope(
    overrides: [
      slotRepositoryProvider.overrideWithValue(slots),
      adminRepositoryProvider.overrideWithValue(admin),
      coachDashboardRepositoryProvider.overrideWithValue(dash),
    ],
    child: MaterialApp(
      builder: (context, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: child ?? const SizedBox.shrink(),
      ),
      home: CoachWeekScreen(now: DateTime(2026, 5, 20)),
    ),
  );
}

/// Tall viewport so the empty-week EmptyState below the hero isn't squeezed
/// into an overflow in the default 600px test window (real devices have room).
Future<void> _pump(WidgetTester tester, Widget w) async {
  tester.view.physicalSize = const Size(1100, 2200);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(w);
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(() => registerFallbackValue(''));

  group('CoachWeekScreen inbox hero', () {
    testWidgets('shows hero with both rows + counts when work pending',
        (tester) async {
      await _pump(tester, _harness(approvals: 2, requests: 1));

      expect(find.byKey(const Key('inbox-hero')), findsOneWidget);
      expect(find.byKey(const Key('inbox-approvals')), findsOneWidget);
      expect(find.byKey(const Key('inbox-requests')), findsOneWidget);
      expect(find.text('ממתין לטיפולך'), findsOneWidget);
      expect(find.text('2'), findsWidgets); // approvals badge
    });

    testWidgets('shows only approvals row when no change requests',
        (tester) async {
      await _pump(tester, _harness(approvals: 3, requests: 0));

      expect(find.byKey(const Key('inbox-approvals')), findsOneWidget);
      expect(find.byKey(const Key('inbox-requests')), findsNothing);
    });

    testWidgets('shows calm all-clear when nothing pending', (tester) async {
      await _pump(tester, _harness(approvals: 0, requests: 0));

      expect(find.byKey(const Key('inbox-all-clear')), findsOneWidget);
      expect(find.byKey(const Key('inbox-hero')), findsNothing);
      expect(find.text('אין משימות ממתינות'), findsOneWidget);
    });

    testWidgets('tapping approvals row routes to PendingApprovalsScreen',
        (tester) async {
      await _pump(tester, _harness(approvals: 1, requests: 0));

      await tester.tap(find.byKey(const Key('inbox-approvals')));
      await tester.pumpAndSettle();

      expect(find.byType(PendingApprovalsScreen), findsOneWidget);
    });
  });
}
