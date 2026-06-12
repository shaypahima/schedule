import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../utils/authed_http_client.dart';

/// One calendar month of held-session aggregates (#84).
class MonthlyStats {
  final int sessionsHeld;
  final int noShows;
  final double? attendanceRate; // null when no past sessions this month
  final int activeTrainees;
  final MonthlyStats? prev; // null on prev itself / when prev month empty

  const MonthlyStats({
    required this.sessionsHeld,
    required this.noShows,
    required this.attendanceRate,
    required this.activeTrainees,
    this.prev,
  });

  factory MonthlyStats.fromJson(Map<String, dynamic> json) => MonthlyStats(
        sessionsHeld: json['sessionsHeld'] as int? ?? 0,
        noShows: json['noShows'] as int? ?? 0,
        attendanceRate: (json['attendanceRate'] as num?)?.toDouble(),
        activeTrainees: json['activeTrainees'] as int? ?? 0,
        prev: json['prev'] == null
            ? null
            : MonthlyStats.fromJson(json['prev'] as Map<String, dynamic>),
      );
}

class CoachDashboardView {
  final int pendingApprovals;
  final int pendingChangeRequests;
  final int noShowsThisWeek;
  final int todayRosterCount;
  final MonthlyStats? monthly; // null on older backends

  const CoachDashboardView({
    required this.pendingApprovals,
    required this.pendingChangeRequests,
    required this.noShowsThisWeek,
    required this.todayRosterCount,
    this.monthly,
  });

  factory CoachDashboardView.fromJson(Map<String, dynamic> json) =>
      CoachDashboardView(
        pendingApprovals: json['pendingApprovals'] as int? ?? 0,
        pendingChangeRequests: json['pendingChangeRequests'] as int? ?? 0,
        noShowsThisWeek: json['noShowsThisWeek'] as int? ?? 0,
        todayRosterCount: (json['todayRoster'] as List?)?.length ?? 0,
        monthly: json['monthly'] == null
            ? null
            : MonthlyStats.fromJson(json['monthly'] as Map<String, dynamic>),
      );
}

abstract class CoachDashboardRepository {
  Future<CoachDashboardView> fetch();
}

class HttpCoachDashboardRepository implements CoachDashboardRepository {
  final AuthedHttpClient _http;
  HttpCoachDashboardRepository(this._http);

  @override
  Future<CoachDashboardView> fetch() async {
    final json = await _http.get<Map<String, dynamic>>('/api/admin/dashboard');
    return CoachDashboardView.fromJson(json);
  }
}

final coachDashboardRepositoryProvider =
    Provider<CoachDashboardRepository>((ref) {
  return HttpCoachDashboardRepository(ref.watch(authedHttpProvider));
});

final coachDashboardProvider = FutureProvider<CoachDashboardView>((ref) {
  return ref.watch(coachDashboardRepositoryProvider).fetch();
});
