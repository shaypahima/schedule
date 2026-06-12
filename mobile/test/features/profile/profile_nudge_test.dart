import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:velofit/features/profile/profile_completion.dart';
import 'package:velofit/features/profile/profile_nudge_card.dart';
import 'package:velofit/features/profile/profile_wizard_screen.dart';
import 'package:velofit/features/profile/trainee_profile.dart';
import 'package:velofit/features/profile/trainee_profile_repository.dart';

class _FakeTraineeProfileRepo extends Mock implements TraineeProfileRepository {}

const _incomplete = TraineeProfile(
  phone: '0501234567',
  introText: 'היי',
  goals: 'לרדת במשקל',
  heightCm: 178,
  weightKg: 80,
  // dateOfBirth + medical missing → 3/5
);

const _complete = TraineeProfile(
  phone: '0501234567',
  goals: 'כוח',
  heightCm: 178,
  weightKg: 80,
  dateOfBirth: '1990-01-01',
  medical: 'אין',
);

Widget _harness(TraineeProfileRepository repo) => ProviderScope(
      overrides: [
        traineeProfileRepositoryProvider.overrideWithValue(repo),
      ],
      child: MaterialApp(
        builder: (context, child) => Directionality(
          textDirection: TextDirection.rtl,
          child: child ?? const SizedBox.shrink(),
        ),
        home: const Scaffold(body: ProfileNudgeCard()),
      ),
    );

void main() {
  setUpAll(() => registerFallbackValue(const TraineeProfilePatch()));

  group('profile completion', () {
    test('counts only the optional fields — intro fields excluded', () {
      expect(completedProfileFields(_incomplete), 3);
      expect(completedProfileFields(_complete), profileCompletionFieldCount);
      expect(completedProfileFields(const TraineeProfile(phone: 'x', introText: 'y')), 0);
    });
  });

  group('ProfileNudgeCard', () {
    testWidgets('shows progress when profile incomplete; tap opens wizard',
        (tester) async {
      final repo = _FakeTraineeProfileRepo();
      when(() => repo.fetch()).thenAnswer((_) async => _incomplete);

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('profile-nudge')), findsOneWidget);
      expect(find.textContaining('3/5'), findsOneWidget);

      await tester.tap(find.byKey(const Key('profile-nudge-cta')));
      await tester.pumpAndSettle();
      expect(find.byType(ProfileWizardScreen), findsOneWidget);
    });

    testWidgets('hidden when profile complete', (tester) async {
      final repo = _FakeTraineeProfileRepo();
      when(() => repo.fetch()).thenAnswer((_) async => _complete);

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('profile-nudge')), findsNothing);
    });

    testWidgets('dismiss hides the card for the session', (tester) async {
      final repo = _FakeTraineeProfileRepo();
      when(() => repo.fetch()).thenAnswer((_) async => _incomplete);

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('profile-nudge-dismiss')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('profile-nudge')), findsNothing);
    });
  });

  group('ProfileWizardScreen', () {
    testWidgets('each step saves its own patch — leaving mid-way loses nothing',
        (tester) async {
      final repo = _FakeTraineeProfileRepo();
      when(() => repo.fetch()).thenAnswer((_) async => _incomplete);
      when(() => repo.update(any())).thenAnswer((_) async => _incomplete);

      await tester.pumpWidget(ProviderScope(
        overrides: [
          traineeProfileRepositoryProvider.overrideWithValue(repo),
        ],
        child: MaterialApp(
          builder: (context, child) => Directionality(
            textDirection: TextDirection.rtl,
            child: child ?? const SizedBox.shrink(),
          ),
          home: const ProfileWizardScreen(),
        ),
      ));
      await tester.pumpAndSettle();

      // Step 1: goals.
      await tester.enterText(
          find.byKey(const Key('wizard-goals')), 'לבנות כוח');
      await tester.tap(find.byKey(const Key('wizard-next')));
      await tester.pumpAndSettle();

      final captured =
          verify(() => repo.update(captureAny())).captured.single
              as TraineeProfilePatch;
      expect(captured.goals, 'לבנות כוח');

      // Step 2 is now visible.
      expect(find.byKey(const Key('wizard-height')), findsOneWidget);
    });
  });
}
