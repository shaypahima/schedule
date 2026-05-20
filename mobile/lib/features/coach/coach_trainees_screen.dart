import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'admin_repository.dart';

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
      return Colors.amber.shade200;
    case 'deactivated':
      return cs.surfaceContainerHighest;
    case 'active':
    default:
      return cs.primaryContainer;
  }
}

class CoachTraineesScreen extends ConsumerWidget {
  const CoachTraineesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(traineeRecordsProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('מתאמנים'),
        actions: [
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
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(child: Text('שגיאה: $err')),
        data: (trainees) {
          if (trainees.isEmpty) {
            return const Center(child: Text('אין מתאמנים'));
          }
          return ListView.separated(
            itemCount: trainees.length,
            separatorBuilder: (_, _) => const Divider(height: 1),
            itemBuilder: (_, i) => _TraineeRow(trainee: trainees[i]),
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
    return Padding(
      key: Key('trainee-row-${trainee.id}'),
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
