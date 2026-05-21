import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../utils/authed_http_client.dart';
import 'booking.dart';

class BookingFailure implements Exception {
  final String message;
  final int? statusCode;
  const BookingFailure(this.message, {this.statusCode});
  @override
  String toString() => 'BookingFailure: $message';
}

class MyBookingsView {
  final List<Booking> bookings;
  final int remainingEdits;
  const MyBookingsView({required this.bookings, required this.remainingEdits});
}

abstract class BookingRepository {
  Future<Booking> book(String slotId);
  Future<MyBookingsView> fetchMyBookings();
  Future<void> cancel(String bookingId);
  Future<Booking> reschedule(String bookingId, String newSlotId);
}

class HttpBookingRepository implements BookingRepository {
  final AuthedHttpClient _http;

  HttpBookingRepository(this._http);

  BookingFailure _bookingFailure(ApiException e, String fallback) =>
      BookingFailure(
        e.body?['error']?.toString() ?? (e.code.isEmpty ? fallback : e.code),
        statusCode: e.status,
      );

  @override
  Future<Booking> book(String slotId) async {
    try {
      final json = await _http.post<Map<String, dynamic>>(
        '/api/bookings',
        data: {'slotId': slotId},
      );
      return Booking.fromJson(json['booking'] as Map<String, dynamic>);
    } on ApiException catch (e) {
      throw _bookingFailure(e, 'booking failed');
    }
  }

  @override
  Future<MyBookingsView> fetchMyBookings() async {
    final json = await _http.get<Map<String, dynamic>>('/api/bookings');
    final list = (json['bookings'] as List).cast<Map<String, dynamic>>();
    return MyBookingsView(
      bookings: list.map(Booking.fromJson).toList(),
      remainingEdits: (json['remainingEdits'] as num).toInt(),
    );
  }

  @override
  Future<void> cancel(String bookingId) async {
    try {
      await _http.delete<void>('/api/bookings', data: {'bookingId': bookingId});
    } on ApiException catch (e) {
      throw _bookingFailure(e, 'cancel failed');
    }
  }

  @override
  Future<Booking> reschedule(String bookingId, String newSlotId) async {
    try {
      final json = await _http.patch<Map<String, dynamic>>(
        '/api/bookings',
        data: {'bookingId': bookingId, 'newSlotId': newSlotId},
      );
      return Booking.fromJson(json['booking'] as Map<String, dynamic>);
    } on ApiException catch (e) {
      throw _bookingFailure(e, 'reschedule failed');
    }
  }
}

final bookingRepositoryProvider = Provider<BookingRepository>((ref) {
  return HttpBookingRepository(ref.watch(authedHttpProvider));
});

final myBookingsProvider = FutureProvider<MyBookingsView>((ref) {
  return ref.watch(bookingRepositoryProvider).fetchMyBookings();
});
