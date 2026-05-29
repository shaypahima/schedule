import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../utils/authed_http_client.dart';
import '../progress/progress.dart';

/// Coach-side read of a trainee's progress. Hits the existing admin endpoint
/// (GET /api/admin/trainees/:id/progress) and reuses the trainee-side
/// ProgressView/MeasurementLog models + WeightChart widget.
abstract class CoachProgressRepository {
  Future<ProgressView> fetch(String traineeId);
}

class HttpCoachProgressRepository implements CoachProgressRepository {
  final AuthedHttpClient _http;
  HttpCoachProgressRepository(this._http);

  @override
  Future<ProgressView> fetch(String traineeId) async {
    final json = await _http.get<Map<String, dynamic>>(
      '/api/admin/trainees/$traineeId/progress',
    );
    return ProgressView.fromJson(json);
  }
}

final coachProgressRepositoryProvider = Provider<CoachProgressRepository>(
  (ref) => HttpCoachProgressRepository(ref.watch(authedHttpProvider)),
);

final coachProgressProvider = FutureProvider.family<ProgressView, String>(
  (ref, traineeId) => ref.watch(coachProgressRepositoryProvider).fetch(traineeId),
);
