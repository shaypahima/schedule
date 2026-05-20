import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../coach/coach_settings_screen.dart';
import 'profile_repository.dart';

String roleLabel(String role) {
  switch (role) {
    case 'admin':
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
      appBar: AppBar(title: const Text('הפרופיל שלי')),
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
              if (profile.role == 'admin') ...[
                const SizedBox(height: 24),
                FilledButton.tonalIcon(
                  key: const Key('coach-settings-link'),
                  icon: const Icon(Icons.settings),
                  label: const Text('הגדרות מאמן'),
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const CoachSettingsScreen()),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
