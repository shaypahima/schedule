import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../utils/authed_http_client.dart';

class CoachNote {
  final String id;
  final String traineeId;
  final String body;
  final bool visibleToTrainee;
  final String createdAt;
  final String updatedAt;

  const CoachNote({
    required this.id,
    required this.traineeId,
    required this.body,
    required this.visibleToTrainee,
    required this.createdAt,
    required this.updatedAt,
  });

  factory CoachNote.fromJson(Map<String, dynamic> json) => CoachNote(
        id: json['id'] as String,
        traineeId: json['traineeId'] as String,
        body: json['body'] as String,
        visibleToTrainee: (json['visibleToTrainee'] as bool?) ?? false,
        createdAt: json['createdAt']?.toString() ?? '',
        updatedAt: json['updatedAt']?.toString() ?? '',
      );
}

abstract class NotesRepository {
  Future<List<CoachNote>> listForTrainee(String traineeId);
  Future<CoachNote> create({
    required String traineeId,
    required String body,
    required bool visibleToTrainee,
  });
  Future<CoachNote> update(String noteId, {String? body, bool? visibleToTrainee});
  Future<void> delete(String noteId);
}

class HttpNotesRepository implements NotesRepository {
  final AuthedHttpClient _http;
  HttpNotesRepository(this._http);

  @override
  Future<List<CoachNote>> listForTrainee(String traineeId) async {
    final json = await _http.get<Map<String, dynamic>>(
      '/api/admin/trainees/$traineeId/notes',
    );
    final list = (json['notes'] as List).cast<Map<String, dynamic>>();
    return list.map(CoachNote.fromJson).toList();
  }

  @override
  Future<CoachNote> create({
    required String traineeId,
    required String body,
    required bool visibleToTrainee,
  }) async {
    final json = await _http.post<Map<String, dynamic>>(
      '/api/admin/trainees/$traineeId/notes',
      data: {'body': body, 'visibleToTrainee': visibleToTrainee},
    );
    return CoachNote.fromJson(json['note'] as Map<String, dynamic>);
  }

  @override
  Future<CoachNote> update(
    String noteId, {
    String? body,
    bool? visibleToTrainee,
  }) async {
    final patch = <String, dynamic>{};
    if (body != null) patch['body'] = body;
    if (visibleToTrainee != null) patch['visibleToTrainee'] = visibleToTrainee;
    final json = await _http.patch<Map<String, dynamic>>(
      '/api/admin/notes/$noteId',
      data: patch,
    );
    return CoachNote.fromJson(json['note'] as Map<String, dynamic>);
  }

  @override
  Future<void> delete(String noteId) async {
    await _http.delete<void>('/api/admin/notes/$noteId');
  }
}

final notesRepositoryProvider = Provider<NotesRepository>((ref) {
  return HttpNotesRepository(ref.watch(authedHttpProvider));
});

final notesForTraineeProvider =
    FutureProvider.family<List<CoachNote>, String>((ref, traineeId) {
  return ref.watch(notesRepositoryProvider).listForTrainee(traineeId);
});
