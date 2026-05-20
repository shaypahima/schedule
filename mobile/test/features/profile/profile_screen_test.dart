import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:velofit/features/profile/profile.dart';
import 'package:velofit/features/profile/profile_repository.dart';
import 'package:velofit/features/profile/profile_screen.dart';

class _FakeProfileRepo extends Mock implements ProfileRepository {}

Widget _harness(ProfileRepository repo) => ProviderScope(
      overrides: [profileRepositoryProvider.overrideWithValue(repo)],
      child: MaterialApp(
        builder: (context, child) => Directionality(
          textDirection: TextDirection.rtl,
          child: child ?? const SizedBox.shrink(),
        ),
        home: const ProfileScreen(),
      ),
    );

void main() {
  group('ProfileScreen', () {
    testWidgets('shows trainee name and Hebrew role label', (tester) async {
      final repo = _FakeProfileRepo();
      when(() => repo.fetchMe()).thenAnswer((_) async => const Profile(
            id: 'u1',
            email: 'yael.cohen@example.com',
            name: 'יעל כהן',
            role: 'trainee',
          ));

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      expect(find.text('יעל כהן'), findsOneWidget);
      expect(find.text('מתאמן'), findsOneWidget);
      expect(find.text('yael.cohen@example.com'), findsOneWidget);
    });

    testWidgets('shows coach role label for admin', (tester) async {
      final repo = _FakeProfileRepo();
      when(() => repo.fetchMe()).thenAnswer((_) async => const Profile(
            id: 'c1',
            email: 'dev.coach@example.com',
            name: 'דני אמסלם',
            role: 'admin',
          ));

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      expect(find.text('דני אמסלם'), findsOneWidget);
      expect(find.text('מאמן'), findsOneWidget);
    });

    testWidgets('shows error when fetch fails', (tester) async {
      final repo = _FakeProfileRepo();
      when(() => repo.fetchMe()).thenThrow(Exception('boom'));

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('profile-error')), findsOneWidget);
    });
  });
}
