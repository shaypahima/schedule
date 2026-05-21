import 'package:flutter_test/flutter_test.dart';

import 'package:velofit/features/dashboard/dashboard_repository.dart';

void main() {
  group('TraineeDashboard.fromJson', () {
    test('parses full payload including currentStreak + memberSinceDays', () {
      final d = TraineeDashboard.fromJson({
        'sessionsThisMonth': 4,
        'pastConfirmed': 7,
        'noShows': 1,
        'attendanceRate': 0.875,
        'currentStreak': 3,
        'nextSessionAt': '2026-05-22T07:00:00.000Z',
        'recentVisibleNote': null,
        'remainingEdits': null,
        'memberSinceDays': 97,
      });
      expect(d.sessionsThisMonth, 4);
      expect(d.pastConfirmed, 7);
      expect(d.noShows, 1);
      expect(d.attendanceRate, closeTo(0.875, 1e-9));
      expect(d.currentStreak, 3);
      expect(d.memberSinceDays, 97);
      expect(d.nextSessionAt, '2026-05-22T07:00:00.000Z');
      expect(d.recentVisibleNote, isNull);
    });

    test('defaults missing fields to 0', () {
      final d = TraineeDashboard.fromJson({});
      expect(d.currentStreak, 0);
      expect(d.memberSinceDays, 0);
    });

    test('memberSinceMonths derived from memberSinceDays', () {
      // 365 days → 12 months
      expect(TraineeDashboard.fromJson({'memberSinceDays': 365}).memberSinceMonths, 12);
      // 45 days → 1 month (floor)
      expect(TraineeDashboard.fromJson({'memberSinceDays': 45}).memberSinceMonths, 1);
    });
  });
}
