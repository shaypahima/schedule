import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/motion.dart';
import '../../design/spacing.dart';
import '../../design/success_burst.dart';
import '../../design/widgets.dart';
import '../../theme.dart';
import '../../utils/haptics.dart';
import '../../utils/week_dates.dart';
import '../bookings/booking.dart';
import '../bookings/booking_repository.dart';
import '../bookings/cancel_request_sheet.dart';
import '../coach/coach_about_card.dart';
import '../coach/contact_coach_card.dart';
import '../dashboard/dashboard_repository.dart';
import '../history/history_screen.dart';
import '../profile/profile_repository.dart';
import '../profile/profile_screen.dart';
import '../progress/progress_screen.dart';
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
  final _slotsSectionKey = GlobalKey();

  /// Bring the "available slots" section into view — the action behind the
  /// first-session CTA (#68), so a newly-approved trainee gets to booking in
  /// one tap instead of scrolling past the welcome cards.
  void _scrollToSlots() {
    final ctx = _slotsSectionKey.currentContext;
    if (ctx == null) return;
    Scrollable.ensureVisible(
      ctx,
      duration: const Duration(milliseconds: 400),
      curve: Curves.easeOut,
      alignment: 0.05,
    );
  }

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
        title: Text('לקבוע אימון לשעה ${slot.startTime}?'),
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
      Haptics.bookingSuccess();
      showSuccessBurst(context);
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
    final myBookingsView = ref.watch(myBookingsProvider).valueOrNull;
    final bookedSlotIds = (myBookingsView?.bookings ?? [])
        .where((b) => b.isConfirmed)
        .map((b) => b.slotId)
        .toSet();

    return Scaffold(
      appBar: AppBar(
        title: const SizedBox.shrink(),
        actions: [
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
          Expanded(
            child: SingleChildScrollView(
              padding: EdgeInsets.zero,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                _WelcomeHero(now: widget.now),
                const CoachAboutCard(),
                const _CoachNoteCard(),
                const _UpcomingSessionsCard(),
                const _MyBookingsSection(),
                if (myBookingsView != null && bookedSlotIds.isEmpty)
                  _FirstSessionCta(onFindSlot: _scrollToSlots),
                Padding(
                  key: _slotsSectionKey,
                  padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
                  child: Text('מועדים פנויים',
                      style: Theme.of(context).textTheme.titleMedium),
                ),
                _DayPickerRow(
                  weekDates: _weekDates,
                  selectedIndex: _selectedIndex,
                  todayWeekday: widget.now.weekday % 7,
                  onSelect: (i) => setState(() => _selectedIndex = i),
                ),
                const SizedBox(height: 8),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: slotsAsync.when(
                    loading: () => const Padding(
                      key: Key('slots-loading-skeleton'),
                      padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
                      child: SkeletonList(),
                    ),
                    error: (err, _) => Padding(
                      padding: const EdgeInsets.symmetric(vertical: 48),
                      child: Center(
                        key: const Key('slots-error'),
                        child: Text('שגיאה בטעינת המועדים',
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.bodyLarge),
                      ),
                    ),
                    data: (slots) {
                      if (slots.isEmpty) {
                        return const Padding(
                          key: Key('slots-empty'),
                          padding: EdgeInsets.symmetric(vertical: AppSpacing.sm),
                          child: EmptyState(
                            icon: Icons.event_busy_outlined,
                            headline: 'אין מועדים פנויים בתאריך זה',
                            helper: 'בחר יום אחר מהשורה למעלה',
                          ),
                        );
                      }
                      return Column(
                        key: const Key('slots-list'),
                        children: [
                          for (var i = 0; i < slots.length; i++)
                            Reveal(
                              _SlotTile(
                                slot: slots[i],
                                booked: bookedSlotIds.contains(slots[i].id),
                                onTap: bookedSlotIds.contains(slots[i].id)
                                    ? null
                                    : () => _openBookingDialog(slots[i]),
                              ),
                              index: i,
                            ),
                          const SizedBox(height: 24),
                        ],
                      );
                    },
                  ),
                ),
              ],
            ),
            ),
          ),
        ],
      ),
    );
  }
}

