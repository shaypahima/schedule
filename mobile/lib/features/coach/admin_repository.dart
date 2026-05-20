import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../profile/profile_repository.dart';

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
  final String status; // 'pending' | 'active' | 'deactivated'
  final bool isRecurring;
  final int? preferredDay;
  final String? preferredTime;

  const TraineeRecord({
    required this.id,
    required this.name,
    required this.status,
    required this.isRecurring,
    this.email,
    this.preferredDay,
    this.preferredTime,
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
      );
}

abstract class AdminRepository {
  Future<List<AdminBooking>> fetchBookings({String? date});
  Future<List<TraineeOption>> fetchTrainees();
  Future<List<TraineeRecord>> listTrainees();
  Future<void> addBooking({required String traineeId, required String slotId, required String traineeName});
  Future<void> removeBooking(String bookingId);
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
}

class HttpAdminRepository implements AdminRepository {
  final Dio _dio;
  final SupabaseClient _supabase;
  HttpAdminRepository(this._dio, this._supabase);

  Options _opts() => Options(headers: {
        'Authorization': 'Bearer ${_supabase.auth.currentSession?.accessToken ?? ""}',
      });

  @override
  Future<List<AdminBooking>> fetchBookings({String? date}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/api/admin/bookings',
      queryParameters: date != null ? {'date': date} : null,
      options: _opts(),
    );
    final list = (res.data!['bookings'] as List).cast<Map<String, dynamic>>();
    return list.map(AdminBooking.fromJson).toList();
  }

  @override
  Future<List<TraineeOption>> fetchTrainees() async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/api/admin/trainees',
      options: _opts(),
    );
    final list = (res.data!['trainees'] as List).cast<Map<String, dynamic>>();
    return list.map(TraineeOption.fromJson).toList();
  }

  @override
  Future<void> addBooking({required String traineeId, required String slotId, required String traineeName}) async {
    await _dio.post<void>(
      '/api/admin/bookings',
      data: {'traineeId': traineeId, 'slotId': slotId, 'traineeName': traineeName},
      options: _opts(),
    );
  }

  @override
  Future<void> removeBooking(String bookingId) async {
    await _dio.delete<void>(
      '/api/admin/bookings',
      data: {'bookingId': bookingId},
      options: _opts(),
    );
  }

  @override
  Future<List<TraineeRecord>> listTrainees() async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/api/admin/trainees',
      options: _opts(),
    );
    final list = (res.data!['trainees'] as List).cast<Map<String, dynamic>>();
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
    await _dio.post<void>(
      '/api/admin/trainees',
      data: {
        'email': email,
        'name': name,
        'isRecurring': isRecurring,
        'preferredDay': preferredDay,
        'preferredTime': preferredTime,
      },
      options: _opts(),
    );
  }

  @override
  Future<void> resendInvite(String email) async {
    await _dio.post<void>(
      '/api/admin/trainees',
      data: {'email': email, 'name': '_resend', 'resend': true},
      options: _opts(),
    );
  }

  @override
  Future<void> updateTrainee(String id, Map<String, dynamic> updates) async {
    await _dio.patch<void>(
      '/api/admin/trainees',
      data: {'id': id, ...updates},
      options: _opts(),
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
    await _dio.patch<void>(
      '/api/admin/slots',
      data: {
        ?slotId == null ? null : 'slotId': slotId,
        ?date == null ? null : 'date': date,
        ?startTime == null ? null : 'startTime': startTime,
        ?capacity == null ? null : 'capacity': capacity,
        ?lockoutOverride == null ? null : 'lockoutOverride': lockoutOverride,
      },
      options: _opts(),
    );
  }

  @override
  Future<void> resetEdits(String traineeId) async {
    await _dio.post<void>(
      '/api/admin/edits',
      data: {'traineeId': traineeId},
      options: _opts(),
    );
  }
}

final adminRepositoryProvider = Provider<AdminRepository>((ref) {
  return HttpAdminRepository(ref.watch(dioProvider), Supabase.instance.client);
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
