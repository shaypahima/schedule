import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'notes_sheet.dart';
import 'trainee_detail_repository.dart';

class CoachTraineeDetailScreen extends ConsumerWidget {
  final String traineeId;
  const CoachTraineeDetailScreen({super.key, required this.traineeId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(traineeDetailProvider(traineeId));
    return Scaffold(
      appBar: AppBar(
        title: async.when(
          loading: () => const Text('טוען...'),
          error: (_, _) => const Text('שגיאה'),
          data: (v) => Text(v.name),
        ),
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(
          child: Text('שגיאה: $err', key: const Key('trainee-detail-error')),
        ),
        data: (v) => ListView(
          padding: const EdgeInsets.all(20),
          children: [
            _HeaderCard(view: v),
            const SizedBox(height: 16),
            _BioCard(bio: v.bio),
            const SizedBox(height: 16),
            _SessionsCard(sessions: v.sessions),
            const SizedBox(height: 20),
            FilledButton.tonalIcon(
              key: const Key('open-notes-button'),
              icon: const Icon(Icons.sticky_note_2_outlined),
              label: const Text('הערות על המתאמן'),
              onPressed: () => showModalBottomSheet<void>(
                context: context,
                isScrollControlled: true,
                builder: (_) => NotesSheet(traineeId: v.id, traineeName: v.name),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HeaderCard extends StatelessWidget {
  final TraineeDetailView view;
  const _HeaderCard({required this.view});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      elevation: 0,
      color: theme.colorScheme.primaryContainer.withValues(alpha: 0.4),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            CircleAvatar(
              radius: 28,
              backgroundColor: theme.colorScheme.primary,
              child: Text(
                view.name.isNotEmpty ? view.name.characters.first : '?',
                style: theme.textTheme.headlineSmall?.copyWith(color: Colors.white),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(view.name, style: theme.textTheme.titleLarge),
                  const SizedBox(height: 4),
                  Text(
                    view.isActive ? 'פעיל' : 'מושבת',
                    key: const Key('trainee-active-label'),
                    style: theme.textTheme.bodySmall,
                  ),
                  Text('${view.weekBookingsCount} אימונים השבוע',
                      style: theme.textTheme.bodySmall),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BioCard extends StatelessWidget {
  final TraineeBio bio;
  const _BioCard({required this.bio});

  @override
  Widget build(BuildContext context) {
    return Card(
      key: const Key('bio-card'),
      elevation: 0,
      shape: RoundedRectangleBorder(
        side: BorderSide(color: Theme.of(context).colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('פרופיל אישי', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            _row(Icons.phone, 'טלפון', bio.phone ?? 'חסר'),
            _row(Icons.cake_outlined, 'גיל', _ageText(bio.dateOfBirth)),
            _row(Icons.height, 'גובה',
                bio.heightCm == null ? 'חסר' : '${bio.heightCm} ס״מ'),
            _row(Icons.monitor_weight_outlined, 'משקל',
                bio.weightKg == null ? 'חסר' : '${bio.weightKg} ק״ג'),
            _row(Icons.flag_outlined, 'מטרות', bio.goals ?? 'חסר'),
            _row(Icons.medical_information_outlined, 'מידע רפואי',
                bio.medical ?? 'חסר'),
            if (bio.introText != null && bio.introText!.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text('הצגה עצמית',
                  style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 4),
              Text(bio.introText!),
            ],
          ],
        ),
      ),
    );
  }

  Widget _row(IconData icon, String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 18),
            const SizedBox(width: 10),
            Text('$label:'),
            const SizedBox(width: 6),
            Expanded(child: Text(value)),
          ],
        ),
      );

  String _ageText(String? dob) {
    if (dob == null) return 'חסר';
    try {
      final d = DateTime.parse(dob);
      final now = DateTime.now();
      int age = now.year - d.year;
      if (now.month < d.month || (now.month == d.month && now.day < d.day)) age -= 1;
      return '$age';
    } catch (_) {
      return 'חסר';
    }
  }
}

class _SessionsCard extends StatelessWidget {
  final List<TraineeSession> sessions;
  const _SessionsCard({required this.sessions});

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        side: BorderSide(color: Theme.of(context).colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('אימונים אחרונים',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            if (sessions.isEmpty)
              const Text('אין אימונים קודמים', key: Key('sessions-empty')),
            for (final s in sessions.take(5))
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    const Icon(Icons.event, size: 18),
                    const SizedBox(width: 10),
                    Text('${s.date}  ${s.startTime}'),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
