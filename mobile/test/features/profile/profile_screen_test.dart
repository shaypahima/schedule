import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:velofit/features/auth/auth_repository.dart';
import 'package:velofit/features/coach/calendar_repository.dart' show CalendarRepository, CalendarStatus, calendarRepositoryProvider;
import 'package:velofit/features/profile/profile.dart';
import 'package:velofit/features/profile/profile_repository.dart';
import 'package:velofit/features/profile/profile_screen.dart';
import 'package:velofit/utils/url_opener.dart';

class _FakeProfileRepo extends Mock implements ProfileRepository {}

class _FakeAuth extends Mock implements AuthRepository {}

class _FakeCalendarRepo extends Mock implements CalendarRepository {}

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
}) {
  final calRepo = calendar ?? _FakeCalendarRepo();
  if (calendar == null) {
    when(() => (calRepo as _FakeCalendarRepo).status()).thenAnswer(
      (_) async => const CalendarStatus(connected: false, mock: false),
    );
  }
  return ProviderScope(
    overrides: [
      profileRepositoryProvider.overrideWithValue(repo),
      if (auth != null) authRepositoryProvider.overrideWithValue(auth),
      calendarRepositoryProvider.overrideWithValue(calRepo),
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

    testWidgets('coach sees Connect Calendar button when not connected',
        (tester) async {
      final repo = _FakeProfileRepo();
      when(() => repo.fetchMe()).thenAnswer((_) async => const Profile(
            id: 'c1',
            email: 'coach@example.com',
            name: 'Coach',
            role: 'admin',
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
            role: 'admin',
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
            role: 'admin',
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
