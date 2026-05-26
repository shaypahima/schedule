import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../utils/authed_http_client.dart';
import 'progress.dart';

abstract class ProgressRepository {
  Future<ProgressView> fetch({int days = 90});
  Future<MeasurementLog> logMeasurement(MeasurementInput input);
}

class HttpProgressRepository implements ProgressRepository {
  final AuthedHttpClient _http;
  HttpProgressRepository(this._http);

  @override
  Future<ProgressView> fetch({int days = 90}) async {
    final json = await _http.get<Map<String, dynamic>>(
      '/api/me/progress?days=$days',
    );
    return ProgressView.fromJson(json);
  }

  @override
  Future<MeasurementLog> logMeasurement(MeasurementInput input) async {
    if (input.isEmpty) {
      throw const MeasurementValidationFailure(
        'EMPTY_PAYLOAD',
        'יש להזין לפחות שדה אחד',
      );
    }
    try {
      final json = await _http.post<Map<String, dynamic>>(
        '/api/me/measurement',
        data: input.toJson(),
      );
      return MeasurementLog.fromJson(
        json['measurement'] as Map<String, dynamic>,
      );
    } on ApiException catch (e) {
      // Surface validation errors as a typed failure so the UI can show
      // a friendly Hebrew message rather than the raw server payload.
      if (e.code == 'EMPTY_PAYLOAD') {
        throw const MeasurementValidationFailure(
          'EMPTY_PAYLOAD',
          'יש להזין לפחות שדה אחד',
        );
      }
      if (e.code == 'INVALID_WEIGHT') {
        throw const MeasurementValidationFailure(
          'INVALID_WEIGHT',
          'משקל לא תקין',
        );
      }
      rethrow;
    }
  }
}

class MeasurementValidationFailure implements Exception {
  final String code;
  final String message;
  const MeasurementValidationFailure(this.code, this.message);
}

final progressRepositoryProvider = Provider<ProgressRepository>(
  (ref) => HttpProgressRepository(ref.watch(authedHttpProvider)),
);

final progressProvider = FutureProvider<ProgressView>(
  (ref) => ref.watch(progressRepositoryProvider).fetch(),
);
