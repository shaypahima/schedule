import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../profile/profile_repository.dart';
import 'booking.dart';

class BookingFailure implements Exception {
  final String message;
  final int? statusCode;
  const BookingFailure(this.message, {this.statusCode});
  @override
  String toString() => 'BookingFailure: $message';
}

abstract class BookingRepository {
  Future<Booking> book(String slotId);
  Future<List<Booking>> fetchMyBookings();
}

class HttpBookingRepository implements BookingRepository {
  final Dio _dio;
  final SupabaseClient _supabase;

  HttpBookingRepository(this._dio, this._supabase);

  String _jwt() {
    final t = _supabase.auth.currentSession?.accessToken;
    if (t == null) throw const BookingFailure('Not authenticated');
    return t;
  }

  @override
  Future<Booking> book(String slotId) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/api/bookings',
        data: {'slotId': slotId},
        options: Options(headers: {'Authorization': 'Bearer ${_jwt()}'}),
      );
      return Booking.fromJson(res.data!['booking'] as Map<String, dynamic>);
    } on DioException catch (e) {
      final msg = e.response?.data is Map
          ? (e.response!.data as Map)['error']?.toString()
          : null;
      throw BookingFailure(msg ?? e.message ?? 'booking failed', statusCode: e.response?.statusCode);
    }
  }

  @override
  Future<List<Booking>> fetchMyBookings() async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/api/bookings',
      options: Options(headers: {'Authorization': 'Bearer ${_jwt()}'}),
    );
    final list = (res.data!['bookings'] as List).cast<Map<String, dynamic>>();
    return list.map(Booking.fromJson).toList();
  }
}

final bookingRepositoryProvider = Provider<BookingRepository>((ref) {
  return HttpBookingRepository(ref.watch(dioProvider), Supabase.instance.client);
});

final myBookingsProvider = FutureProvider<List<Booking>>((ref) {
  return ref.watch(bookingRepositoryProvider).fetchMyBookings();
});
