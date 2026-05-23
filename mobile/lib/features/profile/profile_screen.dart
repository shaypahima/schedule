import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/spacing.dart';
import '../../design/widgets.dart';
import '../../theme.dart';
import '../../utils/url_opener.dart';
import '../auth/auth_repository.dart';
import '../auth/login_screen.dart';
import '../coach/calendar_repository.dart';
import '../coach/coach_settings_screen.dart';
import 'profile.dart';
import 'profile_repository.dart';
import 'trainee_profile_editor_screen.dart';
import 'trainee_profile_repository.dart';

String roleLabel(String role) {
  switch (role) {
    case 'coach':
      return 'מאמן';
    case 'trainee':
      return 'מתאמן';
    default:
      return role;
  }
}

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(profileProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('הפרופיל שלי'),
        actions: [
          IconButton(
            key: const Key('sign-out-button'),
            tooltip: 'התנתק',
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await ref.read(authRepositoryProvider).signOut();
              if (!context.mounted) return;
              Navigator.of(context).pushAndRemoveUntil(
                MaterialPageRoute(builder: (_) => const LoginScreen()),
                (_) => false,
              );
            },
          ),
        ],
      ),
      body: profileAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(
          child: Text(
            'שגיאה: $err',
            key: const Key('profile-error'),
            textAlign: TextAlign.center,
          ),
        ),
        data: (profile) => ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            _IdentityCard(profile: profile),
            const SizedBox(height: AppSpacing.lg),
            if (profile.role == 'trainee') ...[
              _TraineePreviewCard(),
              const SizedBox(height: AppSpacing.md),
              FilledButton.icon(
                key: const Key('edit-profile-button'),
                icon: const Icon(Icons.edit_outlined),
                label: const Text('ערוך פרופיל'),
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => const TraineeProfileEditorScreen(),
                  ),
                ),
              ),
            ],
            if (profile.role == 'coach') ...[
              FilledButton.tonalIcon(
                key: const Key('coach-settings-link'),
                icon: const Icon(Icons.settings_outlined),
                label: const Text('הגדרות מאמן'),
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const CoachSettingsScreen()),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              const _CoachCalendarStatus(),
            ],
          ],
        ),
      ),
    );
  }
}

class _IdentityCard extends StatelessWidget {
  final Profile profile;
  const _IdentityCard({required this.profile});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(
        vertical: AppSpacing.lg,
        horizontal: AppSpacing.md,
      ),
      child: Row(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [BrandColors.teal, BrandColors.tealDark],
                begin: Alignment.topRight,
                end: Alignment.bottomLeft,
              ),
              borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
            ),
            alignment: Alignment.center,
            child: Text(
              profile.name.isNotEmpty ? profile.name.characters.first : '?',
              style: theme.textTheme.headlineMedium?.copyWith(
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
                Text(profile.name,
                    key: const Key('profile-name'),
                    style: theme.textTheme.headlineSmall),
                const SizedBox(height: 2),
                Text(roleLabel(profile.role),
                    key: const Key('profile-role'),
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: BrandColors.teal,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.3,
                    )),
                const SizedBox(height: AppSpacing.xxs),
                Text(profile.email,
                    style: theme.textTheme.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TraineePreviewCard extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(traineeProfileProvider);
    return Container(
      key: const Key('trainee-preview-card'),
      decoration: BoxDecoration(
        color: BrandColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(color: BrandColors.line),
      ),
      padding: const EdgeInsets.all(AppSpacing.md),
      child: async.when(
        loading: () => const SizedBox(
          height: 96,
          child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
        ),
        error: (e, _) => Text('שגיאה: $e'),
        data: (tp) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SectionHeader('פרטים אישיים'),
            DataGrid(children: [
              InfoRow(icon: Icons.cake_outlined, label: 'גיל', value: _ageText(tp.dateOfBirth)),
              InfoRow(icon: Icons.phone_outlined, label: 'טלפון', value: tp.phone),
              InfoRow(icon: Icons.height, label: 'גובה', value: tp.heightCm == null ? null : '${tp.heightCm} ס״מ'),
              InfoRow(icon: Icons.monitor_weight_outlined, label: 'משקל', value: tp.weightKg == null ? null : '${tp.weightKg} ק״ג'),
            ]),
            const SizedBox(height: AppSpacing.md),
            const SectionHeader('מטרות'),
            InfoRow(icon: Icons.flag_outlined, label: 'מטרות אימון', value: tp.goals),
          ],
        ),
      ),
    );
  }

  String? _ageText(String? dob) {
    if (dob == null) return null;
    try {
      final d = DateTime.parse(dob);
      final now = DateTime.now();
      int age = now.year - d.year;
      if (now.month < d.month || (now.month == d.month && now.day < d.day)) {
        age -= 1;
      }
      return '$age';
    } catch (_) {
      return null;
    }
  }
}

class _CoachCalendarStatus extends ConsumerWidget {
  const _CoachCalendarStatus();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(calendarStatusProvider).valueOrNull;
    if (status == null) {
      return const SizedBox(
        height: 24,
        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }
    if (status.mock) {
      return Container(
        key: const Key('calendar-mock'),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.amber.shade100,
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Text(
          '🛠 יומן Google במצב סימולציה (פיתוח)',
          textAlign: TextAlign.center,
        ),
      );
    }
    if (status.connected) {
      return const Text(
        '✓ יומן Google מחובר',
        key: Key('calendar-connected'),
      );
    }
    return FilledButton.tonalIcon(
      key: const Key('connect-calendar-button'),
      icon: const Icon(Icons.calendar_today),
      label: const Text('חבר יומן Google'),
      onPressed: () async {
        try {
          final url = await ref.read(calendarRepositoryProvider).getAuthUrl();
          await ref.read(urlOpenerProvider).open(Uri.parse(url));
        } catch (e) {
          if (!context.mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('שגיאה: $e')),
          );
        }
      },
    );
  }
}

