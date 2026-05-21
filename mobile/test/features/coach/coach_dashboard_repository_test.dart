import 'package:flutter_test/flutter_test.dart';

import 'package:velofit/features/coach/coach_dashboard_repository.dart';

void main() {
  group('CoachDashboardView.fromJson', () {
    test('parses all counts including roster length', () {
      final view = CoachDashboardView.fromJson({
        'pendingApprovals': 2,
        'pendingChangeRequests': 1,
        'noShowsThisWeek': 3,
        'todayRoster': [
          {'bookingId': 'b1'},
          {'bookingId': 'b2'},
        ],
        'urgentRequests': [],
      });
      expect(view.pendingApprovals, 2);
      expect(view.pendingChangeRequests, 1);
      expect(view.noShowsThisWeek, 3);
      expect(view.todayRosterCount, 2);
    });

    test('defaults missing fields to 0', () {
      final view = CoachDashboardView.fromJson({});
      expect(view.pendingApprovals, 0);
      expect(view.pendingChangeRequests, 0);
      expect(view.noShowsThisWeek, 0);
      expect(view.todayRosterCount, 0);
    });
  });
}