class _WelcomeHero extends ConsumerWidget {
  final DateTime now;
  const _WelcomeHero({required this.now});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final view = ref.watch(myBookingsProvider).valueOrNull;
    final dashboard = ref.watch(traineeDashboardProvider).valueOrNull;
    final profile = ref.watch(profileProvider).valueOrNull;
    final confirmed =
        (view?.bookings ?? []).where((b) => b.isConfirmed).toList();
    final next = _nextSession(confirmed, now);
    final streak = dashboard != null && dashboard.currentStreak > 0
        ? '🔥 ${dashboard.currentStreak}'
        : '—';
    final monthsSince = dashboard?.memberSinceMonths ?? 0;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg,
      ),
      decoration: const BoxDecoration(
        gradient: BrandColors.gradientHero,
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${hebrewGreeting(now)}${profile != null ? ', ${profile.name.split(' ').first}' : ''}',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: Colors.white.withValues(alpha: 0.9),
                  fontWeight: FontWeight.w500,
                ),
          ),
          const SizedBox(height: 2),
          Text(
            hebrewDayHeader(now),
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  color: Colors.white,
                ),
          ),
          if (monthsSince > 0) ...[
            const SizedBox(height: 4),
            Text(
              monthsSince == 1
                  ? 'חבר/ה כבר חודש'
                  : 'חבר/ה כבר $monthsSince חודשים',
              key: const Key('member-since'),
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: Colors.white.withValues(alpha: 0.85),
                  ),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              HeroStat(
                value: streak,
                label: 'רצף',
                accent: BrandColors.peach, // pops on the warm hero (was orange)
              ),
              const SizedBox(width: AppSpacing.md),
              HeroStat(
                value: '${confirmed.length}',
                valueWidget: HeroNumber(
                  value: confirmed.length,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        height: 1.05,
                      ),
                ),
                label: 'אימונים השבוע',
                accent: Colors.white,
              ),
            ],
          ),
          if (next != null) ...[
            const SizedBox(height: AppSpacing.sm),
            _NextSessionPill(label: next),
          ],
          const SizedBox(height: AppSpacing.md),
          _QuickActions(),
        ],
      ),
    );
  }

  String? _nextSession(List<Booking> bookings, DateTime now) {
    final upcoming = bookings
        .where((b) => b.slotDate != null && b.slotStartTime != null)
        .map((b) {
      final d = DateTime.parse('${b.slotDate}T${b.slotStartTime}:00');
      return MapEntry(b, d);
    }).where((e) => e.value.isAfter(now)).toList()
      ..sort((a, b) => a.value.compareTo(b.value));
    if (upcoming.isEmpty) return null;
    final diff = upcoming.first.value.difference(now);
    if (diff.inHours < 24) return 'בעוד ${diff.inHours}ש׳';
    if (diff.inDays < 7) return 'בעוד ${diff.inDays} ימים';
    return '${upcoming.first.value.day}.${upcoming.first.value.month}';
  }
}

class _NextSessionPill extends StatelessWidget {
  final String label;
  const _NextSessionPill({required this.label});

  @override
  Widget build(BuildContext context) {
    final pill = Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppSpacing.radiusPill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.calendar_today, size: 14, color: Colors.white),
          const SizedBox(width: 6),
          Text(
            'האימון הבא: $label',
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                ),
          ),
        ],
      ),
    );
    if (!AppMotion.infiniteMotionEnabled(context)) return pill;
    // Gentle breathing pulse draws the eye to the next session without
    // shouting. Gated — static under reduce-motion / tests.
    return pill
        .animate(onPlay: (c) => c.repeat(reverse: true))
        .scaleXY(
          begin: 1.0,
          end: 1.03,
          duration: const Duration(milliseconds: 1400),
          curve: Curves.easeInOut,
        );
  }
}

