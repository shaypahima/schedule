import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:velofit/features/auth/auth_repository.dart';
import 'package:velofit/features/profile/profile.dart';
import 'package:velofit/features/profile/profile_repository.dart';
import 'package:velofit/features/profile/profile_screen.dart';

class _FakeProfileRepo extends Mock implements ProfileRepository {}

class _FakeAuth extends Mock implements AuthRepository {}

Widget _harness(ProfileRepository repo, {AuthRepository? auth}) => ProviderScope(
      overrides: [
        profileRepositoryProvider.overrideWithValue(repo),
        if (auth != null) authRepositoryProvider.overrideWithValue(auth),
      ],
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

    testWidgets('sign-out button calls AuthRepository.signOut', (tester) async {
      final repo = _FakeProfileRepo();
      final auth = _FakeAuth();
      when(() => repo.fetchMe()).thenAnswer((_) async => const Profile(
            id: 'u1',
            email: 'yael.cohen@example.com',
            name: 'יעל כהן',
            role: 'trainee',
          ));
      when(() => auth.signOut()).thenAnswer((_) async {});

      await tester.pumpWidget(_harness(repo, auth: auth));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('sign-out-button')));
      await tester.pumpAndSettle();

      verify(() => auth.signOut()).called(1);
    });
  });
}
