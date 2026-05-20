import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../coach/coach_week_screen.dart';
import '../profile/profile_repository.dart';
import '../slots/home_screen.dart';

/// Watches the current user's profile and renders the role-appropriate home:
/// coach → CoachWeekScreen, trainee → HomeScreen.
class RoleRouter extends ConsumerWidget {
  const RoleRouter({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(profileProvider);
    return async.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (err, _) => Scaffold(body: Center(child: Text('שגיאה: $err'))),
      data: (profile) =>
          profile.role == 'admin' ? CoachWeekScreen() : HomeScreen(),
    );
  }
}
