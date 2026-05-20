import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../utils/week_dates.dart';
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

  @override
  Widget build(BuildContext context) {
    final slotsAsync = ref.watch(slotsForDateProvider(_selectedDate));
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
                  itemBuilder: (_, i) => _SlotTile(slot: slots[i]),
                );
              },
            ),
          ),
        ],
      ),
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
  const _SlotTile({required this.slot});

  @override
  Widget build(BuildContext context) {
    final label = slot.isFull
        ? 'מלא'
        : 'נשאר מקום ${slot.remainingCapacity}';
    return ListTile(
      key: Key('slot-${slot.startTime}'),
      title: Text(slot.startTime),
      subtitle: Text(label),
      enabled: !slot.isFull && !slot.lockedOut,
    );
  }
}