class _QuickActions extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Row(
      children: [
        _QuickActionChip(
          icon: Icons.timeline,
          label: 'התקדמות',
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const ProgressScreen()),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        _QuickActionChip(
          icon: Icons.person_outline,
          label: 'הפרופיל',
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const ProfileScreen()),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        _QuickActionChip(
          icon: Icons.history,
          label: 'היסטוריה',
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const HistoryScreen()),
          ),
        ),
      ],
    );
  }
}

class _QuickActionChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _QuickActionChip({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: PressableScale(
        child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        child: Container(
          padding: const EdgeInsets.symmetric(
            vertical: AppSpacing.sm,
            horizontal: AppSpacing.xs,
          ),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
          ),
          child: Column(
            children: [
              Icon(icon, color: Colors.white, size: 20),
              const SizedBox(height: 4),
              Text(
                label,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ],
          ),
        ),
      ),
      ),
    );
  }
}

class _CoachNoteCard extends ConsumerWidget {
  const _CoachNoteCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(traineeDashboardProvider);
    return async.maybeWhen(
      orElse: () => const SizedBox.shrink(),
      data: (d) {
        final note = d.recentVisibleNote;
        if (note == null) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
          child: Card(
            color: Theme.of(context).colorScheme.tertiaryContainer.withValues(alpha: 0.6),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.chat_bubble_outline,
                          size: 16, color: Theme.of(context).colorScheme.primary),
                      const SizedBox(width: 6),
                      Text('מהמאמן',
                          style: Theme.of(context).textTheme.labelMedium?.copyWith(
                                color: Theme.of(context).colorScheme.primary,
                                fontWeight: FontWeight.w700,
                              )),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(note.body, style: Theme.of(context).textTheme.bodyMedium),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _UpcomingSessionsCard extends ConsumerWidget {
  const _UpcomingSessionsCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(myBookingsProvider);
    return async.maybeWhen(
      orElse: () => const SizedBox.shrink(),
      data: (view) {
        final upcoming = view.bookings
            .where((b) => b.isConfirmed)
            .toList()
          ..sort((a, b) {
            final ad = (a.slotDate ?? '') + (a.slotStartTime ?? '');
            final bd = (b.slotDate ?? '') + (b.slotStartTime ?? '');
            return ad.compareTo(bd);
          });
        if (upcoming.isEmpty) return const SizedBox.shrink();
        final next3 = upcoming.take(3).toList();
        return Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.event_available,
                          size: 18, color: Theme.of(context).colorScheme.primary),
                      const SizedBox(width: 6),
                      Text('האימונים הקרובים',
                          style: Theme.of(context).textTheme.titleSmall),
                    ],
                  ),
                  const SizedBox(height: 6),
                  for (final b in next3)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: Theme.of(context).colorScheme.primary,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Text(
                            '${b.slotDate ?? ""}  •  ${b.slotStartTime ?? ""}',
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                          if (b.isLocked) ...[
                            const SizedBox(width: 8),
                            Icon(Icons.lock_outline,
                                size: 14,
                                color:
                                    Theme.of(context).colorScheme.onSurfaceVariant),
                          ],
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

/// First-session nudge (#68): shown on the active-trainee landing when there
/// are no confirmed bookings yet — turns "you're approved" into immediate value
/// with a one-tap jump to bookable slots. Positive framing, no fake urgency.
class _FirstSessionCta extends StatelessWidget {
  final VoidCallback onFindSlot;
  const _FirstSessionCta({required this.onFindSlot});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      child: Card(
        key: const Key('first-session-cta'),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.fitness_center,
                      size: 20, color: theme.colorScheme.primary),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text('זמן לאימון הראשון',
                        style: theme.textTheme.titleSmall),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                'בחר מועד שנוח לך וקבע את האימון הראשון — מכאן הכול מתחיל.',
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: BrandColors.inkSoft),
              ),
              const SizedBox(height: AppSpacing.sm),
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: FilledButton.tonalIcon(
                  key: const Key('find-slot-cta'),
                  onPressed: onFindSlot,
                  icon: const Icon(Icons.event_available, size: 18),
                  label: const Text('מצא מועד פנוי'),
                ),
              ),
            ],
          ),
        ),
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
      data: (view) {
        final confirmed = view.bookings.where((b) => b.isConfirmed).toList()
          ..sort((a, b) {
            final ad = (a.slotDate ?? '') + (a.slotStartTime ?? '');
            final bd = (b.slotDate ?? '') + (b.slotStartTime ?? '');
            return ad.compareTo(bd);
          });
        if (confirmed.isEmpty) {
          return const SizedBox.shrink();
        }
        return Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
              child: Container(
                key: const Key('my-bookings-section'),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('האימונים שלי',
                        style: Theme.of(context).textTheme.titleSmall),
                    const SizedBox(height: 4),
                    for (final b in confirmed)
                      _MyBookingRow(
                          key: Key('my-booking-${b.id}'), booking: b),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _MyBookingRow extends ConsumerWidget {
  final Booking booking;
  const _MyBookingRow({super.key, required this.booking});

  Future<void> _openCancelDialog(BuildContext context, WidgetRef ref) async {
    final time = booking.slotStartTime ?? '';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        key: const Key('cancel-confirm-dialog'),
        title: Text('לבטל את האימון בשעה $time?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('לא'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('כן, בטל'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    if (!context.mounted) return;

    try {
      await ref.read(bookingRepositoryProvider).cancel(booking.id);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('האימון בוטל')),
      );
      ref.invalidate(myBookingsProvider);
      ref.invalidate(slotsForDateProvider);
    } on BookingFailure catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message)),
      );
    }
  }

  Future<void> _openReschedulePicker(BuildContext context, WidgetRef ref) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => ReschedulePicker(booking: booking),
    );
  }

  Future<void> _openCancelRequestSheet(BuildContext context, WidgetRef ref) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => CancelRequestSheet(booking: booking),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '${booking.slotDate ?? ""}  ${booking.slotStartTime ?? ""}'
                  '${booking.isLocked ? "  🔒" : ""}',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ),
              IconButton(
                key: Key('reschedule-booking-${booking.id}'),
                tooltip: 'שינוי מועד',
                icon: const Icon(Icons.edit_calendar_outlined, size: 20),
                onPressed: booking.isLocked
                    ? null
                    : () => _openReschedulePicker(context, ref),
              ),
              IconButton(
                key: Key('cancel-booking-${booking.id}'),
                tooltip: booking.isLocked ? 'בקש ביטול מהמאמן' : 'בטל',
                icon: Icon(
                  booking.isLocked
                      ? Icons.outgoing_mail
                      : Icons.delete_outline,
                  size: 20,
                ),
                onPressed: () => booking.isLocked
                    ? _openCancelRequestSheet(context, ref)
                    : _openCancelDialog(context, ref),
              ),
            ],
          ),
          if (booking.isLocked)
            ContactCoachCard(lockedSlotStartTime: booking.slotStartTime),
        ],
      ),
    );
  }
}

