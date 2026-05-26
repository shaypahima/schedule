import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/spacing.dart';
import '../../design/widgets.dart';
import '../../theme.dart';
import 'change_requests_repository.dart';

class ChangeRequestsScreen extends ConsumerWidget {
  const ChangeRequestsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(changeRequestsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('בקשות שינוי')),
      body: async.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(AppSpacing.md),
          child: SkeletonList(count: 3),
        ),
        error: (err, _) => ErrorCard(
          key: const Key('change-requests-error'),
          message: 'שגיאה בטעינת הבקשות',
          onRetry: () => ref.invalidate(changeRequestsProvider),
        ),
        data: (requests) {
          if (requests.isEmpty) {
            return const Padding(
              key: Key('change-requests-empty'),
              padding: EdgeInsets.symmetric(vertical: AppSpacing.sm),
              child: EmptyState(
                icon: Icons.inbox_outlined,
                headline: 'אין בקשות שינוי פתוחות',
                helper: 'כשמתאמן יבקש ביטול בתוך 24 שעות הבקשה תופיע כאן',
              ),
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
    final initial = r.traineeName.isNotEmpty ? r.traineeName.characters.first : '?';
    return Padding(
      key: Key('cr-tile-${r.id}'),
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        AppSpacing.sm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                backgroundColor: r.traineeName.isEmpty
                    ? BrandColors.line
                    : Theme.of(context).colorScheme.primaryContainer,
                child: Text(
                  initial,
                  style: TextStyle(
                    color: r.traineeName.isEmpty
                        ? BrandColors.inkMuted
                        : BrandColors.tealDark,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      r.traineeName.isEmpty ? '—' : r.traineeName,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
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
            const SizedBox(height: AppSpacing.xs),
            Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'סיבה',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: BrandColors.inkSoft,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.4,
                        ),
                  ),
                  const SizedBox(height: 2),
                  Text(r.reason),
                ],
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                child: FilledButton.tonal(
                  key: Key('reject-${r.id}'),
                  onPressed: _busy ? null : () => _decide('reject'),
                  child: const Text('דחה'),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
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
