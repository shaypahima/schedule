import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../utils/authed_http_client.dart';

class AdminBooking {
  final String id;
  final String slotId;
  final String traineeId;
  final String? traineeName;
  final String? slotDate;
  final String? startTime;
  const AdminBooking({
    required this.id,
    required this.slotId,
    required this.traineeId,
    this.traineeName,
    this.slotDate,
    this.startTime,
  });

  factory AdminBooking.fromJson(Map<String, dynamic> json) => AdminBooking(
        id: json['id'] as String,
        slotId: json['slotId'] as String,
        traineeId: json['traineeId'] as String,
        traineeName: json['traineeName'] as String?,
        slotDate: json['slotDate'] as String?,
        startTime: json['startTime'] as String?,
      );
}

class TraineeOption {
  final String id;
  final String name;
  const TraineeOption({required this.id, required this.name});
  factory TraineeOption.fromJson(Map<String, dynamic> json) =>
      TraineeOption(id: json['id'] as String, name: json['name'] as String);
}

class TraineeRecord {
  final String id;
  final String name;
  final String? email;
  final String status; // 'pending' | 'active' | 'deactivated' | 'rejected'
  final bool isRecurring;
  final int? preferredDay;
  final String? preferredTime;
  // Progress aggregates (#62) — null when the trainee hasn't logged / attended.
  final double? lastWeightKg;
  final String? weightTrend14d; // 'up' | 'flat' | 'down'
  final DateTime? lastMeasurementAt;
  final double? attendanceRate; // 0..1

  const TraineeRecord({
    required this.id,
    required this.name,
    required this.status,
    required this.isRecurring,
    this.email,
    this.preferredDay,
    this.preferredTime,
    this.lastWeightKg,
    this.weightTrend14d,
    this.lastMeasurementAt,
    this.attendanceRate,
  });

  factory TraineeRecord.fromJson(Map<String, dynamic> json) => TraineeRecord(
        id: json['id'] as String,
        name: json['name'] as String,
        email: json['email'] as String?,
        status: (json['status'] as String?) ??
            ((json['isActive'] as bool? ?? true) ? 'active' : 'deactivated'),
        isRecurring: json['isRecurring'] as bool? ?? false,
        preferredDay: json['preferredDay'] as int?,
        preferredTime: json['preferredTime'] as String?,
        lastWeightKg: (json['lastWeightKg'] as num?)?.toDouble(),
        weightTrend14d: json['weightTrend14d'] as String?,
        lastMeasurementAt: json['lastMeasurementAt'] == null
            ? null
            : DateTime.parse(json['lastMeasurementAt'] as String),
        attendanceRate: (json['attendanceRate'] as num?)?.toDouble(),
      );
}

abstract class AdminRepository {
  Future<List<AdminBooking>> fetchBookings({String? date});
  Future<List<TraineeOption>> fetchTrainees();
  Future<List<TraineeRecord>> listTrainees();
  Future<void> addBooking({required String traineeId, required String slotId, required String traineeName});
  Future<void> removeBooking(String bookingId);
  /// Phase 16: mark a past confirmed booking as no_show.
  Future<void> markNoShow(String bookingId);
  Future<void> inviteTrainee({
    required String email,
    required String name,
    bool isRecurring = false,
    int? preferredDay,
    String? preferredTime,
  });
  Future<void> resendInvite(String email);
  Future<void> updateTrainee(String id, Map<String, dynamic> updates);
  Future<void> updateSlot({
    String? slotId,
    String? date,
    String? startTime,
    int? capacity,
    bool? lockoutOverride,
  });
  Future<void> resetEdits(String traineeId);

  /// Waitlist size per slot id for a date (slots without entries omitted).
  Future<Map<String, int>> fetchWaitlistCounts(String date);
}

class HttpAdminRepository implements AdminRepository {
  final AuthedHttpClient _http;
  HttpAdminRepository(this._http);

  @override
  Future<List<AdminBooking>> fetchBookings({String? date}) async {
    final json = await _http.get<Map<String, dynamic>>(
      '/api/admin/bookings',
      queryParameters: date != null ? {'date': date} : null,
    );
    final list = (json['bookings'] as List).cast<Map<String, dynamic>>();
    return list.map(AdminBooking.fromJson).toList();
  }

