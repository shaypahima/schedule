import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../utils/authed_http_client.dart';

class CoachDashboardView {
  final int pendingApprovals;
  final int pendingChangeRequests;
  final int noShowsThisWeek;
  final int todayRosterCount;

  const CoachDashboardView({
    required this.pendingApprovals,
    required this.pendingChangeRequests,
    required this.noShowsThisWeek,
    required this.todayRosterCount,
  });

  factory CoachDashboardView.fromJson(Map<String, dynamic> json) =>
      CoachDashboardView(
        pendingApprovals: json['pendingApprovals'] as int? ?? 0,
        pendingChangeRequests: json['pendingChangeRequests'] as int? ?? 0,
        noShowsThisWeek: json['noShowsThisWeek'] as int? ?? 0,
        todayRosterCount: (json['todayRoster'] as List?)?.length ?? 0,
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
