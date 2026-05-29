import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/spacing.dart';
import '../../design/widgets.dart';
import '../../theme.dart';
import 'admin_repository.dart';
import 'coach_trainee_detail_screen.dart';
import 'notes_sheet.dart';

String statusLabel(String status) {
  switch (status) {
    case 'pending':
      return 'ממתין';
    case 'deactivated':
      return 'מושבת';
    case 'active':
    default:
      return 'פעיל';
  }
}

Color statusColor(BuildContext c, String status) {
  final cs = Theme.of(c).colorScheme;
  switch (status) {
    case 'pending':
      return const Color.fromARGB(255, 254, 230, 191); // BrandColors.warning @ ~12% on white
    case 'deactivated':
      return cs.surfaceContainerHighest;
    case 'active':
    default:
      return cs.primaryContainer;
  }
}

/// Sort modes for the coach trainees list (#66). `byName` keeps the
/// as-fetched order (default); the others reuse the #62 progress aggregates.
enum TraineeSort { byName, byAttendance, byActivity }

/// Nulls always sort last regardless of direction.
int _cmpNullableDesc<T extends Comparable<T>>(T? a, T? b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return b.compareTo(a);
}

class CoachTraineesScreen extends ConsumerStatefulWidget {
  const CoachTraineesScreen({super.key});

  @override
  ConsumerState<CoachTraineesScreen> createState() =>
      _CoachTraineesScreenState();
}

