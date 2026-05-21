import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
          child: Card(
            elevation: 0,
            color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.4),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 22,
                        backgroundColor: theme.colorScheme.primary,
                        child: Text(
                          info.name.isNotEmpty ? info.name.characters.first : '?',
                          style: theme.textTheme.titleMedium?.copyWith(color: Colors.white),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(info.name, style: theme.textTheme.titleMedium),
                            Text('המאמן שלי',
                                style: theme.textTheme.labelSmall?.copyWith(
                                  color: theme.colorScheme.onSurfaceVariant,
                                )),
                          ],
                        ),
                      ),
                    ],
                  ),
                  if (info.specialty != null || info.yearsExperience != null) ...[
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      children: [
                        if (info.specialty != null)
                          _Pill(text: info.specialty!, icon: Icons.fitness_center),
                        if (info.yearsExperience != null)
                          _Pill(
                            text: '${info.yearsExperience} שנות ניסיון',
                            icon: Icons.workspace_premium,
                          ),
                      ],
                    ),
                  ],
                  if (info.bio != null && info.bio!.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Text(info.bio!, style: theme.textTheme.bodyMedium),
                  ],
                ],
              ),
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
  const _Pill({required this.text, required this.icon});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: cs.primaryContainer,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: cs.onPrimaryContainer),
          const SizedBox(width: 6),
          Text(text,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: cs.onPrimaryContainer,
                fontWeight: FontWeight.w600,
              )),
        ],
      ),
    );
  }
}
