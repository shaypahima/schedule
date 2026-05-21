import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../utils/authed_http_client.dart';
import 'coach_info.dart';

abstract class CoachInfoRepository {
  Future<CoachInfo?> fetch();
  Future<void> updateContactPhone(String e164);
  Future<void> update(CoachInfoPatch patch);
}

class HttpCoachInfoRepository implements CoachInfoRepository {
  final AuthedHttpClient _http;
  final SupabaseClient _supabase;
  HttpCoachInfoRepository(this._http, this._supabase);

  @override
  Future<void> updateContactPhone(String e164) async {
    await _http.patch<void>('/api/coach-settings', data: {'contactPhone': e164});
  }

  @override
  Future<void> update(CoachInfoPatch patch) async {
    await _http.patch<void>('/api/coach-settings', data: patch.toJson());
  }

  @override
  Future<CoachInfo?> fetch() async {
    // Early bail-out for the unauthenticated case to avoid 401 noise in logs.
    if (_supabase.auth.currentSession?.accessToken == null) return null;
    try {
      final json = await _http.get<Map<String, dynamic>>('/api/coach-info');
      return CoachInfo.fromJson(json);
    } on ApiException catch (e) {
      if (e.status == 404) return null;
      rethrow;
    }
  }
}

final coachInfoRepositoryProvider = Provider<CoachInfoRepository>((ref) {
  return HttpCoachInfoRepository(
    ref.watch(authedHttpProvider),
    Supabase.instance.client,
  );
});

final coachInfoProvider = FutureProvider<CoachInfo?>((ref) {
  return ref.watch(coachInfoRepositoryProvider).fetch();
});
