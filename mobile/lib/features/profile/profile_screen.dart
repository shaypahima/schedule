import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../utils/url_opener.dart';
import '../auth/auth_repository.dart';
import '../auth/login_screen.dart';
import '../coach/calendar_repository.dart';
import '../coach/coach_settings_screen.dart';
import 'profile_repository.dart';

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
        data: (profile) => Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(profile.name,
                  key: const Key('profile-name'),
                  style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              Text(roleLabel(profile.role),
                  key: const Key('profile-role'),
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 4),
              Text(profile.email,
                  style: Theme.of(context).textTheme.bodyMedium),
              if (profile.role == 'coach') ...[
                const SizedBox(height: 24),
                FilledButton.tonalIcon(
                  key: const Key('coach-settings-link'),
                  icon: const Icon(Icons.settings),
                  label: const Text('הגדרות מאמן'),
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const CoachSettingsScreen()),
                  ),
                ),
                const SizedBox(height: 12),
                Consumer(
                  builder: (context, ref, _) {
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
                  },
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
