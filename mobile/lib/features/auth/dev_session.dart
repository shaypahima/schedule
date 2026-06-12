import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/env.dart';

/// A dev session minted by the backend's /api/dev/login (native-Postgres dev
/// path, no Supabase GoTrue). Holds the HS256 bearer token used by
/// AuthedHttpClient and the resolved user.
class DevSession {
  final String token;
  final String userId;
  final String email;
  final String role;

  const DevSession({
    required this.token,
    required this.userId,
    required this.email,
    required this.role,
  });
}

class DevSessionNotifier extends Notifier<DevSession?> {
  @override
  DevSession? build() => null;

  /// Exchanges email + dev password for a token via the backend.
  Future<void> login(String email, String password) async {
    final dio = Dio(BaseOptions(baseUrl: Env.apiBaseUrl));
    final res = await dio.post<Map<String, dynamic>>(
      '/api/dev/login',
      data: {'email': email, 'password': password},
    );
    final data = res.data!;
    final user = data['user'] as Map<String, dynamic>;
    state = DevSession(
      token: data['token'] as String,
      userId: user['id'] as String,
      email: user['email'] as String,
      role: user['role'] as String,
    );
  }

  void logout() => state = null;
}

final devSessionProvider =
    NotifierProvider<DevSessionNotifier, DevSession?>(DevSessionNotifier.new);
