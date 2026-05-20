import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../utils/week_dates.dart';
import '../profile/profile_screen.dart';
import '../slots/slot.dart';
import '../slots/slot_repository.dart';
import 'admin_repository.dart';
import 'coach_trainees_screen.dart';

class CoachWeekScreen extends ConsumerStatefulWidget {
  final DateTime now;
  CoachWeekScreen({super.key, DateTime? now}) : now = now ?? DateTime.now();

  @override
  ConsumerState<CoachWeekScreen> createState() => _CoachWeekScreenState();
}

class _CoachWeekScreenState extends ConsumerState<CoachWeekScreen> {
  late int _weekOffset;
  late int _selectedIndex;

  @override
  void initState() {
    super.initState();
    _weekOffset = 0;
    final todayIdx = widget.now.weekday % 7;
    _selectedIndex = todayIdx > 5 ? 0 : todayIdx;
  }

  List<DateTime> get _weekDates {
    final base = widget.now.add(Duration(days: _weekOffset * 7));
    return currentWeekSunToFri(base);
  }

  String get _selectedDate => formatDate(_weekDates[_selectedIndex]);

  @override
  Widget build(BuildContext context) {
    final slotsAsync = ref.watch(slotsForDateProvider(_selectedDate));
    final bookingsAsync = ref.watch(adminBookingsForDateProvider(_selectedDate));

    return Scaffold(
      appBar: AppBar(
        title: const Text('שבוע המאמן'),
        actions: [
          IconButton(
            key: const Key('trainees-button'),
            tooltip: 'מתאמנים',
            icon: const Icon(Icons.group),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const CoachTraineesScreen()),
            ),
          ),
          IconButton(
            key: const Key('profile-button'),
            icon: const Icon(Icons.person),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const ProfileScreen()),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                IconButton(
                  key: const Key('week-prev'),
                  icon: const Icon(Icons.chevron_right), // RTL: right = previous
                  onPressed: () => setState(() => _weekOffset--),
                ),
                Text(
                  '${formatDate(_weekDates.first)} – ${formatDate(_weekDates.last)}',
                  key: const Key('week-range'),
                ),
                IconButton(
                  key: const Key('week-next'),
                  icon: const Icon(Icons.chevron_left), // RTL: left = next
                  onPressed: () => setState(() => _weekOffset++),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                for (var i = 0; i < 6; i++)
                  InkWell(
                    key: Key('day-chip-$i'),
                    onTap: () => setState(() => _selectedIndex = i),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 12),
                      decoration: BoxDecoration(
                        color: i == _selectedIndex
                            ? Theme.of(context).colorScheme.primaryContainer
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Column(
                        children: [
                          Text(hebrewDayShort[i],
                              style: Theme.of(context).textTheme.titleLarge),
                          Text(
                            '${_weekDates[i].day}/${_weekDates[i].month}',
                            style: Theme.of(context).textTheme.labelSmall,
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: slotsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (err, _) => Center(child: Text('שגיאה: $err')),
              data: (slots) {
                final bookings = bookingsAsync.valueOrNull ?? [];
                final bySlot = <String, List<AdminBooking>>{};
                for (final b in bookings) {
                  bySlot.putIfAbsent(b.slotId, () => []).add(b);
                }
                if (slots.isEmpty) {
                  return const Center(child: Text('אין שעות פנויות'));
                }
                return ListView.separated(
                  itemCount: slots.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (_, i) {
                    final slot = slots[i];
                    final slotBookings = bySlot[slot.id] ?? const [];
                    return _CoachSlotTile(slot: slot, bookings: slotBookings);
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _CoachSlotTile extends ConsumerWidget {
  final Slot slot;
  final List<AdminBooking> bookings;
  const _CoachSlotTile({required this.slot, required this.bookings});

  Future<void> _openAddTraineeSheet(BuildContext context, WidgetRef ref) async {
    final selected = await showModalBottomSheet<TraineeOption>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => const _TraineePickerSheet(),
    );
    if (selected == null || !context.mounted) return;
    try {
      await ref.read(adminRepositoryProvider).addBooking(
            traineeId: selected.id,
            slotId: slot.id,
            traineeName: selected.name,
          );
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${selected.name} נוסף לשעה ${slot.startTime}')),
      );
      ref.invalidate(adminBookingsForDateProvider);
      ref.invalidate(slotsForDateProvider);
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('שגיאה: $e')));
    }
  }

  Future<void> _confirmRemove(BuildContext context, WidgetRef ref, AdminBooking booking) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        key: const Key('remove-booking-dialog'),
        title: Text('להסיר את ${booking.traineeName ?? "המתאמן"} מהשעה?'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('לא')),
          FilledButton(onPressed: () => Navigator.of(ctx).pop(true), child: const Text('כן, הסר')),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    try {
      await ref.read(adminRepositoryProvider).removeBooking(booking.id);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('הוסר')));
      ref.invalidate(adminBookingsForDateProvider);
      ref.invalidate(slotsForDateProvider);
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('שגיאה: $e')));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      key: Key('coach-slot-${slot.startTime}'),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '${slot.startTime}  (${bookings.length}/${slot.capacity})',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              if (bookings.length < slot.capacity)
                IconButton(
                  key: Key('add-trainee-${slot.id}'),
                  icon: const Icon(Icons.person_add),
                  tooltip: 'הוסף מתאמן',
                  onPressed: () => _openAddTraineeSheet(context, ref),
                ),
            ],
          ),
          for (final b in bookings)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(
                children: [
                  Expanded(
                    child: Text(b.traineeName ?? b.traineeId,
                        key: Key('booking-name-${b.id}')),
                  ),
                  IconButton(
                    key: Key('remove-booking-${b.id}'),
                    icon: const Icon(Icons.remove_circle_outline),
                    onPressed: () => _confirmRemove(context, ref, b),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _TraineePickerSheet extends ConsumerStatefulWidget {
  const _TraineePickerSheet();

  @override
  ConsumerState<_TraineePickerSheet> createState() => _TraineePickerSheetState();
}

class _TraineePickerSheetState extends ConsumerState<_TraineePickerSheet> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(adminTraineesProvider);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              key: const Key('trainee-search'),
              decoration: const InputDecoration(labelText: 'חפש מתאמן'),
              onChanged: (v) => setState(() => _query = v),
            ),
            const SizedBox(height: 8),
            ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.6,
              ),
              child: async.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (err, _) => Center(child: Text('שגיאה: $err')),
                data: (trainees) {
                  final filtered = trainees
                      .where((t) =>
                          _query.isEmpty || t.name.contains(_query))
                      .toList();
                  return ListView.builder(
                    shrinkWrap: true,
                    itemCount: filtered.length,
                    itemBuilder: (_, i) => ListTile(
                      key: Key('trainee-option-${filtered[i].id}'),
                      title: Text(filtered[i].name),
                      onTap: () => Navigator.of(context).pop(filtered[i]),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
