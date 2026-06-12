import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'trainee_profile.dart';

/// "Profile completion" (CONTEXT.md): how much of the OPTIONAL trainee
/// profile data is filled in. The intro fields (phone, intro text) are
/// mandatory at signup and never counted. Completion nudges — it never gates.
const profileCompletionFieldCount = 5;

int completedProfileFields(TraineeProfile p) {
  final optional = [p.dateOfBirth, p.heightCm, p.weightKg, p.goals, p.medical];
  return optional.where((f) => f != null).length;
}

/// Session-scoped dismiss — the nudge stays gone until the next app launch.
final profileNudgeDismissedProvider = StateProvider<bool>((_) => false);
