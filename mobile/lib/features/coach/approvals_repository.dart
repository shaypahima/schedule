import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../utils/authed_http_client.dart';

class PendingApproval {
  final String id;
  final String name;
  final String? email;
  final String? phone;
  const PendingApproval({
    required this.id,
    required this.name,
    this.email,
    this.phone,
  });
  factory PendingApproval.fromJson(Map<String, dynamic> json) => PendingApproval(
        id: json['id'] as String,
        name: json['name'] as String,
        email: json['email'] as String?,
        phone: json['phone'] as String?,
      );
}

abstract class ApprovalsRepository {
  Future<List<PendingApproval>> list();
  Future<void> approve(String traineeId);
  Future<void> reject(String traineeId);
}

class HttpApprovalsRepository implements ApprovalsRepository {
  final AuthedHttpClient _http;
  HttpApprovalsRepository(this._http);

  @override
  Future<List<PendingApproval>> list() async {
    final json = await _http.get<Map<String, dynamic>>('/api/admin/pending-approvals');
    final list = (json['pending'] as List).cast<Map<String, dynamic>>();
    return list.map(PendingApproval.fromJson).toList();
  }

  @override
  Future<void> approve(String traineeId) async {
    await _http.post<void>('/api/admin/trainees/$traineeId/approve');
  }

  @override
  Future<void> reject(String traineeId) async {
    await _http.post<void>('/api/admin/trainees/$traineeId/reject');
  }
}

final approvalsRepositoryProvider = Provider<ApprovalsRepository>((ref) {
  return HttpApprovalsRepository(ref.watch(authedHttpProvider));
});

final pendingApprovalsProvider = FutureProvider<List<PendingApproval>>((ref) {
  return ref.watch(approvalsRepositoryProvider).list();
});
