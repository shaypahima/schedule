import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/spacing.dart';
import '../../design/widgets.dart';
import 'measurement_logger_sheet.dart';
import 'progress.dart';
import 'progress_repository.dart';
import 'weight_chart.dart';

class ProgressScreen extends ConsumerWidget {
  const ProgressScreen({super.key});

  Future<void> _openLogger(BuildContext context) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const MeasurementLoggerSheet(),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(progressProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('ההתקדמות שלי')),
      floatingActionButton: FloatingActionButton.extended(
        key: const Key('progress-log-fab'),
        onPressed: () => _openLogger(context),
        icon: const Icon(Icons.add),
        label: const Text('תעד'),
      ),
      body: async.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(AppSpacing.md),
          child: SkeletonList(),
        ),
        error: (err, _) => Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: ErrorCard(
            message: 'שגיאה בטעינת ההתקדמות',
            onRetry: () => ref.invalidate(progressProvider),
          ),
        ),
        data: (view) => RefreshIndicator(
          onRefresh: () async => ref.refresh(progressProvider.future),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.md,
              AppSpacing.md,
              AppSpacing.md,
              80,
            ),
            children: [
              _LastSnapshot(view: view),
              const SizedBox(height: AppSpacing.lg),
              const SectionHeader('משקל לאורך זמן'),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: WeightChart(measurements: view.measurements),
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              const SectionHeader('יומן אחרון'),
              if (view.measurements.isEmpty)
                const EmptyState(
                  icon: Icons.timeline,
                  headline: 'עוד אין תיעודים',
                  helper: 'כפתור התיעוד למטה — אפילו שורה אחת זה התחלה',
                )
              else
                for (final m in view.measurements.take(20))
                  _LogRow(key: Key('log-row-${m.id}'), log: m),
            ],
          ),
        ),
      ),
    );
  }
}

class _LastSnapshot extends StatelessWidget {
  final ProgressView view;
  const _LastSnapshot({required this.view});

  @override
  Widget build(BuildContext context) {
    final last = view.lastMeasurement;
    if (last == null) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Text(
            'אין נתונים עדיין — תיעוד ראשון פותח גרף',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ),
      );
    }
    final w = last.weightKg;
    final delta = _weeklyDelta(view.measurements);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    w != null ? '${w.toStringAsFixed(1)} ק"ג' : '—',
                    style: Theme.of(context).textTheme.displaySmall,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'מדידה אחרונה ${_relativeTime(last.loggedAt)}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                  ),
                ],
              ),
            ),
            if (delta != null)
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: AppSpacing.xs,
                ),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(AppSpacing.radiusPill),
                ),
                child: Text(
                  delta,
                  style: Theme.of(context).textTheme.labelMedium,
                ),
              ),
          ],
        ),
      ),
    );
  }

  static String? _weeklyDelta(List<MeasurementLog> ms) {
    final withWeight = ms.where((m) => m.weightKg != null).toList();
    if (withWeight.length < 2) return null;
    final newest = withWeight.first;
    final cutoff = newest.loggedAt.subtract(const Duration(days: 14));
    final older = withWeight.firstWhere(
      (m) => m.loggedAt.isBefore(cutoff) || m == withWeight.last,
      orElse: () => withWeight.last,
    );
    if (older.id == newest.id) return null;
    final diff = newest.weightKg! - older.weightKg!;
    if (diff.abs() < 0.1) return '⟷ יציב';
    final sign = diff > 0 ? '+' : '';
    return '$sign${diff.toStringAsFixed(1)} ק"ג';
  }

  static String _relativeTime(DateTime t) {
    final diff = DateTime.now().difference(t);
    if (diff.inDays > 1) return 'לפני ${diff.inDays} ימים';
    if (diff.inDays == 1) return 'אתמול';
    if (diff.inHours >= 1) return 'לפני ${diff.inHours}ש׳';
    return 'הרגע';
  }
}

class _LogRow extends StatelessWidget {
  final MeasurementLog log;
  const _LogRow({super.key, required this.log});

  @override
  Widget build(BuildContext context) {
    final parts = <String>[];
    if (log.weightKg != null) {
      parts.add('${log.weightKg!.toStringAsFixed(1)} ק"ג');
    }
    final metrics = log.metrics;
    if (metrics != null) {
      final e = metrics['energy_1to5'];
      final s = metrics['soreness_1to5'];
      if (e is num) parts.add('אנרגיה $e');
      if (s is num) parts.add('כאב $s');
    }
    return Card(
      child: ListTile(
        title: Text(
          parts.isEmpty ? (log.note ?? '—') : parts.join('  •  '),
        ),
        subtitle: log.note != null && parts.isNotEmpty
            ? Text(
                log.note!,
                style: Theme.of(context).textTheme.bodySmall,
              )
            : null,
        trailing: Text(
          '${log.loggedAt.day}/${log.loggedAt.month}',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
        ),
      ),
    );
  }
}
