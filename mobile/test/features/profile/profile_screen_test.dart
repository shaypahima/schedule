import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:velofit/features/auth/auth_repository.dart';
import 'package:velofit/features/coach/calendar_repository.dart' show CalendarRepository, CalendarStatus, calendarRepositoryProvider;
import 'package:velofit/features/profile/profile.dart';
import 'package:velofit/features/profile/profile_repository.dart';
import 'package:velofit/features/profile/profile_screen.dart';
import 'package:velofit/features/profile/trainee_profile.dart';
import 'package:velofit/features/profile/trainee_profile_repository.dart';
import 'package:velofit/utils/url_opener.dart';

class _FakeProfileRepo extends Mock implements ProfileRepository {}

class _FakeAuth extends Mock implements AuthRepository {}

class _FakeCalendarRepo extends Mock implements CalendarRepository {}

class _FakeTraineeProfileRepo extends Mock implements TraineeProfileRepository {}

class _CapturingUrlOpener implements UrlOpener {
  final List<Uri> opened = [];
  @override
  Future<void> open(Uri url) async => opened.add(url);
}

Widget _harness(
  ProfileRepository repo, {
  AuthRepository? auth,
  CalendarRepository? calendar,
  UrlOpener? urlOpener,
  TraineeProfileRepository? traineeProfileRepo,
}) {
  final calRepo = calendar ?? _FakeCalendarRepo();
  if (calendar == null) {
    when(() => (calRepo as _FakeCalendarRepo).status()).thenAnswer(
      (_) async => const CalendarStatus(connected: false, mock: false),
    );
  }
  final tpRepo = traineeProfileRepo ?? _FakeTraineeProfileRepo();
  if (traineeProfileRepo == null) {
    when(() => (tpRepo as _FakeTraineeProfileRepo).fetch())
        .thenAnswer((_) async => const TraineeProfile());
  }
  return ProviderScope(
    overrides: [
      profileRepositoryProvider.overrideWithValue(repo),
      if (auth != null) authRepositoryProvider.overrideWithValue(auth),
      calendarRepositoryProvider.overrideWithValue(calRepo),
      traineeProfileRepositoryProvider.overrideWithValue(tpRepo),
      if (urlOpener != null) urlOpenerProvider.overrideWithValue(urlOpener),
    ],
    child: MaterialApp(
      builder: (context, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: child ?? const SizedBox.shrink(),
      ),
      home: const ProfileScreen(),
    ),
  );
}

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

    testWidgets('shows coach role label for coach', (tester) async {
      final repo = _FakeProfileRepo();
      when(() => repo.fetchMe()).thenAnswer((_) async => const Profile(
            id: 'c1',
            email: 'dev.coach@example.com',
            name: 'דני אמסלם',
            role: 'coach',
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

    testWidgets('coach sees Connect Calendar button when not connected',
        (tester) async {
      final repo = _FakeProfileRepo();
      when(() => repo.fetchMe()).thenAnswer((_) async => const Profile(
            id: 'c1',
            email: 'coach@example.com',
            name: 'Coach',
            role: 'coach',
          ));
      final cal = _FakeCalendarRepo();
      when(() => cal.status()).thenAnswer(
        (_) async => const CalendarStatus(connected: false, mock: false),
      );

      await tester.pumpWidget(_harness(repo, calendar: cal));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('connect-calendar-button')), findsOneWidget);
      expect(find.text('חבר יומן Google'), findsOneWidget);
    });

    testWidgets('coach with connected calendar sees connected indicator',
        (tester) async {
      final repo = _FakeProfileRepo();
      when(() => repo.fetchMe()).thenAnswer((_) async => const Profile(
            id: 'c1',
            email: 'coach@example.com',
            name: 'Coach',
            role: 'coach',
          ));
      final cal = _FakeCalendarRepo();
      when(() => cal.status()).thenAnswer(
        (_) async => const CalendarStatus(connected: true, mock: false),
      );

      await tester.pumpWidget(_harness(repo, calendar: cal));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('calendar-connected')), findsOneWidget);
      expect(find.byKey(const Key('connect-calendar-button')), findsNothing);
    });

    testWidgets('trainee does NOT see Connect Calendar button', (tester) async {
      final repo = _FakeProfileRepo();
      when(() => repo.fetchMe()).thenAnswer((_) async => const Profile(
            id: 't1',
            email: 't1@example.com',
            name: 'Alice',
            role: 'trainee',
          ));

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('connect-calendar-button')), findsNothing);
      expect(find.byKey(const Key('calendar-connected')), findsNothing);
    });

    testWidgets('tap Connect Calendar opens auth URL via UrlOpener', (tester) async {
      final repo = _FakeProfileRepo();
      final cal = _FakeCalendarRepo();
      final opener = _CapturingUrlOpener();
      when(() => repo.fetchMe()).thenAnswer((_) async => const Profile(
            id: 'c1',
            email: 'coach@example.com',
            name: 'Coach',
            role: 'coach',
          ));
      when(() => cal.status()).thenAnswer(
        (_) async => const CalendarStatus(connected: false, mock: false),
      );
      when(() => cal.getAuthUrl()).thenAnswer((_) async => 'https://accounts.google.com/o/oauth2/v2/auth?xxx');

      await tester.pumpWidget(_harness(repo, calendar: cal, urlOpener: opener));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('connect-calendar-button')));
      await tester.pumpAndSettle();

      expect(opener.opened, hasLength(1));
      expect(opener.opened.first.toString(), 'https://accounts.google.com/o/oauth2/v2/auth?xxx');
    });

    testWidgets('trainee sees ערוך פרופיל button', (tester) async {
      final repo = _FakeProfileRepo();
      when(() => repo.fetchMe()).thenAnswer((_) async => const Profile(
            id: 't1',
            email: 't@example.com',
            name: 'יעל',
            role: 'trainee',
          ));

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('edit-profile-button')), findsOneWidget);
      expect(find.text('ערוך פרופיל'), findsOneWidget);
    });

    testWidgets('coach does NOT see ערוך פרופיל button', (tester) async {
      final repo = _FakeProfileRepo();
      when(() => repo.fetchMe()).thenAnswer((_) async => const Profile(
            id: 'c1',
            email: 'coach@example.com',
            name: 'Coach',
            role: 'coach',
          ));

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('edit-profile-button')), findsNothing);
    });

    testWidgets('trainee preview shows phone, age (from dob), height, weight, goals',
        (tester) async {
      final repo = _FakeProfileRepo();
      when(() => repo.fetchMe()).thenAnswer((_) async => const Profile(
            id: 't1',
            email: 't@example.com',
            name: 'יעל',
            role: 'trainee',
          ));
      final tp = _FakeTraineeProfileRepo();
      when(() => tp.fetch()).thenAnswer((_) async => const TraineeProfile(
            phone: '+972501234567',
            dateOfBirth: '1992-04-08',
            heightCm: 168,
            weightKg: 65,
            goals: 'לרדת 5 קילו',
          ));

      await tester.pumpWidget(_harness(repo, traineeProfileRepo: tp));
      await tester.pumpAndSettle();

      expect(find.text('+972501234567'), findsOneWidget);
      expect(find.text('168 ס״מ'), findsOneWidget);
      expect(find.text('65 ק״ג'), findsOneWidget);
      expect(find.text('לרדת 5 קילו'), findsOneWidget);
    });

    testWidgets('trainee preview shows חסר fallback when fields empty',
        (tester) async {
      final repo = _FakeProfileRepo();
      when(() => repo.fetchMe()).thenAnswer((_) async => const Profile(
            id: 't1',
            email: 't@example.com',
            name: 'יעל',
            role: 'trainee',
          ));
      final tp = _FakeTraineeProfileRepo();
      when(() => tp.fetch()).thenAnswer((_) async => const TraineeProfile());

      await tester.pumpWidget(_harness(repo, traineeProfileRepo: tp));
      await tester.pumpAndSettle();

      // Trainee preview section should be visible with placeholder values
      expect(find.byKey(const Key('trainee-preview-card')), findsOneWidget);
      expect(find.text('חסר'), findsWidgets);
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
