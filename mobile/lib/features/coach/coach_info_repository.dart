import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../profile/profile_repository.dart';
import 'coach_info.dart';

abstract class CoachInfoRepository {
  Future<CoachInfo?> fetch();
  Future<void> updateContactPhone(String e164);
}

class HttpCoachInfoRepository implements CoachInfoRepository {
  final Dio _dio;
  final SupabaseClient _supabase;
  HttpCoachInfoRepository(this._dio, this._supabase);

  @override
  Future<void> updateContactPhone(String e164) async {
    final jwt = _supabase.auth.currentSession?.accessToken;
    if (jwt == null) throw StateError('Not authenticated');
    await _dio.patch<void>(
      '/api/coach-settings',
      data: {'contactPhone': e164},
      options: Options(headers: {'Authorization': 'Bearer $jwt'}),
    );
  }

  @override
  Future<CoachInfo?> fetch() async {
    final jwt = _supabase.auth.currentSession?.accessToken;
    if (jwt == null) return null;
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/api/coach-info',
        options: Options(headers: {'Authorization': 'Bearer $jwt'}),
      );
      return CoachInfo.fromJson(res.data!);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      rethrow;
    }
  }
}

final coachInfoRepositoryProvider = Provider<CoachInfoRepository>((ref) {
  return HttpCoachInfoRepository(ref.watch(dioProvider), Supabase.instance.client);
});

final coachInfoProvider = FutureProvider<CoachInfo?>((ref) {
  return ref.watch(coachInfoRepositoryProvider).fetch();
});