class _CoachTraineesScreenState extends ConsumerState<CoachTraineesScreen> {
  final _search = TextEditingController();
  TraineeSort _sort = TraineeSort.byName;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  List<TraineeRecord> _filterAndSort(List<TraineeRecord> list) {
    final q = _search.text.trim().toLowerCase();
    var out = q.isEmpty
        ? List<TraineeRecord>.from(list)
        : list
            .where((t) =>
                t.name.toLowerCase().contains(q) ||
                (t.email?.toLowerCase().contains(q) ?? false))
            .toList();
    switch (_sort) {
      case TraineeSort.byName:
        break; // preserve as-fetched order
      case TraineeSort.byAttendance:
        out.sort((a, b) => _cmpNullableDesc(a.attendanceRate, b.attendanceRate));
      case TraineeSort.byActivity:
        out.sort(
            (a, b) => _cmpNullableDesc(a.lastMeasurementAt, b.lastMeasurementAt));
    }
    return out;
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(traineeRecordsProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('מתאמנים'),
        actions: [
          PopupMenuButton<TraineeSort>(
            key: const Key('sort-button'),
            tooltip: 'מיון',
            icon: const Icon(Icons.sort),
            initialValue: _sort,
            onSelected: (v) => setState(() => _sort = v),
            itemBuilder: (_) => const [
              PopupMenuItem(
                key: Key('sort-name'),
                value: TraineeSort.byName,
                child: Text('ברירת מחדל'),
              ),
              PopupMenuItem(
                key: Key('sort-attendance'),
                value: TraineeSort.byAttendance,
                child: Text('נוכחות'),
              ),
              PopupMenuItem(
                key: Key('sort-activity'),
                value: TraineeSort.byActivity,
                child: Text('פעילות אחרונה'),
              ),
            ],
          ),
          IconButton(
            key: const Key('invite-trainee-button'),
            tooltip: 'הזמן מתאמן',
            icon: const Icon(Icons.person_add),
            onPressed: () async {
              await showModalBottomSheet<void>(
                context: context,
                isScrollControlled: true,
                builder: (_) => const _InviteTraineeSheet(),
              );
              ref.invalidate(traineeRecordsProvider);
            },
          ),
        ],
      ),
      body: async.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(AppSpacing.md),
          child: SkeletonList(),
        ),
        error: (err, _) => ErrorCard(
          message: 'שגיאה בטעינת המתאמנים',
          onRetry: () => ref.invalidate(traineeRecordsProvider),
        ),
        data: (trainees) {
          if (trainees.isEmpty) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: AppSpacing.sm),
              child: EmptyState(
                icon: Icons.group_outlined,
                headline: 'אין מתאמנים',
                helper: 'הזמן מתאמן חדש מהכפתור למעלה',
              ),
            );
          }
          final filtered = _filterAndSort(trainees);
          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(
                    AppSpacing.md, AppSpacing.sm, AppSpacing.md, AppSpacing.xs),
                child: TextField(
                  key: const Key('trainee-search'),
                  controller: _search,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.search),
                    hintText: 'חיפוש לפי שם או אימייל',
                    isDense: true,
                  ),
                ),
              ),
              Expanded(
                child: filtered.isEmpty
                    ? const EmptyState(
                        key: Key('trainees-no-match'),
                        icon: Icons.search_off,
                        headline: 'לא נמצאו מתאמנים',
                        helper: 'נסה חיפוש אחר',
                      )
                    : ListView.separated(
                        itemCount: filtered.length,
                        separatorBuilder: (_, _) => const Divider(height: 1),
                        itemBuilder: (_, i) => _TraineeRow(trainee: filtered[i]),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _TraineeRow extends ConsumerWidget {
  final TraineeRecord trainee;
  const _TraineeRow({required this.trainee});

  Future<void> _confirmDeactivate(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        key: const Key('deactivate-dialog'),
        title: Text('להשבית את ${trainee.name}?'),
        content: const Text(
            'המתאמן לא יוכל להזמין אימונים. אימונים קיימים יישמרו.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('לא')),
          FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('כן, השבת')),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    await ref
        .read(adminRepositoryProvider)
        .updateTrainee(trainee.id, {'isActive': false});
    if (!context.mounted) return;
    ref.invalidate(traineeRecordsProvider);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('${trainee.name} הושבת')),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return InkWell(
      key: Key('trainee-row-${trainee.id}'),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => CoachTraineeDetailScreen(traineeId: trainee.id),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(trainee.name, style: Theme.of(context).textTheme.titleMedium),
                if (trainee.email != null)
                  Text(trainee.email!,
                      style: Theme.of(context).textTheme.bodySmall),
                _ProgressChips(trainee: trainee),
              ],
            ),
          ),
          Container(
            key: Key('trainee-status-${trainee.id}'),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: statusColor(context, trainee.status),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(statusLabel(trainee.status)),
          ),
          IconButton(
            key: Key('notes-${trainee.id}'),
            tooltip: 'הערות',
            icon: const Icon(Icons.sticky_note_2_outlined),
            onPressed: () => showModalBottomSheet<void>(
              context: context,
              isScrollControlled: true,
              builder: (_) => NotesSheet(
                traineeId: trainee.id,
                traineeName: trainee.name,
              ),
            ),
          ),
          if (trainee.status == 'pending')
            IconButton(
              key: Key('resend-${trainee.id}'),
              tooltip: 'שלח שוב הזמנה',
              icon: const Icon(Icons.refresh),
              onPressed: () async {
                if (trainee.email == null) return;
                await ref
                    .read(adminRepositoryProvider)
                    .resendInvite(trainee.email!);
                if (!context.mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('הזמנה נשלחה שוב')),
                );
              },
            ),
          if (trainee.status != 'deactivated')
            IconButton(
              key: Key('deactivate-${trainee.id}'),
              tooltip: 'השבת',
              icon: const Icon(Icons.block),
              onPressed: () => _confirmDeactivate(context, ref),
            ),
        ],
        ),
      ),
    );
  }
}

/// At-a-glance progress signals for a trainee row (#62): last weight + 14d
/// trend arrow (teal, primary), and attendance % (muted, secondary). Each chip
/// hides when its datum is absent, so never-logged / never-attended trainees
/// show a clean row rather than a misleading placeholder.
class _ProgressChips extends StatelessWidget {
  final TraineeRecord trainee;
  const _ProgressChips({required this.trainee});

