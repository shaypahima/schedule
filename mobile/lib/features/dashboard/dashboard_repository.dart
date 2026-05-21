import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../utils/authed_http_client.dart';

class TraineeDashboard {
  final int sessionsThisMonth;
  final int pastConfirmed;
  final int noShows;
  final double attendanceRate;
  final int currentStreak;
  final String? nextSessionAt; // ISO
  final VisibleNote? recentVisibleNote;
  final int remainingEdits;
  final int memberSinceDays;

  const TraineeDashboard({
    required this.sessionsThisMonth,
    required this.pastConfirmed,
    required this.noShows,
    required this.attendanceRate,
    required this.currentStreak,
    required this.nextSessionAt,
    required this.recentVisibleNote,
    required this.remainingEdits,
    required this.memberSinceDays,
  });

  /// Whole months since registration (floor; 30-day approximation).
  int get memberSinceMonths => memberSinceDays ~/ 30;

  factory TraineeDashboard.fromJson(Map<String, dynamic> json) => TraineeDashboard(
        sessionsThisMonth: json['sessionsThisMonth'] as int? ?? 0,
        pastConfirmed: json['pastConfirmed'] as int? ?? 0,
        noShows: json['noShows'] as int? ?? 0,
        attendanceRate: (json['attendanceRate'] as num?)?.toDouble() ?? 1.0,
        currentStreak: json['currentStreak'] as int? ?? 0,
        nextSessionAt: json['nextSessionAt'] as String?,
        recentVisibleNote: json['recentVisibleNote'] == null
            ? null
            : VisibleNote.fromJson(json['recentVisibleNote'] as Map<String, dynamic>),
        remainingEdits: json['remainingEdits'] as int? ?? 3,
        memberSinceDays: json['memberSinceDays'] as int? ?? 0,
      );
}

class VisibleNote {
  final String id;
  final String body;
  final String createdAt;
  const VisibleNote({required this.id, required this.body, required this.createdAt});
  factory VisibleNote.fromJson(Map<String, dynamic> json) => VisibleNote(
        id: json['id'] as String,
        body: json['body'] as String,
        createdAt: json['createdAt'] as String,
      );
}

abstract class DashboardRepository {
  Future<TraineeDashboard> fetch();
}

class HttpDashboardRepository implements DashboardRepository {
  final AuthedHttpClient _http;
  HttpDashboardRepository(this._http);

  @override
  Future<TraineeDashboard> fetch() async {
    final json = await _http.get<Map<String, dynamic>>('/api/me/dashboard');
    return TraineeDashboard.fromJson(json);
  }
}

final dashboardRepositoryProvider = Provider<DashboardRepository>((ref) {
  return HttpDashboardRepository(ref.watch(authedHttpProvider));
});

final traineeDashboardProvider = FutureProvider<TraineeDashboard>((ref) {
  return ref.watch(dashboardRepositoryProvider).fetch();
});
