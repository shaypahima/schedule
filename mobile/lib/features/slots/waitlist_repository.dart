import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../utils/authed_http_client.dart';

/// Waitlist (ADR-0012): a notification subscription on a full slot —
/// join/leave hold nothing; first to book a freed spot wins.
abstract class WaitlistRepository {
  Future<void> join(String slotId);
  Future<void> leave(String slotId);

  /// Slot ids the signed-in trainee is waitlisted on (future slots only).
  Future<Set<String>> mySlotIds();
}

class HttpWaitlistRepository implements WaitlistRepository {
  final AuthedHttpClient _http;

  HttpWaitlistRepository(this._http);

  @override
  Future<void> join(String slotId) =>
      _http.post<Map<String, dynamic>>('/api/slots/$slotId/waitlist');

  @override
  Future<void> leave(String slotId) =>
      _http.delete<Map<String, dynamic>>('/api/slots/$slotId/waitlist');

  @override
  Future<Set<String>> mySlotIds() async {
    final json = await _http.get<Map<String, dynamic>>('/api/me/waitlist');
    return (json['slotIds'] as List).cast<String>().toSet();
  }
}

final waitlistRepositoryProvider = Provider<WaitlistRepository>((ref) {
  return HttpWaitlistRepository(ref.watch(authedHttpProvider));
});

final myWaitlistProvider = FutureProvider<Set<String>>((ref) {
  return ref.watch(waitlistRepositoryProvider).mySlotIds();
});
