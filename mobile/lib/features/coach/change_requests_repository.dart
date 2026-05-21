import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../utils/authed_http_client.dart';

class ChangeRequest {
  final String id;
  final String requestedAt;
  final String reason;
  final String traineeId;
  final String traineeName;
  final String fromSlotStartsAt; // ISO
  final String? toSlotStartsAt; // ISO; null = cancel request

  const ChangeRequest({
    required this.id,
    required this.requestedAt,
    required this.reason,
    required this.traineeId,
    required this.traineeName,
    required this.fromSlotStartsAt,
    required this.toSlotStartsAt,
  });

  bool get isCancelRequest => toSlotStartsAt == null;

  factory ChangeRequest.fromJson(Map<String, dynamic> json) {
    final trainee = json['trainee'] as Map<String, dynamic>;
    final from = json['fromSlot'] as Map<String, dynamic>;
    final to = json['toSlot'] as Map<String, dynamic>?;
    return ChangeRequest(
      id: json['id'] as String,
      requestedAt: json['requestedAt'] as String,
      reason: (json['reason'] as String?) ?? '',
      traineeId: trainee['id'] as String,
      traineeName: trainee['name'] as String,
      fromSlotStartsAt: from['startsAt'] as String,
      toSlotStartsAt: to?['startsAt'] as String?,
    );
  }
}

abstract class ChangeRequestsRepository {
  Future<List<ChangeRequest>> fetch();
  Future<void> decide(String id, {required String decision, String? note});
}

class HttpChangeRequestsRepository implements ChangeRequestsRepository {
  final AuthedHttpClient _http;
  HttpChangeRequestsRepository(this._http);

  @override
  Future<List<ChangeRequest>> fetch() async {
    final json =
        await _http.get<Map<String, dynamic>>('/api/admin/change-requests');
    final list = (json['requests'] as List).cast<Map<String, dynamic>>();
    return list.map(ChangeRequest.fromJson).toList();
  }

  @override
  Future<void> decide(String id, {required String decision, String? note}) async {
    final body = <String, dynamic>{'decision': decision};
    if (note != null) body['note'] = note;
    await _http.post<void>('/api/admin/change-requests/$id/decide', data: body);
  }
}

final changeRequestsRepositoryProvider =
    Provider<ChangeRequestsRepository>((ref) {
  return HttpChangeRequestsRepository(ref.watch(authedHttpProvider));
});

final changeRequestsProvider = FutureProvider<List<ChangeRequest>>((ref) {
  return ref.watch(changeRequestsRepositoryProvider).fetch();
});