  @override
  Future<List<TraineeOption>> fetchTrainees() async {
    final json = await _http.get<Map<String, dynamic>>('/api/admin/trainees');
    final list = (json['trainees'] as List).cast<Map<String, dynamic>>();
    return list.map(TraineeOption.fromJson).toList();
  }

  @override
  Future<void> addBooking({required String traineeId, required String slotId, required String traineeName}) async {
    await _http.post<void>(
      '/api/admin/bookings',
      data: {'traineeId': traineeId, 'slotId': slotId, 'traineeName': traineeName},
    );
  }

  @override
  Future<void> removeBooking(String bookingId) async {
    await _http.delete<void>(
      '/api/admin/bookings',
      data: {'bookingId': bookingId},
    );
  }

  @override
  Future<void> markNoShow(String bookingId) async {
    await _http.post<void>('/api/admin/bookings/$bookingId/no-show');
  }

  @override
  Future<Map<String, int>> fetchWaitlistCounts(String date) async {
    final json = await _http.get<Map<String, dynamic>>(
      '/api/admin/waitlist',
      queryParameters: {'date': date},
    );
    return (json['counts'] as Map<String, dynamic>)
        .map((k, v) => MapEntry(k, v as int));
  }

  @override
  Future<List<TraineeRecord>> listTrainees() async {
    final json = await _http.get<Map<String, dynamic>>('/api/admin/trainees');
    final list = (json['trainees'] as List).cast<Map<String, dynamic>>();
    return list.map(TraineeRecord.fromJson).toList();
  }

  @override
  Future<void> inviteTrainee({
    required String email,
    required String name,
    bool isRecurring = false,
    int? preferredDay,
    String? preferredTime,
  }) async {
    await _http.post<void>(
      '/api/admin/trainees',
      data: {
        'email': email,
        'name': name,
        'isRecurring': isRecurring,
        'preferredDay': preferredDay,
        'preferredTime': preferredTime,
      },
    );
  }

  @override
  Future<void> resendInvite(String email) async {
    await _http.post<void>(
      '/api/admin/trainees',
      data: {'email': email, 'name': '_resend', 'resend': true},
    );
  }

  @override
  Future<void> updateTrainee(String id, Map<String, dynamic> updates) async {
    await _http.patch<void>(
      '/api/admin/trainees',
      data: {'id': id, ...updates},
    );
  }

  @override
  Future<void> updateSlot({
    String? slotId,
    String? date,
    String? startTime,
    int? capacity,
    bool? lockoutOverride,
  }) async {
    final body = <String, dynamic>{};
    if (slotId != null) body['slotId'] = slotId;
    if (date != null) body['date'] = date;
    if (startTime != null) body['startTime'] = startTime;
    if (capacity != null) body['capacity'] = capacity;
    if (lockoutOverride != null) body['lockoutOverride'] = lockoutOverride;
    await _http.patch<void>('/api/admin/slots', data: body);
  }

  @override
  Future<void> resetEdits(String traineeId) async {
    await _http.post<void>('/api/admin/edits', data: {'traineeId': traineeId});
  }
}

final adminRepositoryProvider = Provider<AdminRepository>((ref) {
  return HttpAdminRepository(ref.watch(authedHttpProvider));
});

final adminBookingsForDateProvider =
    FutureProvider.family<List<AdminBooking>, String>((ref, date) {
  return ref.watch(adminRepositoryProvider).fetchBookings(date: date);
});

final adminTraineesProvider = FutureProvider<List<TraineeOption>>((ref) {
  return ref.watch(adminRepositoryProvider).fetchTrainees();
});

final traineeRecordsProvider = FutureProvider<List<TraineeRecord>>((ref) {
  return ref.watch(adminRepositoryProvider).listTrainees();
});

final waitlistCountsProvider =
    FutureProvider.family<Map<String, int>, String>((ref, date) {
  return ref.watch(adminRepositoryProvider).fetchWaitlistCounts(date);
});
