import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
          padding: const EdgeInsets.all(20),
          children: [
            _IdentityCard(profile: profile),
            const SizedBox(height: 16),
            if (profile.role == 'trainee') ...[
              _TraineePreviewCard(),
              const SizedBox(height: 16),
              FilledButton.icon(
                key: const Key('edit-profile-button'),
                icon: const Icon(Icons.edit),
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
                icon: const Icon(Icons.settings),
                label: const Text('הגדרות מאמן'),
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const CoachSettingsScreen()),
                ),
              ),
              const SizedBox(height: 12),
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
    return Card(
      elevation: 0,
      color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Row(
          children: [
            CircleAvatar(
              radius: 32,
              backgroundColor: theme.colorScheme.primaryContainer,
              child: Text(
                profile.name.isNotEmpty ? profile.name.characters.first : '?',
                style: theme.textTheme.headlineSmall?.copyWith(
                  color: theme.colorScheme.onPrimaryContainer,
                ),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(profile.name,
                      key: const Key('profile-name'),
                      style: theme.textTheme.headlineSmall),
                  const SizedBox(height: 4),
                  Text(roleLabel(profile.role),
                      key: const Key('profile-role'),
                      style: theme.textTheme.titleSmall?.copyWith(
                        color: theme.colorScheme.primary,
                      )),
                  const SizedBox(height: 2),
                  Text(profile.email,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      )),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TraineePreviewCard extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(traineeProfileProvider);
    return Card(
      key: const Key('trainee-preview-card'),
      elevation: 0,
      shape: RoundedRectangleBorder(
        side: BorderSide(color: Theme.of(context).colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: async.when(
          loading: () => const SizedBox(
            height: 100,
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (e, _) => Text('שגיאה: $e'),
          data: (tp) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('פרטי המתאמן',
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 12),
              _row(Icons.phone, 'טלפון', tp.phone ?? 'חסר'),
              _row(Icons.cake_outlined, 'גיל', _ageText(tp.dateOfBirth)),
              _row(Icons.height, 'גובה',
                  tp.heightCm == null ? 'חסר' : '${tp.heightCm} ס״מ'),
              _row(Icons.monitor_weight_outlined, 'משקל',
                  tp.weightKg == null ? 'חסר' : '${tp.weightKg} ק״ג'),
              _row(Icons.flag_outlined, 'מטרות', tp.goals ?? 'חסר'),
            ],
          ),
        ),
      ),
    );
  }

  Widget _row(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(icon, size: 20),
          const SizedBox(width: 12),
          Text('$label:'),
          const SizedBox(width: 8),
          Expanded(child: Text(value, textAlign: TextAlign.start)),
        ],
      ),
    );
  }

  String _ageText(String? dob) {
    if (dob == null) return 'חסר';
    try {
      final d = DateTime.parse(dob);
      final now = DateTime.now();
      int age = now.year - d.year;
      if (now.month < d.month || (now.month == d.month && now.day < d.day)) {
        age -= 1;
      }
      return '$age';
    } catch (_) {
      return 'חסר';
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
