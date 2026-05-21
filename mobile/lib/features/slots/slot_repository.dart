import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../utils/authed_http_client.dart';
import 'slot.dart';

abstract class SlotRepository {
  Future<List<Slot>> fetchSlots(String date);
}

class HttpSlotRepository implements SlotRepository {
  final AuthedHttpClient _http;

  HttpSlotRepository(this._http);

  @override
  Future<List<Slot>> fetchSlots(String date) async {
    final json = await _http.get<Map<String, dynamic>>(
      '/api/slots',
      queryParameters: {'date': date},
    );
    final list = (json['slots'] as List).cast<Map<String, dynamic>>();
    return list.map(Slot.fromJson).toList();
  }
}

final slotRepositoryProvider = Provider<SlotRepository>((ref) {
  return HttpSlotRepository(ref.watch(authedHttpProvider));
});

final slotsForDateProvider =
    FutureProvider.family<List<Slot>, String>((ref, date) {
  return ref.watch(slotRepositoryProvider).fetchSlots(date);
});
