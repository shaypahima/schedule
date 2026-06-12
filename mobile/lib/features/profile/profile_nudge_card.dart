import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/spacing.dart';
import '../../theme.dart';
import 'profile_completion.dart';
import 'profile_wizard_screen.dart';
import 'trainee_profile_repository.dart';

/// Dismissible "complete your profile" nudge (CONTEXT.md: Profile completion).
/// Shows progress over the optional fields; opens the stepped wizard.
/// Never blocks anything — booking works regardless.
class ProfileNudgeCard extends ConsumerWidget {
  const ProfileNudgeCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dismissed = ref.watch(profileNudgeDismissedProvider);
    final profile = ref.watch(traineeProfileProvider).valueOrNull;
    if (dismissed || profile == null) return const SizedBox.shrink();

    final done = completedProfileFields(profile);
    if (done >= profileCompletionFieldCount) return const SizedBox.shrink();

    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.md, AppSpacing.sm, AppSpacing.md, 0),
      child: Card(
        key: const Key('profile-nudge'),
        margin: EdgeInsets.zero,
        child: InkWell(
          key: const Key('profile-nudge-cta'),
          borderRadius: BorderRadius.circular(16),
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const ProfileWizardScreen()),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.md, AppSpacing.sm, AppSpacing.xs, AppSpacing.sm),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('השלם את הפרופיל', style: theme.textTheme.titleMedium),
                      const SizedBox(height: 2),
                      Text(
                        '$done/$profileCompletionFieldCount שדות — זה עוזר למאמן להתאים לך אימונים',
                        style: theme.textTheme.bodySmall
                            ?.copyWith(color: BrandColors.inkSoft),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(2),
                        child: SizedBox(
                          height: 3,
                          child: Row(
                            children: [
                              if (done > 0)
                                Expanded(
                                  flex: done,
                                  child:
                                      const ColoredBox(color: BrandColors.teal),
                                ),
                              Expanded(
                                flex: profileCompletionFieldCount - done,
                                child:
                                    const ColoredBox(color: BrandColors.line),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  key: const Key('profile-nudge-dismiss'),
                  tooltip: 'הסתר',
                  iconSize: 18,
                  color: BrandColors.inkMuted,
                  icon: const Icon(Icons.close),
                  onPressed: () => ref
                      .read(profileNudgeDismissedProvider.notifier)
                      .state = true,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
