import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'change_requests_repository.dart';

class ChangeRequestsScreen extends ConsumerWidget {
  const ChangeRequestsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(changeRequestsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('בקשות שינוי')),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(
          child: Text('שגיאה: $err', key: const Key('change-requests-error')),
        ),
        data: (requests) {
          if (requests.isEmpty) {
            return const Center(
              key: Key('change-requests-empty'),
              child: Text('אין בקשות שינוי פתוחות'),
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(changeRequestsProvider),
            child: ListView.separated(
              itemCount: requests.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (_, i) => _RequestTile(request: requests[i]),
            ),
          );
        },
      ),
    );
  }
}

class _RequestTile extends ConsumerStatefulWidget {
  final ChangeRequest request;
  const _RequestTile({required this.request});

  @override
  ConsumerState<_RequestTile> createState() => _RequestTileState();
}

class _RequestTileState extends ConsumerState<_RequestTile> {
  bool _busy = false;

  Future<void> _decide(String decision) async {
    setState(() => _busy = true);
    try {
      await ref.read(changeRequestsRepositoryProvider).decide(
            widget.request.id,
            decision: decision,
          );
      ref.invalidate(changeRequestsProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(decision == 'approve' ? 'אושר' : 'נדחה')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('שגיאה: $e')),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.request;
    return Padding(
      key: Key('cr-tile-${r.id}'),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                backgroundColor: Theme.of(context).colorScheme.primaryContainer,
                child: Text(r.traineeName.characters.first),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(r.traineeName,
                        style: Theme.of(context).textTheme.titleMedium),
                    Text(
                      r.isCancelRequest
                          ? 'בקשת ביטול: ${_fmt(r.fromSlotStartsAt)}'
                          : 'בקשת העברה: ${_fmt(r.fromSlotStartsAt)} → ${_fmt(r.toSlotStartsAt!)}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (r.reason.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(r.reason),
            ),
          ],
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: FilledButton.tonal(
                  key: Key('reject-${r.id}'),
                  onPressed: _busy ? null : () => _decide('reject'),
                  child: const Text('דחה'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  key: Key('approve-${r.id}'),
                  onPressed: _busy ? null : () => _decide('approve'),
                  child: const Text('אישור'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _fmt(String iso) {
    final d = DateTime.parse(iso).toLocal();
    final hh = d.hour.toString().padLeft(2, '0');
    final mm = d.minute.toString().padLeft(2, '0');
    return '${d.day}.${d.month} $hh:$mm';
  }
}
