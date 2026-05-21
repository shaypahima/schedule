import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../utils/authed_http_client.dart';
import 'profile.dart';

abstract class ProfileRepository {
  Future<Profile> fetchMe();
}

class HttpProfileRepository implements ProfileRepository {
  final AuthedHttpClient _http;

  HttpProfileRepository(this._http);

  @override
  Future<Profile> fetchMe() async {
    final json = await _http.get<Map<String, dynamic>>('/api/me');
    return Profile.fromJson(json);
  }
}

final profileRepositoryProvider = Provider<ProfileRepository>((ref) {
  return HttpProfileRepository(ref.watch(authedHttpProvider));
});

final profileProvider = FutureProvider<Profile>((ref) {
  return ref.watch(profileRepositoryProvider).fetchMe();
});
