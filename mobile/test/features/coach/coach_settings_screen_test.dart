import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:velofit/features/coach/coach_info.dart';
import 'package:velofit/features/coach/coach_info_repository.dart';
import 'package:velofit/features/coach/coach_settings_screen.dart';

class _FakeCoachInfoRepo extends Mock implements CoachInfoRepository {}

Widget _harness({required CoachInfoRepository repo}) => ProviderScope(
      overrides: [coachInfoRepositoryProvider.overrideWithValue(repo)],
      child: MaterialApp(
        builder: (context, child) => Directionality(
          textDirection: TextDirection.rtl,
          child: child ?? const SizedBox.shrink(),
        ),
        home: const CoachSettingsScreen(),
      ),
    );

void main() {
  group('CoachSettingsScreen', () {
    testWidgets('prefills with current contact_phone', (tester) async {
      final repo = _FakeCoachInfoRepo();
      when(() => repo.fetch()).thenAnswer((_) async => const CoachInfo(
            name: 'דני',
            contactPhone: '+972501234567',
          ));

      await tester.pumpWidget(_harness(repo: repo));
      await tester.pumpAndSettle();

      expect(
        tester.widget<TextField>(find.byKey(const Key('contact-phone-field'))).controller!.text,
        '+972501234567',
      );
    });

    testWidgets('save → updateContactPhone fired with input', (tester) async {
      final repo = _FakeCoachInfoRepo();
      when(() => repo.fetch()).thenAnswer((_) async => const CoachInfo(name: 'דני', contactPhone: null));
      when(() => repo.updateContactPhone(any())).thenAnswer((_) async {});

      await tester.pumpWidget(_harness(repo: repo));
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('contact-phone-field')), '+972509998888');
      await tester.tap(find.byKey(const Key('contact-phone-save')));
      await tester.pumpAndSettle();

      verify(() => repo.updateContactPhone('+972509998888')).called(1);
      expect(find.text('נשמר'), findsOneWidget);
    });
  });
}
