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

abstract class AdminRepository {
  Future<List<AdminBooking>> fetchBookings({String? date});
  Future<List<TraineeOption>> fetchTrainees();
  Future<void> addBooking({required String traineeId, required String slotId, required String traineeName});
  Future<void> removeBooking(String bookingId);
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
