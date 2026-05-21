import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:velofit/features/coach/coach_about_card.dart';
import 'package:velofit/features/coach/coach_info.dart';
import 'package:velofit/features/coach/coach_info_repository.dart';

class _FakeRepo extends Mock implements CoachInfoRepository {}

Widget _harness(CoachInfoRepository repo) => ProviderScope(
      overrides: [coachInfoRepositoryProvider.overrideWithValue(repo)],
      child: MaterialApp(
        builder: (context, child) => Directionality(
          textDirection: TextDirection.rtl,
          child: child ?? const SizedBox.shrink(),
        ),
        home: const Scaffold(body: CoachAboutCard()),
      ),
    );

void main() {
  group('CoachAboutCard', () {
    testWidgets('renders name + specialty pill + years pill + bio', (tester) async {
      final repo = _FakeRepo();
      when(() => repo.fetch()).thenAnswer((_) async => const CoachInfo(
            name: 'דני אמסלם',
            contactPhone: '+972501234567',
            bio: 'מאמן מנוסה במיוחד',
            specialty: 'כוח',
            yearsExperience: 8,
          ));

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('coach-about-card')), findsOneWidget);
      expect(find.text('דני אמסלם'), findsOneWidget);
      expect(find.text('כוח'), findsOneWidget);
      expect(find.text('8 שנות ניסיון'), findsOneWidget);
      expect(find.text('מאמן מנוסה במיוחד'), findsOneWidget);
    });

    testWidgets('renders nothing when coach has no bio / specialty / years',
        (tester) async {
      final repo = _FakeRepo();
      when(() => repo.fetch()).thenAnswer(
        (_) async => const CoachInfo(name: 'דני', contactPhone: '+972501234567'),
      );

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('coach-about-card')), findsNothing);
    });

    testWidgets('renders nothing when CoachInfo is null', (tester) async {
      final repo = _FakeRepo();
      when(() => repo.fetch()).thenAnswer((_) async => null);

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('coach-about-card')), findsNothing);
    });
  });
}
