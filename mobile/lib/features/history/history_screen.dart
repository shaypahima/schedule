import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
          // Group entries by year-month.
          final months = _groupByMonth(entries);
          return ListView.builder(
            itemCount: months.length,
            itemBuilder: (_, i) {
              final m = months[i];
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                    child: Text(
                      _monthLabel(m.year, m.month),
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            color: Theme.of(context).colorScheme.primary,
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                  ),
                  for (final e in m.entries)
                    _HistoryTile(entry: e),
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
    result.sort((a, b) =>
        b.year.compareTo(a.year) != 0 ? b.year.compareTo(a.year) : b.month.compareTo(a.month));
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
    final cs = Theme.of(context).colorScheme;
    final (icon, color, label) = _decoration(cs, entry.status, entry.isPast);
    final day = int.parse(entry.date.substring(8, 10));
    final mon = int.parse(entry.date.substring(5, 7));

    return ListTile(
      key: Key('history-tile-${entry.bookingId}'),
      leading: CircleAvatar(
        backgroundColor: color.withValues(alpha: 0.15),
        child: Icon(icon, color: color),
      ),
      title: Text('${entry.startTime} • $day.$mon'),
      subtitle: Text(label),
      dense: true,
    );
  }

  (IconData, Color, String) _decoration(ColorScheme cs, String status, bool isPast) {
    switch (status) {
      case 'confirmed':
        return isPast
            ? (Icons.check_circle, Colors.green.shade700, 'הושלם')
            : (Icons.event, cs.primary, 'אישור');
      case 'cancelled':
        return (Icons.cancel_outlined, cs.error, 'בוטל');
      case 'no_show':
        return (Icons.report_gmailerrorred, Colors.orange.shade800, 'לא הגיע');
      default:
        return (Icons.help_outline, cs.outline, status);
    }
  }
}
