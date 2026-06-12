import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/widgets.dart';
import '../../theme.dart';
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
      // Branded splash beat, not a spinner — resolves in well under a second.
      loading: () => Scaffold(
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: const BoxDecoration(
                  color: BrandColors.cream,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: const Icon(Icons.fitness_center,
                    size: 34, color: BrandColors.teal),
              ),
              const SizedBox(height: 12),
              Text(
                'Velofit',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: BrandColors.teal,
                      fontWeight: FontWeight.w800,
                    ),
              ),
            ],
          ),
        ),
      ),
      error: (err, _) => Scaffold(
        body: Center(
          child: ErrorCard(
            message: 'שגיאה בטעינת הפרופיל',
            onRetry: () => ref.invalidate(profileProvider),
          ),
        ),
      ),
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
