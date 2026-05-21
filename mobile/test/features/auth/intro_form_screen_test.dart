import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:velofit/features/auth/intro_form_screen.dart';
import 'package:velofit/features/auth/intro_repository.dart';
import 'package:velofit/features/profile/profile.dart';
import 'package:velofit/features/profile/profile_repository.dart';

class _FakeIntroRepo extends Mock implements IntroRepository {}

class _FakeProfileRepo extends Mock implements ProfileRepository {}

Widget _harness(IntroRepository intro, {ProfileRepository? profileRepo}) {
  final repo = profileRepo ?? _FakeProfileRepo();
  when(() => repo.fetchMe()).thenAnswer((_) async => const Profile(
        id: 't1',
        email: 't1@example.com',
        name: 'Yael',
        role: 'trainee',
        status: 'pending',
        hasIntro: false,
      ));
  return ProviderScope(
    overrides: [
      introRepositoryProvider.overrideWithValue(intro),
      profileRepositoryProvider.overrideWithValue(repo),
    ],
    child: MaterialApp(
      builder: (context, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: child ?? const SizedBox.shrink(),
      ),
      home: const IntroFormScreen(),
    ),
  );
}

void main() {
  setUpAll(() {
    registerFallbackValue('');
  });

  group('IntroFormScreen', () {
    testWidgets('submits phone + intro text via the repository', (tester) async {
      final intro = _FakeIntroRepo();
      when(() => intro.submit(phone: any(named: 'phone'), introText: any(named: 'introText')))
          .thenAnswer((_) async {});

      await tester.pumpWidget(_harness(intro));
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('intro-phone')), '0501234567');
      await tester.enterText(
        find.byKey(const Key('intro-text')),
        'I want to train for a half marathon.',
      );

      await tester.tap(find.byKey(const Key('intro-submit')));
      await tester.pump();

      verify(() => intro.submit(
            phone: '+972501234567',
            introText: 'I want to train for a half marathon.',
          )).called(1);
    });

    testWidgets('shows validation error for short intro text', (tester) async {
      final intro = _FakeIntroRepo();

      await tester.pumpWidget(_harness(intro));
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('intro-phone')), '0501234567');
      await tester.enterText(find.byKey(const Key('intro-text')), 'hi');

      await tester.tap(find.byKey(const Key('intro-submit')));
      await tester.pump();

      expect(find.text('לפחות 10 תווים'), findsOneWidget);
      verifyNever(() => intro.submit(phone: any(named: 'phone'), introText: any(named: 'introText')));
    });

    testWidgets('shows backend error code in Hebrew', (tester) async {
      final intro = _FakeIntroRepo();
      when(() => intro.submit(phone: any(named: 'phone'), introText: any(named: 'introText')))
          .thenThrow(const IntroFailure('INTRO_ALREADY_SUBMITTED', 'already'));

      await tester.pumpWidget(_harness(intro));
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('intro-phone')), '0501234567');
      await tester.enterText(
        find.byKey(const Key('intro-text')),
        'Plenty of intro text here.',
      );
      await tester.tap(find.byKey(const Key('intro-submit')));
      await tester.pumpAndSettle();

      expect(find.text('כבר שלחת את הטופס'), findsOneWidget);
    });
  });
}
