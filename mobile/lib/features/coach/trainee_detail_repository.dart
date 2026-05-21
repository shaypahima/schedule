import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../utils/authed_http_client.dart';

class TraineeDetailView {
  final String id;
  final String name;
  final bool isActive;
  final TraineeBio bio;
  final List<TraineeSession> sessions;
  final int weekBookingsCount;

  const TraineeDetailView({
    required this.id,
    required this.name,
    required this.isActive,
    required this.bio,
    required this.sessions,
    required this.weekBookingsCount,
  });

  factory TraineeDetailView.fromJson(Map<String, dynamic> json) {
    final t = json['trainee'] as Map<String, dynamic>;
    final p = (json['profile'] as Map<String, dynamic>?) ?? const {};
    final sessions =
        ((json['sessions'] as List?) ?? const []).cast<Map<String, dynamic>>();
    return TraineeDetailView(
      id: t['id'] as String,
      name: t['name'] as String,
      isActive: (t['isActive'] as bool?) ?? true,
      bio: TraineeBio.fromJson(p),
      sessions: sessions.map(TraineeSession.fromJson).toList(),
      weekBookingsCount: (json['weekBookingsCount'] as int?) ?? 0,
    );
  }
}

class TraineeBio {
  final String? phone;
  final String? introText;
  final String? dateOfBirth;
  final int? heightCm;
  final int? weightKg;
  final String? goals;
  final String? medical;

  const TraineeBio({
    this.phone,
    this.introText,
    this.dateOfBirth,
    this.heightCm,
    this.weightKg,
    this.goals,
    this.medical,
  });

  factory TraineeBio.fromJson(Map<String, dynamic> json) => TraineeBio(
        phone: json['phone'] as String?,
        introText: json['introText'] as String?,
        dateOfBirth: json['dateOfBirth'] as String?,
        heightCm: (json['heightCm'] as num?)?.toInt(),
        weightKg: (json['weightKg'] as num?)?.toInt(),
        goals: json['goals'] as String?,
        medical: json['medical'] as String?,
      );
}

class TraineeSession {
  final String bookingId;
  final String date;
  final String startTime;
  const TraineeSession({
    required this.bookingId,
    required this.date,
    required this.startTime,
  });

  factory TraineeSession.fromJson(Map<String, dynamic> json) => TraineeSession(
        bookingId: json['bookingId'] as String,
        date: json['date'] as String,
        startTime: json['startTime'] as String,
      );
}

abstract class TraineeDetailRepository {
  Future<TraineeDetailView> fetch(String traineeId);
}

class HttpTraineeDetailRepository implements TraineeDetailRepository {
  final AuthedHttpClient _http;
  HttpTraineeDetailRepository(this._http);

  @override
  Future<TraineeDetailView> fetch(String traineeId) async {
    final json =
        await _http.get<Map<String, dynamic>>('/api/admin/trainees/$traineeId');
    return TraineeDetailView.fromJson(json);
  }
}

final traineeDetailRepositoryProvider =
    Provider<TraineeDetailRepository>((ref) {
  return HttpTraineeDetailRepository(ref.watch(authedHttpProvider));
});

final traineeDetailProvider =
    FutureProvider.family<TraineeDetailView, String>((ref, traineeId) {
  return ref.watch(traineeDetailRepositoryProvider).fetch(traineeId);
});
