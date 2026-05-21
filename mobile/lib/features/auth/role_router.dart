import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../coach/coach_week_screen.dart';
import '../profile/profile_repository.dart';
import '../slots/home_screen.dart';
import 'intro_form_screen.dart';
import 'pending_approval_screen.dart';
import 'rejected_screen.dart';

/// Routes the authenticated user to the screen matching their {role, status, hasIntro}:
/// - coach           → CoachWeekScreen
/// - trainee+active  → HomeScreen
/// - trainee+pending+!hasIntro → IntroFormScreen (self-signup must fill intro)
/// - trainee+pending+hasIntro  → PendingApprovalScreen (coach must approve)
/// - trainee+rejected     → RejectedScreen
/// - trainee+deactivated  → RejectedScreen(deactivated: true)
class RoleRouter extends ConsumerWidget {
  const RoleRouter({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(profileProvider);
    return async.when(
      loading: () =>
          const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (err, _) => Scaffold(body: Center(child: Text('שגיאה: $err'))),
      data: (profile) {
        if (profile.role == 'coach') return CoachWeekScreen();
        switch (profile.status) {
          case 'rejected':
            return const RejectedScreen();
          case 'deactivated':
            return const RejectedScreen(deactivated: true);
          case 'pending':
            return profile.hasIntro
                ? const PendingApprovalScreen()
                : const IntroFormScreen();
          case 'active':
          default:
            return HomeScreen();
        }
      },
    );
  }
}
