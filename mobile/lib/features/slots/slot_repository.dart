import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../profile/profile_repository.dart';
import 'slot.dart';

abstract class SlotRepository {
  Future<List<Slot>> fetchSlots(String date);
}

class HttpSlotRepository implements SlotRepository {
  final Dio _dio;
  final SupabaseClient _supabase;

  HttpSlotRepository(this._dio, this._supabase);

  @override
  Future<List<Slot>> fetchSlots(String date) async {
    final jwt = _supabase.auth.currentSession?.accessToken;
    if (jwt == null) throw StateError('Not authenticated');
    final res = await _dio.get<Map<String, dynamic>>(
      '/api/slots',
      queryParameters: {'date': date},
      options: Options(headers: {'Authorization': 'Bearer $jwt'}),
    );
    final list = (res.data!['slots'] as List).cast<Map<String, dynamic>>();
    return list.map(Slot.fromJson).toList();
  }
}

final slotRepositoryProvider = Provider<SlotRepository>((ref) {
  return HttpSlotRepository(ref.watch(dioProvider), Supabase.instance.client);
});

final slotsForDateProvider =
    FutureProvider.family<List<Slot>, String>((ref, date) {
  return ref.watch(slotRepositoryProvider).fetchSlots(date);
});
