import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../utils/week_dates.dart';
import '../bookings/booking_repository.dart';
import '../profile/profile_screen.dart';
import 'slot.dart';
import 'slot_repository.dart';

class HomeScreen extends ConsumerStatefulWidget {
  final DateTime now;
  HomeScreen({super.key, DateTime? now}) : now = now ?? DateTime.now();

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  late int _selectedIndex;
  late List<DateTime> _weekDates;

  @override
  void initState() {
    super.initState();
    _weekDates = currentWeekSunToFri(widget.now);
    final todayIdx = widget.now.weekday % 7; // Sun=0..Sat=6
    _selectedIndex = todayIdx > 5 ? 0 : todayIdx;
  }

  String get _selectedDate => formatDate(_weekDates[_selectedIndex]);

  Future<void> _openBookingDialog(Slot slot) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        key: const Key('booking-confirm-dialog'),
        title: Text('לקבוע אימון בשעה ${slot.startTime}?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('ביטול'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('אישור'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    if (!mounted) return;

    try {
      await ref.read(bookingRepositoryProvider).book(slot.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('האימון נקבע')),
      );
      ref.invalidate(slotsForDateProvider(_selectedDate));
      ref.invalidate(myBookingsProvider);
    } on BookingFailure catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message)),
      );
      ref.invalidate(slotsForDateProvider(_selectedDate));
    }
  }

  @override
  Widget build(BuildContext context) {
    final slotsAsync = ref.watch(slotsForDateProvider(_selectedDate));
    final myBookings = ref.watch(myBookingsProvider).valueOrNull ?? [];
    final bookedSlotIds = myBookings
        .where((b) => b.isConfirmed)
        .map((b) => b.slotId)
        .toSet();
    return Scaffold(
      appBar: AppBar(
        title: const Text('המאמן שלי'),
        actions: [
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
          const _MyBookingsSection(),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                for (var i = 0; i < 6; i++)
                  _DayChip(
                    key: Key('day-chip-$i'),
                    label: hebrewDayShort[i],
                    date: _weekDates[i],
                    selected: i == _selectedIndex,
                    onTap: () => setState(() => _selectedIndex = i),
                  ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: slotsAsync.when(
              loading: () => const Center(
                key: Key('slots-loading'),
                child: CircularProgressIndicator(),
              ),
              error: (err, _) => Center(
                key: const Key('slots-error'),
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(
                    'שגיאה בטעינת השעות',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                ),
              ),
              data: (slots) {
                if (slots.isEmpty) {
                  return const Center(
                    key: Key('slots-empty'),
                    child: Text('אין שעות פנויות'),
                  );
                }
                return ListView.separated(
                  key: const Key('slots-list'),
                  itemCount: slots.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (_, i) {
                    final slot = slots[i];
                    final booked = bookedSlotIds.contains(slot.id);
                    return _SlotTile(
                      slot: slot,
                      booked: booked,
                      onTap: booked ? null : () => _openBookingDialog(slot),
                    );
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

class _MyBookingsSection extends ConsumerWidget {
  const _MyBookingsSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(myBookingsProvider);
    return async.maybeWhen(
      orElse: () => const SizedBox.shrink(),
      data: (bookings) {
        final confirmed = bookings.where((b) => b.isConfirmed).toList()
          ..sort((a, b) {
            final ad = (a.slotDate ?? '') + (a.slotStartTime ?? '');
            final bd = (b.slotDate ?? '') + (b.slotStartTime ?? '');
            return ad.compareTo(bd);
          });
        if (confirmed.isEmpty) return const SizedBox.shrink();
        return Container(
          key: const Key('my-bookings-section'),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          width: double.infinity,
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('האימונים שלי',
                  style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 4),
              for (final b in confirmed)
                Padding(
                  key: Key('my-booking-${b.id}'),
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Text(
                    '${b.slotDate ?? ""}  ${b.slotStartTime ?? ""}',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

class _DayChip extends StatelessWidget {
  final String label;
  final DateTime date;
  final bool selected;
  final VoidCallback onTap;
  const _DayChip({
    super.key,
    required this.label,
    required this.date,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 12),
        decoration: BoxDecoration(
          color: selected ? cs.primaryContainer : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          children: [
            Text(label, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 2),
            Text(
              '${date.day}/${date.month}',
              style: Theme.of(context).textTheme.labelSmall,
            ),
          ],
        ),
      ),
    );
  }
}

class _SlotTile extends StatelessWidget {
  final Slot slot;
  final bool booked;
  final VoidCallback? onTap;
  const _SlotTile({required this.slot, this.booked = false, this.onTap});

  @override
  Widget build(BuildContext context) {
    final label = booked
        ? 'מוזמן'
        : slot.isFull
            ? 'מלא'
            : 'נשאר מקום ${slot.remainingCapacity}';
    final available = !booked && !slot.isFull && !slot.lockedOut;
    return ListTile(
      key: Key('slot-${slot.startTime}'),
      title: Text(slot.startTime),
      subtitle: Text(label),
      enabled: available,
      onTap: available ? onTap : null,
    );
  }
}
