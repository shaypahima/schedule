import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../utils/authed_http_client.dart';
import 'trainee_profile.dart';

abstract class TraineeProfileRepository {
  Future<TraineeProfile> fetch();
  Future<TraineeProfile> update(TraineeProfilePatch patch);
}

class HttpTraineeProfileRepository implements TraineeProfileRepository {
  final AuthedHttpClient _http;
  HttpTraineeProfileRepository(this._http);

  @override
  Future<TraineeProfile> fetch() async {
    final json = await _http.get<Map<String, dynamic>>('/api/me/profile');
    return TraineeProfile.fromJson(json['profile'] as Map<String, dynamic>);
  }

  @override
  Future<TraineeProfile> update(TraineeProfilePatch patch) async {
    final json = await _http.patch<Map<String, dynamic>>(
      '/api/me/profile',
      data: patch.toJson(),
    );
    return TraineeProfile.fromJson(json['profile'] as Map<String, dynamic>);
  }
}

final traineeProfileRepositoryProvider = Provider<TraineeProfileRepository>(
  (ref) => HttpTraineeProfileRepository(ref.watch(authedHttpProvider)),
);

final traineeProfileProvider = FutureProvider<TraineeProfile>(
  (ref) => ref.watch(traineeProfileRepositoryProvider).fetch(),
);
