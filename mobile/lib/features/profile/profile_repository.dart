import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../config/env.dart';
import 'profile.dart';

abstract class ProfileRepository {
  Future<Profile> fetchMe();
}

class HttpProfileRepository implements ProfileRepository {
  final Dio _dio;
  final SupabaseClient _supabase;

  HttpProfileRepository(this._dio, this._supabase);

  @override
  Future<Profile> fetchMe() async {
    final jwt = _supabase.auth.currentSession?.accessToken;
    if (jwt == null) {
      throw StateError('Not authenticated');
    }
    final res = await _dio.get<Map<String, dynamic>>(
      '/api/me',
      options: Options(headers: {'Authorization': 'Bearer $jwt'}),
    );
    return Profile.fromJson(res.data!);
  }
}

final dioProvider = Provider<Dio>((ref) {
  return Dio(BaseOptions(baseUrl: Env.apiBaseUrl));
});

final profileRepositoryProvider = Provider<ProfileRepository>((ref) {
  return HttpProfileRepository(
    ref.watch(dioProvider),
    Supabase.instance.client,
  );
});

final profileProvider = FutureProvider<Profile>((ref) {
  return ref.watch(profileRepositoryProvider).fetchMe();
});
