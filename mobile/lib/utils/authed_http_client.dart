import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/env.dart';
import '../features/auth/dev_session.dart';

/// Structured backend error matching the codes returned by the
/// /lib/auth/require helpers in the Next.js backend (RFC #43).
class ApiException implements Exception {
  /// One of: UNAUTHENTICATED, PROFILE_NOT_FOUND, FORBIDDEN_ROLE,
  /// FORBIDDEN_STATUS, INTRO_REQUIRED, or a route-specific code.
  final String code;
  final int status;
  final Map<String, dynamic>? body;

  const ApiException(this.code, this.status, [this.body]);

  @override
  String toString() => 'ApiException($code, status=$status)';
}

/// Wraps Dio. Auto-injects the Supabase JWT on every request and unwraps
/// DioException → ApiException so callers handle one shape.
class AuthedHttpClient {
  final Dio _dio;
  final SupabaseClient _supabase;
  final String? Function()? _devToken;

  AuthedHttpClient(this._dio, this._supabase, {this._devToken});

  String _requireJwt() {
    // Native-Postgres dev path: a backend-minted token takes precedence over
    // the (unused) Supabase session.
    final dev = _devToken?.call();
    if (dev != null) return dev;
    final jwt = _supabase.auth.currentSession?.accessToken;
    if (jwt == null) {
      throw const ApiException('UNAUTHENTICATED', 401);
    }
    return jwt;
  }

  Options _opts({Map<String, String>? extraHeaders}) {
    return Options(
      headers: {
        'Authorization': 'Bearer ${_requireJwt()}',
        ...?extraHeaders,
      },
    );
  }

  ApiException _wrap(DioException e) {
    final res = e.response;
    final status = res?.statusCode ?? 0;
    final data = res?.data;
    if (data is Map<String, dynamic>) {
      final code = data['error'];
      if (code is String) return ApiException(code, status, data);
    }
    return ApiException('NETWORK_ERROR', status,
        data is Map<String, dynamic> ? data : null);
  }

  Future<T> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    try {
      final res = await _dio.get<T>(
        path,
        queryParameters: queryParameters,
        options: _opts(),
      );
      return res.data as T;
    } on DioException catch (e) {
      throw _wrap(e);
    }
  }

  Future<T> post<T>(
    String path, {
    Object? data,
  }) async {
    try {
      final res = await _dio.post<T>(path, data: data, options: _opts());
      return res.data as T;
    } on DioException catch (e) {
      throw _wrap(e);
    }
  }

  Future<T> patch<T>(
    String path, {
    Object? data,
  }) async {
    try {
      final res = await _dio.patch<T>(path, data: data, options: _opts());
      return res.data as T;
    } on DioException catch (e) {
      throw _wrap(e);
    }
  }

  Future<T> delete<T>(
    String path, {
    Object? data,
  }) async {
    try {
      final res = await _dio.delete<T>(path, data: data, options: _opts());
      return res.data as T;
    } on DioException catch (e) {
      throw _wrap(e);
    }
  }
}

final dioProvider = Provider<Dio>((ref) {
  return Dio(BaseOptions(baseUrl: Env.apiBaseUrl));
});

final authedHttpProvider = Provider<AuthedHttpClient>((ref) {
  return AuthedHttpClient(
    ref.watch(dioProvider),
    Supabase.instance.client,
    devToken: () => ref.read(devSessionProvider)?.token,
  );
});
