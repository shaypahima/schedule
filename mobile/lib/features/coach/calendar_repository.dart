import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../utils/authed_http_client.dart';

class CalendarStatus {
  final bool connected;
  final bool mock;
  const CalendarStatus({required this.connected, required this.mock});
}

abstract class CalendarRepository {
  Future<CalendarStatus> status();
  Future<String> getAuthUrl();
}

class HttpCalendarRepository implements CalendarRepository {
  final AuthedHttpClient _http;
  HttpCalendarRepository(this._http);

  @override
  Future<CalendarStatus> status() async {
    final json = await _http.get<Map<String, dynamic>>('/api/coach-calendar/status');
    return CalendarStatus(
      connected: (json['connected'] as bool?) ?? false,
      mock: (json['mock'] as bool?) ?? false,
    );
  }

  @override
  Future<String> getAuthUrl() async {
    final json = await _http.get<Map<String, dynamic>>('/api/coach-calendar/url');
    return json['authUrl'] as String;
  }
}

final calendarRepositoryProvider = Provider<CalendarRepository>((ref) {
  return HttpCalendarRepository(ref.watch(authedHttpProvider));
});

final calendarStatusProvider = FutureProvider<CalendarStatus>((ref) {
  return ref.watch(calendarRepositoryProvider).status();
});
