import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/spacing.dart';
import '../../design/widgets.dart';
import 'approvals_repository.dart';

class PendingApprovalsScreen extends ConsumerWidget {
  const PendingApprovalsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(pendingApprovalsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('בקשות הצטרפות')),
      body: async.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(AppSpacing.md),
          child: SkeletonList(),
        ),
        error: (err, _) => ErrorCard(
          message: 'שגיאה בטעינת הבקשות',
          onRetry: () => ref.invalidate(pendingApprovalsProvider),
        ),
        data: (list) {
          if (list.isEmpty) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: AppSpacing.sm),
              child: EmptyState(
                icon: Icons.how_to_reg_outlined,
                headline: 'אין בקשות הצטרפות חדשות',
                helper: 'כשמתאמן ירצה להצטרף, הוא יופיע כאן',
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(pendingApprovalsProvider),
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
              itemCount: list.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, i) => _PendingTile(approval: list[i]),
            ),
          );
        },
      ),
    );
  }
}

class _PendingTile extends ConsumerStatefulWidget {
  final PendingApproval approval;
  const _PendingTile({required this.approval});

  @override
  ConsumerState<_PendingTile> createState() => _PendingTileState();
}

class _PendingTileState extends ConsumerState<_PendingTile> {
  bool _busy = false;

  Future<void> _act(Future<void> Function() action, String successMsg) async {
    setState(() => _busy = true);
    try {
      await action();
      ref.invalidate(pendingApprovalsProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(successMsg)));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('שגיאה: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = widget.approval;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(a.name, style: Theme.of(context).textTheme.titleMedium),
          if (a.email != null)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(a.email!, style: Theme.of(context).textTheme.bodySmall),
            ),
          if (a.phone != null)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(a.phone!, style: Theme.of(context).textTheme.bodySmall),
            ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  key: Key('reject-${a.id}'),
                  icon: const Icon(Icons.close, size: 18),
                  label: const Text('דחה'),
                  onPressed: _busy
                      ? null
                      : () => _act(
                            () => ref
                                .read(approvalsRepositoryProvider)
                                .reject(a.id),
                            'הבקשה נדחתה',
                          ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: FilledButton.icon(
                  key: Key('approve-${a.id}'),
                  icon: const Icon(Icons.check, size: 18),
                  label: const Text('אשר'),
                  onPressed: _busy
                      ? null
                      : () => _act(
                            () => ref
                                .read(approvalsRepositoryProvider)
                                .approve(a.id),
                            'הבקשה אושרה',
                          ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
