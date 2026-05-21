import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../utils/authed_http_client.dart';

class IntroFailure implements Exception {
  final String code;
  final String message;
  const IntroFailure(this.code, this.message);
  @override
  String toString() => 'IntroFailure($code): $message';
}

abstract class IntroRepository {
  /// Submit phone (E.164) + intro text. Returns when accepted by the backend.
  Future<void> submit({required String phone, required String introText});
}

class HttpIntroRepository implements IntroRepository {
  final AuthedHttpClient _http;
  HttpIntroRepository(this._http);

  @override
  Future<void> submit({required String phone, required String introText}) async {
    try {
      await _http.post<Map<String, dynamic>>(
        '/api/me/intro',
        data: {'phone': phone, 'introText': introText},
      );
    } on ApiException catch (e) {
      throw IntroFailure(e.code, e.body?['message']?.toString() ?? e.code);
    }
  }
}

final introRepositoryProvider = Provider<IntroRepository>((ref) {
  return HttpIntroRepository(ref.watch(authedHttpProvider));
});