class ReschedulePicker extends ConsumerWidget {
  final Booking booking;
  const ReschedulePicker({super.key, required this.booking});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final weekDates = currentWeekSunToFri(
      DateTime.parse(booking.slotDate ?? formatDate(DateTime.now())),
    );

    return Container(
      key: const Key('reschedule-picker'),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('בחר מועד חדש', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.6,
            ),
            child: ListView(
              shrinkWrap: true,
              children: [
                for (final d in weekDates)
                  _PickerDay(
                      date: formatDate(d),
                      currentSlotId: booking.slotId,
                      bookingId: booking.id),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PickerDay extends ConsumerWidget {
  final String date;
  final String currentSlotId;
  final String bookingId;
  const _PickerDay({
    required this.date,
    required this.currentSlotId,
    required this.bookingId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(slotsForDateProvider(date));
    return async.maybeWhen(
      orElse: () => const SizedBox.shrink(),
      data: (slots) {
        final usable = slots
            .where((s) => !s.isFull && !s.lockedOut && s.id != currentSlotId)
            .toList();
        if (usable.isEmpty) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Text(date, style: Theme.of(context).textTheme.titleSmall),
            ),
            for (final slot in usable)
              ListTile(
                key: Key('picker-slot-$date-${slot.startTime}'),
                title: Text(slot.startTime),
                subtitle: Text('נשאר מקום ${slot.remainingCapacity}'),
                onTap: () async {
                  Navigator.of(context).pop();
                  try {
                    await ref
                        .read(bookingRepositoryProvider)
                        .reschedule(bookingId, slot.id);
                    if (!context.mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('האימון הועבר')),
                    );
                    ref.invalidate(myBookingsProvider);
                    ref.invalidate(slotsForDateProvider);
                  } on BookingFailure catch (e) {
                    if (!context.mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(e.message)),
                    );
                    ref.invalidate(slotsForDateProvider);
                  }
                },
              ),
          ],
        );
      },
    );
  }
}