  @override
  Widget build(BuildContext context) {
    final showWeight = trainee.lastWeightKg != null;
    final showAttendance = trainee.attendanceRate != null;
    if (!showWeight && !showAttendance) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (showWeight) ...[
            _Chip(
              key: Key('weight-chip-${trainee.id}'),
              icon: _trendIcon(trainee.weightTrend14d),
              label: '${trainee.lastWeightKg!.toStringAsFixed(1)} ק״ג',
              color: BrandColors.teal,
              bg: BrandColors.teal.withValues(alpha: 0.10),
            ),
            const SizedBox(width: AppSpacing.xs),
          ],
          if (showAttendance)
            _Chip(
              key: Key('attendance-chip-${trainee.id}'),
              icon: Icons.event_available,
              label: '${(trainee.attendanceRate! * 100).round()}%',
              color: BrandColors.inkMuted,
              bg: Colors.transparent,
            ),
        ],
      ),
    );
  }

  static IconData? _trendIcon(String? trend) {
    switch (trend) {
      case 'up':
        return Icons.north_east;
      case 'down':
        return Icons.south_east;
      case 'flat':
        return Icons.east;
      default:
        return null;
    }
  }
}

class _Chip extends StatelessWidget {
  final IconData? icon;
  final String label;
  final Color color;
  final Color bg;
  const _Chip({
    super.key,
    required this.icon,
    required this.label,
    required this.color,
    required this.bg,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 13, color: color),
            const SizedBox(width: 2),
          ],
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: color,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ],
      ),
    );
  }
}

class _InviteTraineeSheet extends ConsumerStatefulWidget {
  const _InviteTraineeSheet();

  @override
  ConsumerState<_InviteTraineeSheet> createState() => _InviteTraineeSheetState();
}

class _InviteTraineeSheetState extends ConsumerState<_InviteTraineeSheet> {
  final _email = TextEditingController();
  final _name = TextEditingController();
  bool _recurring = false;
  int? _day; // 0..5
  TimeOfDay? _time;
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref.read(adminRepositoryProvider).inviteTrainee(
            email: _email.text.trim(),
            name: _name.text.trim(),
            isRecurring: _recurring,
            preferredDay: _day,
            preferredTime: _time == null
                ? null
                : '${_time!.hour.toString().padLeft(2, "0")}:${_time!.minute.toString().padLeft(2, "0")}',
          );
      if (!mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('הזמנה נשלחה')),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('הזמן מתאמן חדש',
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          TextField(
            key: const Key('invite-email'),
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'אימייל'),
          ),
          const SizedBox(height: 8),
          TextField(
            key: const Key('invite-name'),
            controller: _name,
            decoration: const InputDecoration(labelText: 'שם'),
          ),
          const SizedBox(height: 8),
          SwitchListTile(
            key: const Key('invite-recurring'),
            title: const Text('אימון קבוע'),
            value: _recurring,
            onChanged: (v) => setState(() => _recurring = v),
          ),
          if (_recurring) ...[
            DropdownButtonFormField<int>(
              key: const Key('invite-day'),
              initialValue: _day,
              decoration: const InputDecoration(labelText: 'יום מועדף'),
              items: const [
                DropdownMenuItem(value: 0, child: Text('ראשון')),
                DropdownMenuItem(value: 1, child: Text('שני')),
                DropdownMenuItem(value: 2, child: Text('שלישי')),
                DropdownMenuItem(value: 3, child: Text('רביעי')),
                DropdownMenuItem(value: 4, child: Text('חמישי')),
                DropdownMenuItem(value: 5, child: Text('שישי')),
              ],
              onChanged: (v) => setState(() => _day = v),
            ),
            const SizedBox(height: 8),
            FilledButton.tonal(
              onPressed: () async {
                final picked = await showTimePicker(
                  context: context,
                  initialTime: _time ?? const TimeOfDay(hour: 10, minute: 0),
                );
                if (picked != null) setState(() => _time = picked);
              },
              child: Text(_time == null
                  ? 'בחר שעה מועדפת'
                  : 'שעה: ${_time!.hour.toString().padLeft(2, "0")}:${_time!.minute.toString().padLeft(2, "0")}'),
            ),
          ],
          const SizedBox(height: 16),
          FilledButton(
            key: const Key('invite-submit'),
            onPressed: _submitting ? null : _submit,
            child: Text(_submitting ? 'שולח...' : 'שלח הזמנה'),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
        ],
      ),
    );
  }
}
