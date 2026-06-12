import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/spacing.dart';
import '../../theme.dart';
import 'coach_info_repository.dart';

class CoachAboutCard extends ConsumerWidget {
  const CoachAboutCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(coachInfoProvider);
    return async.maybeWhen(
      orElse: () => const SizedBox.shrink(),
      data: (info) {
        if (info == null) return const SizedBox.shrink();
        final hasContent =
            info.bio != null || info.specialty != null || info.yearsExperience != null;
        if (!hasContent) return const SizedBox.shrink();

        final theme = Theme.of(context);
        return Padding(
          key: const Key('coach-about-card'),
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.md,
            AppSpacing.sm,
            AppSpacing.md,
            0,
          ),
          child: Container(
            decoration: BoxDecoration(
              color: BrandColors.surface,
              borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
              border: Border.all(color: BrandColors.line),
            ),
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    CircleAvatar(
                      radius: 22,
                      backgroundColor: BrandColors.teal,
                      child: Text(
                        info.name.isNotEmpty ? info.name.characters.first : '?',
                        style: theme.textTheme.titleMedium
                            ?.copyWith(color: Colors.white, fontWeight: FontWeight.w700),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Text(info.name, style: theme.textTheme.titleMedium),
                    ),
                  ],
                ),
                if (info.specialty != null || info.yearsExperience != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Wrap(
                    spacing: AppSpacing.xs,
                    runSpacing: AppSpacing.xxs,
                    children: [
                      if (info.specialty != null)
                        _Pill(
                          text: info.specialty!,
                          icon: Icons.fitness_center,
                          accent: BrandColors.teal,
                        ),
                      if (info.yearsExperience != null)
                        _Pill(
                          text: '${info.yearsExperience} שנות ניסיון',
                          icon: Icons.workspace_premium,
                          accent: BrandColors.sandDeep,
                        ),
                    ],
                  ),
                ],
                if (info.bio != null && info.bio!.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(info.bio!, style: theme.textTheme.bodyMedium),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}

class _Pill extends StatelessWidget {
  final String text;
  final IconData icon;
  final Color accent;
  const _Pill({required this.text, required this.icon, required this.accent});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xxs,
      ),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppSpacing.radiusPill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: accent),
          const SizedBox(width: AppSpacing.xxs),
          Text(
            text,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: accent,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ],
      ),
    );
  }
}
