import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/motion.dart';
import '../../design/spacing.dart';
import '../../design/widgets.dart';
import '../../theme.dart';
import '../../utils/haptics.dart';
import '../../utils/week_dates.dart';
import '../profile/profile_screen.dart';
import '../slots/slot.dart';
import '../slots/slot_repository.dart';
import 'admin_repository.dart';
import 'approvals_repository.dart';
import 'change_requests_screen.dart';
import 'coach_dashboard_repository.dart';
import 'coach_trainees_screen.dart';
import 'pending_approvals_screen.dart';

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

  /// Human date for the week-range label ("17.5"), vs ISO [formatDate] which
  /// is the API wire format and reads raw on screen.
  static String _displayDate(DateTime d) => '${d.day}.${d.month}';

  @override
  Widget build(BuildContext context) {
    final slotsAsync = ref.watch(slotsForDateProvider(_selectedDate));
    final bookingsAsync = ref.watch(adminBookingsForDateProvider(_selectedDate));

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('השבוע שלי'),
            Text(
              hebrewDayHeader(widget.now),
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ],
        ),
        actions: [
          _PendingApprovalsButton(),
          IconButton(
            key: const Key('trainees-button'),
            tooltip: 'המתאמנים שלי',
            icon: const Icon(Icons.group),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const CoachTraineesScreen()),
            ),
          ),
          IconButton(
            key: const Key('profile-button'),
            tooltip: 'הפרופיל שלי',
            icon: const Icon(Icons.person),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const ProfileScreen()),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          _CoachDashboard(now: widget.now, selectedDate: _selectedDate),
          const _InboxHero(),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            // Chronological navigation stays LTR even in a Hebrew UI — dates
            // and timelines read left→right, so back is left, forward is right.
            child: Directionality(
              textDirection: TextDirection.ltr,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  IconButton(
                    key: const Key('week-prev'),
                    tooltip: 'שבוע קודם',
                    icon: const Icon(Icons.chevron_left,
                        color: BrandColors.inkSoft),
                    onPressed: () => setState(() => _weekOffset--),
                  ),
                  Text(
                    '${_displayDate(_weekDates.first)} – ${_displayDate(_weekDates.last)}',
                    key: const Key('week-range'),
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  IconButton(
                    key: const Key('week-next'),
                    tooltip: 'שבוע הבא',
                    icon: const Icon(Icons.chevron_right,
                        color: BrandColors.inkSoft),
                    onPressed: () => setState(() => _weekOffset++),
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(
              vertical: AppSpacing.xs,
              horizontal: AppSpacing.xs,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                for (var i = 0; i < 6; i++)
                  InkWell(
                    key: Key('day-chip-$i'),
                    onTap: () => setState(() => _selectedIndex = i),
                    borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        vertical: AppSpacing.xxs,
                        horizontal: AppSpacing.sm,
                      ),
                      decoration: BoxDecoration(
                        color: i == _selectedIndex
                            ? BrandColors.teal.withValues(alpha: 0.12)
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                      ),
                      child: Column(
                        children: [
                          Text(
                            hebrewDayShort[i],
                            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                  color: i == _selectedIndex
                                      ? BrandColors.tealDark
                                      : BrandColors.ink,
                                  fontWeight: i == _selectedIndex
                                      ? FontWeight.w700
                                      : FontWeight.normal,
                                ),
                          ),
                          Text(
                            '${_weekDates[i].day}/${_weekDates[i].month}',
                            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                  color: BrandColors.inkSoft,
                                ),
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
              loading: () => const Padding(
                padding: EdgeInsets.all(AppSpacing.md),
                child: SkeletonList(),
              ),
              error: (err, _) => KeyedSubtree(
                key: const Key('week-error'),
                child: ErrorCard(
                  message: 'שגיאה בטעינת המועדים',
                  retryKey: const Key('week-error-retry'),
                  onRetry: () =>
                      ref.invalidate(slotsForDateProvider(_selectedDate)),
                ),
              ),
              data: (slots) {
                final bookings = bookingsAsync.valueOrNull ?? [];
                final bySlot = <String, List<AdminBooking>>{};
                for (final b in bookings) {
                  bySlot.putIfAbsent(b.slotId, () => []).add(b);
                }
                if (slots.isEmpty) {
                  return SingleChildScrollView(
                    child: const Padding(
                      key: Key('week-empty'),
                      padding: EdgeInsets.symmetric(vertical: AppSpacing.sm),
                      child: EmptyState(
                        icon: Icons.event_busy_outlined,
                        headline: 'אין שעות פנויות ביום זה',
                        helper: 'בחר יום אחר או עבור לשבוע אחר',
                      ),
                    ),
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                  itemCount: slots.length,
                  separatorBuilder: (_, _) =>
                      const SizedBox(height: AppSpacing.xs),
                  itemBuilder: (_, i) {
                    final slot = slots[i];
                    final slotBookings = bySlot[slot.id] ?? const [];
                    return Reveal(
                      _CoachSlotTile(slot: slot, bookings: slotBookings),
                      index: i,
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

class _CoachDashboard extends ConsumerWidget {
  final DateTime now;
  final String selectedDate;
  const _CoachDashboard({required this.now, required this.selectedDate});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bookings = ref.watch(adminBookingsForDateProvider(selectedDate)).valueOrNull ?? [];
    final trainees = ref.watch(traineeRecordsProvider).valueOrNull ?? [];
    final dashboard = ref.watch(coachDashboardProvider).valueOrNull;
    final activeCount = trainees.where((t) => t.status == 'active').length;
    final noShowsThisWeek = dashboard?.noShowsThisWeek ?? 0;

    // Read-only numbers live here; anything requiring the coach to act lives
    // in the inbox below. Data is quiet, actions are teal — never mixed.
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.md, AppSpacing.sm, AppSpacing.md, 0),
      child: StatGroupCard(
        stats: [
          StatItem(label: 'אימונים היום', value: '${bookings.length}'),
          StatItem(label: 'מתאמנים פעילים', value: '$activeCount'),
          StatItem(
            cellKey: const Key('no-shows-stat'),
            label: 'אי-הגעה השבוע',
            value: '$noShowsThisWeek',
            valueColor: noShowsThisWeek > 0 ? BrandColors.error : null,
          ),
        ],
      ),
    );
  }
}


/// Glanceable inbox (#67): pending approvals + inside-24h change requests
/// surfaced at the top with one-tap entry. When both are zero it shows a calm
/// "all clear" — no fake urgency, just peace of mind (behavioral rule 1).
class _InboxHero extends ConsumerWidget {
  const _InboxHero();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboard = ref.watch(coachDashboardProvider).valueOrNull;
    if (dashboard == null) return const SizedBox.shrink(); // dashboard hero covers loading
    final approvals = dashboard.pendingApprovals;
    final requests = dashboard.pendingChangeRequests;

    if (approvals + requests == 0) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(
            AppSpacing.md, AppSpacing.sm, AppSpacing.md, 0),
        child: Row(
          key: const Key('inbox-all-clear'),
          children: [
            const Icon(Icons.check_circle_outline,
                size: 18, color: BrandColors.success),
            const SizedBox(width: AppSpacing.xs),
            Text(
              'אין משימות ממתינות',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: BrandColors.inkMuted,
                  ),
            ),
          ],
        ),
      );
    }

    return Padding(
      padding:
          const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.sm, AppSpacing.md, 0),
      child: Container(
        key: const Key('inbox-hero'),
        decoration: BoxDecoration(
          color: BrandColors.teal.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          border: const Border(
            right: BorderSide(color: BrandColors.teal, width: 3),
          ),
        ),
        padding: const EdgeInsets.all(AppSpacing.sm),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SectionHeader('ממתין לטיפולך'),
            if (approvals > 0)
              _InboxRow(
                rowKey: const Key('inbox-approvals'),
                icon: Icons.how_to_reg_outlined,
                label: 'אישורי מתאמנים ממתינים',
                count: approvals,
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(
                      builder: (_) => const PendingApprovalsScreen()),
                ),
              ),
            if (requests > 0)
              _InboxRow(
                rowKey: const Key('inbox-requests'),
                icon: Icons.swap_horiz,
                label: 'בקשות שינוי',
                count: requests,
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const ChangeRequestsScreen()),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _InboxRow extends StatelessWidget {
  final Key rowKey;
  final IconData icon;
  final String label;
  final int count;
  final VoidCallback onTap;
  const _InboxRow({
    required this.rowKey,
    required this.icon,
    required this.label,
    required this.count,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InkWell(
      key: rowKey,
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
        child: Row(
          children: [
            Icon(icon, size: 20, color: BrandColors.teal),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(label, style: theme.textTheme.bodyMedium),
            ),
            _CountBadge(count: count),
            const SizedBox(width: AppSpacing.xs),
            const Icon(Icons.chevron_left, size: 18, color: BrandColors.inkMuted),
          ],
        ),
      ),
    );
  }
}

/// Teal count pill that pops (scales in) whenever [count] changes — a small
/// "you have new work" cue. Finite + gated, so it's static under
/// reduce-motion / tests.
class _CountBadge extends StatelessWidget {
  final int count;
  const _CountBadge({required this.count});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final badge = Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 1),
      decoration: BoxDecoration(
        color: BrandColors.teal,
        borderRadius: BorderRadius.circular(AppSpacing.radiusPill),
      ),
      child: Text(
        '$count',
        style: theme.textTheme.labelMedium?.copyWith(
          color: Colors.white,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
    if (!AppMotion.enabled(context)) return badge;
    // Re-keying on count replays the pop when the number changes.
    return badge
        .animate(key: ValueKey(count))
        .scale(
          begin: const Offset(0.6, 0.6),
          end: const Offset(1, 1),
          duration: AppMotion.standard,
          curve: AppMotion.springy,
        );
  }
}

class _CoachSlotTile extends ConsumerWidget {
  final Slot slot;
  final List<AdminBooking> bookings;
  const _CoachSlotTile({required this.slot, required this.bookings});

  Future<void> _openOverridesSheet(BuildContext context, WidgetRef ref) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _SlotOverridesSheet(slot: slot, bookings: bookings),
    );
    ref.invalidate(slotsForDateProvider);
    ref.invalidate(adminBookingsForDateProvider);
  }

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

  bool _slotIsPast() {
    try {
      final dt = DateTime.parse('${slot.date}T${slot.startTime}:00');
      return dt.isBefore(DateTime.now());
    } catch (_) {
      return false;
    }
  }

  Future<void> _markNoShow(BuildContext context, WidgetRef ref, AdminBooking booking) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        key: const Key('no-show-confirm-dialog'),
        title: Text('לסמן את ${booking.traineeName ?? "המתאמן"} כלא הופיע?'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('לא')),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('סמן כלא הופיע'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    try {
      await ref.read(adminRepositoryProvider).markNoShow(booking.id);
      if (!context.mounted) return;
      Haptics.noShowMark();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('סומן כלא הופיע')),
      );
      ref.invalidate(adminBookingsForDateProvider);
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
    final theme = Theme.of(context);
    final full = bookings.length >= slot.capacity;
    final capacityLabel = full
        ? 'מלא'
        : bookings.isEmpty
            ? 'פנוי · ${slot.capacity} מקומות'
            : 'נותר מקום ${slot.capacity - bookings.length}';

    // Card anatomy — data on the reading side (time, occupancy, names),
    // actions on the far side in teal (add / no-show / remove). The fill bar
    // under the header makes occupancy scannable without reading "1/2".
    return GestureDetector(
      key: Key('coach-slot-${slot.startTime}'),
      onLongPress: () => _openOverridesSheet(context, ref),
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        child: Card(
          margin: EdgeInsets.zero,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.md, AppSpacing.sm, AppSpacing.sm, AppSpacing.sm),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(slot.startTime,
                                  style: theme.textTheme.titleLarge),
                              if (slot.lockoutOverride) ...[
                                const SizedBox(width: AppSpacing.xs),
                                const Icon(Icons.lock_open,
                                    size: 14, color: BrandColors.sandDeep),
                              ],
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            capacityLabel,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: full
                                  ? BrandColors.inkMuted
                                  : BrandColors.inkSoft,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (!full)
                      IconButton.outlined(
                        key: Key('add-trainee-${slot.id}'),
                        icon: const Icon(Icons.person_add_alt_1, size: 20),
                        tooltip: 'הוסף מתאמן',
                        style: IconButton.styleFrom(
                          foregroundColor: BrandColors.teal,
                          side: BorderSide(
                              color: BrandColors.teal.withValues(alpha: 0.4)),
                        ),
                        onPressed: () => _openAddTraineeSheet(context, ref),
                      ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),
                // Occupancy bar: teal fill over a sand track.
                ClipRRect(
                  borderRadius: BorderRadius.circular(2),
                  child: SizedBox(
                    height: 3,
                    child: Row(
                      children: [
                        if (bookings.isNotEmpty)
                          Expanded(
                            flex: bookings.length,
                            child: const ColoredBox(color: BrandColors.teal),
                          ),
                        if (slot.capacity - bookings.length > 0)
                          Expanded(
                            flex: slot.capacity - bookings.length,
                            child: const ColoredBox(color: BrandColors.line),
                          ),
                      ],
                    ),
                  ),
                ),
                if (bookings.isNotEmpty) const SizedBox(height: AppSpacing.xs),
                for (final b in bookings)
                  Row(
                    children: [
                      Container(
                        width: 26,
                        height: 26,
                        alignment: Alignment.center,
                        decoration: const BoxDecoration(
                          color: BrandColors.cream,
                          shape: BoxShape.circle,
                        ),
                        child: Text(
                          (b.traineeName?.isNotEmpty ?? false)
                              ? b.traineeName![0]
                              : '?',
                          style: theme.textTheme.labelMedium
                              ?.copyWith(color: BrandColors.ink),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(b.traineeName ?? b.traineeId,
                            key: Key('booking-name-${b.id}'),
                            style: theme.textTheme.bodyMedium),
                      ),
                      if (_slotIsPast())
                        IconButton(
                          key: Key('no-show-${b.id}'),
                          tooltip: 'סמן כלא הופיע',
                          iconSize: 20,
                          color: BrandColors.inkSoft,
                          icon: const Icon(Icons.person_off_outlined),
                          onPressed: () => _markNoShow(context, ref, b),
                        ),
                      IconButton(
                        key: Key('remove-booking-${b.id}'),
                        tooltip: 'הסר מהשעה',
                        iconSize: 20,
                        color: BrandColors.inkSoft,
                        icon: const Icon(Icons.remove_circle_outline),
                        onPressed: () => _confirmRemove(context, ref, b),
                      ),
                    ],
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SlotOverridesSheet extends ConsumerWidget {
  final Slot slot;
  final List<AdminBooking> bookings;
  const _SlotOverridesSheet({required this.slot, required this.bookings});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SafeArea(
      child: Padding(
        key: const Key('slot-overrides-sheet'),
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('עקיפות שעה (${slot.startTime})',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            SwitchListTile(
              key: const Key('override-capacity-3'),
              title: const Text('קיבולת 3 (במקום 2)'),
              value: slot.capacity >= 3,
              onChanged: (v) async {
                await ref.read(adminRepositoryProvider).updateSlot(
                      slotId: slot.id.startsWith('new-') ? null : slot.id,
                      date: slot.date,
                      startTime: slot.startTime,
                      capacity: v ? 3 : 2,
                    );
                if (!context.mounted) return;
                Navigator.of(context).pop();
              },
            ),
            SwitchListTile(
              key: const Key('override-lockout'),
              title: const Text('עקוף חסימת 7 שעות'),
              subtitle: const Text('מאפשר ביטול/שינוי גם בשעה הסופית'),
              value: slot.lockoutOverride,
              onChanged: (v) async {
                await ref.read(adminRepositoryProvider).updateSlot(
                      slotId: slot.id.startsWith('new-') ? null : slot.id,
                      date: slot.date,
                      startTime: slot.startTime,
                      lockoutOverride: v,
                    );
                if (!context.mounted) return;
                Navigator.of(context).pop();
              },
            ),
            if (bookings.isNotEmpty) ...[
              const Divider(),
              for (final b in bookings)
                FilledButton.tonal(
                  key: Key('reset-edits-${b.traineeId}'),
                  onPressed: () async {
                    await ref.read(adminRepositoryProvider).resetEdits(b.traineeId);
                    if (!context.mounted) return;
                    Navigator.of(context).pop();
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('עריכות אופסו ל-${b.traineeName ?? b.traineeId}')),
                    );
                  },
                  child: Text('אפס עריכות: ${b.traineeName ?? b.traineeId}'),
                ),
            ],
          ],
        ),
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
                loading: () => const Padding(
                  padding: EdgeInsets.all(AppSpacing.md),
                  child: SkeletonList(count: 4, itemHeight: 48),
                ),
                error: (err, _) => const ErrorCard(message: 'שגיאה בטעינת המתאמנים'),
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


class _PendingApprovalsButton extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(pendingApprovalsProvider);
    final count = async.valueOrNull?.length ?? 0;
    return Stack(
      alignment: Alignment.center,
      children: [
        IconButton(
          key: const Key("pending-approvals-button"),
          tooltip: "בקשות הצטרפות",
          icon: const Icon(Icons.how_to_reg),
          onPressed: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const PendingApprovalsScreen()),
          ),
        ),
        if (count > 0)
          Positioned(
            top: 6,
            left: 6,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              decoration: BoxDecoration(
                color: BrandColors.teal,
                borderRadius: BorderRadius.circular(8),
              ),
              constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
              child: Text(
                "$count",
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ),
      ],
    );
  }
}
