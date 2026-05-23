import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/spacing.dart';
import '../../design/widgets.dart';
import '../../theme.dart';
import 'history_repository.dart';

class HistoryScreen extends ConsumerWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(historyProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('היסטוריית אימונים')),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(
          child: Text('שגיאה: $err', key: const Key('history-error')),
        ),
        data: (entries) {
          if (entries.isEmpty) {
            return const Center(
              key: Key('history-empty'),
              child: Text('עדיין אין היסטוריית אימונים'),
            );
          }
          final months = _groupByMonth(entries);
          return ListView.builder(
            padding: const EdgeInsets.only(bottom: AppSpacing.lg),
            itemCount: months.length,
            itemBuilder: (_, i) {
              final m = months[i];
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.lg,
                      AppSpacing.lg,
                      AppSpacing.lg,
                      AppSpacing.xs,
                    ),
                    child: SectionHeader(_monthLabel(m.year, m.month)),
                  ),
                  for (final e in m.entries) _HistoryTile(entry: e),
                ],
              );
            },
          );
        },
      ),
    );
  }

  static List<_Month> _groupByMonth(List<HistoryEntry> entries) {
    final map = <String, _Month>{};
    for (final e in entries) {
      final y = int.parse(e.date.substring(0, 4));
      final m = int.parse(e.date.substring(5, 7));
      final key = '$y-$m';
      map.putIfAbsent(key, () => _Month(y, m, []));
      map[key]!.entries.add(e);
    }
    final result = map.values.toList();
    result.sort((a, b) => b.year.compareTo(a.year) != 0
        ? b.year.compareTo(a.year)
        : b.month.compareTo(a.month));
    return result;
  }

  static String _monthLabel(int year, int month) {
    const names = [
      '', 'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
      'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
    ];
    return '${names[month]} $year';
  }
}

class _Month {
  final int year;
  final int month;
  final List<HistoryEntry> entries;
  _Month(this.year, this.month, this.entries);
}

class _HistoryTile extends StatelessWidget {
  final HistoryEntry entry;
  const _HistoryTile({required this.entry});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final (stripe, label) = _decoration(entry.status, entry.isPast);
    final day = int.parse(entry.date.substring(8, 10));
    final mon = int.parse(entry.date.substring(5, 7));

    return StatusStripeTile(
      key: Key('history-tile-${entry.bookingId}'),
      stripeColor: stripe,
      title: Text(
        '${entry.startTime}  ·  $day.$mon',
        style: theme.textTheme.titleMedium,
      ),
      subtitle: Text(
        label,
        style: theme.textTheme.bodySmall?.copyWith(color: stripe),
      ),
    );
  }

  (Color, String) _decoration(String status, bool isPast) {
    switch (status) {
      case 'confirmed':
        return isPast
            ? (BrandColors.success, 'הושלם')
            : (BrandColors.teal, 'מתוכנן');
      case 'cancelled':
        return (BrandColors.inkMuted, 'בוטל');
      case 'no_show':
        return (BrandColors.orange, 'לא הגיע');
      default:
        return (BrandColors.inkMuted, status);
    }
  }
}