class _DayPickerRow extends StatelessWidget {
  final List<DateTime> weekDates;
  final int selectedIndex;
  final int todayWeekday; // 0..6 (Sun..Sat)
  final void Function(int) onSelect;
  const _DayPickerRow({
    required this.weekDates,
    required this.selectedIndex,
    required this.todayWeekday,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          for (var i = 0; i < 6; i++)
            _DayChip(
              key: Key('day-chip-$i'),
              label: hebrewDayShort[i],
              date: weekDates[i],
              selected: i == selectedIndex,
              isToday: i == todayWeekday,
              onTap: () => onSelect(i),
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
  final bool isToday;
  final VoidCallback onTap;
  const _DayChip({
    super.key,
    required this.label,
    required this.date,
    required this.selected,
    required this.isToday,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final bg = selected ? scheme.primary : Colors.transparent;
    final fg = selected ? scheme.onPrimary : scheme.onSurface;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOut,
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 14),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? scheme.primary : BrandColors.line,
            width: 1,
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(label,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: fg,
                      fontWeight: FontWeight.w700,
                    )),
            const SizedBox(height: 2),
            Text(
              '${date.day}/${date.month}',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: fg.withValues(alpha: 0.85),
                  ),
            ),
            if (isToday) ...[
              const SizedBox(height: 4),
              Container(
                width: 4,
                height: 4,
                decoration: BoxDecoration(
                  color: selected ? scheme.onPrimary : BrandColors.orange,
                  shape: BoxShape.circle,
                ),
              ),
            ],
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
    final scheme = Theme.of(context).colorScheme;
    final available = !booked && !slot.isFull && !slot.lockedOut;
    final label = booked
        ? 'מוזמן'
        : slot.isFull
            ? 'מלא'
            : 'נשאר מקום ${slot.remainingCapacity}';
    final accentColor = booked
        ? scheme.primary
        : slot.isFull
            ? scheme.outline
            : scheme.secondary;

    final card = Card(
      key: Key('slot-${slot.startTime}'),
      child: InkWell(
        onTap: available ? onTap : null,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Container(
                width: 4,
                height: 36,
                decoration: BoxDecoration(
                  color: accentColor,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(slot.startTime,
                        style: Theme.of(context).textTheme.titleLarge),
                    Text(label,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: scheme.onSurfaceVariant,
                            )),
                  ],
                ),
              ),
              if (available)
                Icon(Icons.chevron_left, color: scheme.primary)
              else if (booked)
                Icon(Icons.check_circle, color: scheme.primary, size: 22)
              else
                Icon(Icons.lock_outline, color: scheme.outline, size: 20),
            ],
          ),
        ),
      ),
    );
    // Press feedback only where the tile is actionable.
    return available ? PressableScale(child: card) : card;
  }
}
