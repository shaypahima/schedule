import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../utils/authed_http_client.dart';

class HistoryEntry {
  final String bookingId;
  final String slotId;
  final String date; // YYYY-MM-DD
  final String startTime; // HH:mm
  final String status; // confirmed | cancelled | no_show
  final String startsAt; // ISO
  final bool isPast;

  const HistoryEntry({
    required this.bookingId,
    required this.slotId,
    required this.date,
    required this.startTime,
    required this.status,
    required this.startsAt,
    required this.isPast,
  });

  factory HistoryEntry.fromJson(Map<String, dynamic> json) => HistoryEntry(
        bookingId: json['bookingId'] as String,
        slotId: json['slotId'] as String,
        date: json['date'] as String,
        startTime: json['startTime'] as String,
        status: json['status'] as String,
        startsAt: json['startsAt'] as String,
        isPast: json['isPast'] as bool? ?? false,
      );
}

abstract class HistoryRepository {
  Future<List<HistoryEntry>> fetch();
}

class HttpHistoryRepository implements HistoryRepository {
  final AuthedHttpClient _http;
  HttpHistoryRepository(this._http);

  @override
  Future<List<HistoryEntry>> fetch() async {
    final json = await _http.get<Map<String, dynamic>>('/api/me/history');
    final list = (json['history'] as List).cast<Map<String, dynamic>>();
    return list.map(HistoryEntry.fromJson).toList();
  }
}

final historyRepositoryProvider = Provider<HistoryRepository>(
  (ref) => HttpHistoryRepository(ref.watch(authedHttpProvider)),
);

final historyProvider = FutureProvider<List<HistoryEntry>>(
  (ref) => ref.watch(historyRepositoryProvider).fetch(),
);
