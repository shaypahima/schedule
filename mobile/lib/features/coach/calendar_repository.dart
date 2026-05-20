import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../profile/profile_repository.dart';

class CalendarStatus {
  final bool connected;
  final bool mock;
  const CalendarStatus({required this.connected, required this.mock});
}

abstract class CalendarRepository {
  Future<CalendarStatus> status();
  Future<String> getAuthUrl();
}

class HttpCalendarRepository implements CalendarRepository {
  final Dio _dio;
  final SupabaseClient _supabase;
  HttpCalendarRepository(this._dio, this._supabase);

  String _jwt() {
    final t = _supabase.auth.currentSession?.accessToken;
    if (t == null) throw StateError('Not authenticated');
    return t;
  }

  @override
  Future<CalendarStatus> status() async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/api/coach-calendar/status',
      options: Options(headers: {'Authorization': 'Bearer ${_jwt()}'}),
    );
    return CalendarStatus(
      connected: (res.data!['connected'] as bool?) ?? false,
      mock: (res.data!['mock'] as bool?) ?? false,
    );
  }

  @override
  Future<String> getAuthUrl() async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/api/coach-calendar/url',
      options: Options(headers: {'Authorization': 'Bearer ${_jwt()}'}),
    );
    return res.data!['authUrl'] as String;
  }
}

final calendarRepositoryProvider = Provider<CalendarRepository>((ref) {
  return HttpCalendarRepository(ref.watch(dioProvider), Supabase.instance.client);
});

final calendarStatusProvider = FutureProvider<CalendarStatus>((ref) {
  return ref.watch(calendarRepositoryProvider).status();
});
