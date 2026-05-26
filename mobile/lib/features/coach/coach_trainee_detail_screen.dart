import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/spacing.dart';
import '../../design/widgets.dart';
import '../../theme.dart';
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
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            _HeaderCard(view: v),
            const SizedBox(height: AppSpacing.lg),
            _BioCard(bio: v.bio),
            const SizedBox(height: AppSpacing.lg),
            _SessionsCard(sessions: v.sessions),
            const SizedBox(height: AppSpacing.lg),
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
    return Row(
      children: [
        Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            color: BrandColors.teal,
            borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          ),
          alignment: Alignment.center,
          child: Text(
            view.name.isNotEmpty ? view.name.characters.first : '?',
            style: theme.textTheme.headlineSmall?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(view.name, style: theme.textTheme.titleLarge),
              const SizedBox(height: 2),
              Row(
                children: [
                  _StatusDot(
                    color: view.isActive ? BrandColors.success : BrandColors.inkMuted,
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Text(
                    view.isActive ? 'פעיל' : 'מושבת',
                    key: const Key('trainee-active-label'),
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: view.isActive ? BrandColors.success : BrandColors.inkMuted,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Text(
                    '·',
                    style: theme.textTheme.bodySmall?.copyWith(color: BrandColors.inkMuted),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Text(
                    '${view.weekBookingsCount} אימונים השבוע',
                    style: theme.textTheme.bodySmall,
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _StatusDot extends StatelessWidget {
  final Color color;
  const _StatusDot({required this.color});
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 8,
      height: 8,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }
}

class _BioCard extends StatelessWidget {
  final TraineeBio bio;
  const _BioCard({required this.bio});

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const Key('bio-card'),
      decoration: BoxDecoration(
        color: BrandColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(color: BrandColors.line),
      ),
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader('פרופיל אישי'),
          DataGrid(children: [
            InfoRow(icon: Icons.cake_outlined, label: 'גיל', value: _ageText(bio.dateOfBirth)),
            InfoRow(icon: Icons.phone_outlined, label: 'טלפון', value: bio.phone),
            InfoRow(
              icon: Icons.height,
              label: 'גובה',
              value: bio.heightCm == null ? null : '${bio.heightCm} ס״מ',
            ),
            InfoRow(
              icon: Icons.monitor_weight_outlined,
              label: 'משקל',
              value: bio.weightKg == null ? null : '${bio.weightKg} ק״ג',
            ),
          ]),
          const SizedBox(height: AppSpacing.md),
          const SectionHeader('מטרות ומגבלות'),
          InfoRow(icon: Icons.flag_outlined, label: 'מטרות', value: bio.goals),
          InfoRow(
            icon: Icons.medical_information_outlined,
            label: 'מידע רפואי',
            value: bio.medical,
          ),
          const SizedBox(height: AppSpacing.md),
          const SectionHeader('הצגה עצמית'),
          if (bio.introText != null && bio.introText!.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: BrandColors.bg,
                borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                border: const Border(
                  right: BorderSide(color: BrandColors.teal, width: 2),
                ),
              ),
              child: Text(
                bio.introText!,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            )
          else
            Text(
              'אין הצגה עצמית',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: BrandColors.inkMuted,
                    fontStyle: FontStyle.italic,
                  ),
            ),
        ],
      ),
    );
  }

  String? _ageText(String? dob) {
    if (dob == null) return null;
    try {
      final d = DateTime.parse(dob);
      final now = DateTime.now();
      int age = now.year - d.year;
      if (now.month < d.month || (now.month == d.month && now.day < d.day)) age -= 1;
      return '$age';
    } catch (_) {
      return null;
    }
  }
}

class _SessionsCard extends StatelessWidget {
  final List<TraineeSession> sessions;
  const _SessionsCard({required this.sessions});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: BrandColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(color: BrandColors.line),
      ),
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader('אימונים אחרונים'),
          if (sessions.isEmpty)
            const Padding(
              key: Key('sessions-empty'),
              padding: EdgeInsets.symmetric(vertical: AppSpacing.xs),
              child: EmptyState(
                icon: Icons.history,
                headline: 'עדיין אין אימונים',
                helper: 'כאן יופיעו האימונים הקודמים של המתאמן',
              ),
            )
          else
            for (final s in sessions.take(5)) _SessionRow(session: s),
        ],
      ),
    );
  }
}

class _SessionRow extends StatelessWidget {
  final TraineeSession session;
  const _SessionRow({required this.session});

  @override
  Widget build(BuildContext context) {
    final day = int.tryParse(session.date.substring(8, 10)) ?? 0;
    final mon = int.tryParse(session.date.substring(5, 7)) ?? 0;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        children: [
          Container(
            width: 4,
            height: 18,
            decoration: BoxDecoration(
              color: BrandColors.teal,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Text(
            session.startTime,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: BrandColors.ink,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Text(
            '$day.$mon',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

