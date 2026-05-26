import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:velofit/design/widgets.dart';
import 'package:velofit/features/coach/coach_info.dart';
import 'package:velofit/features/coach/coach_info_repository.dart';
import 'package:velofit/features/coach/coach_settings_screen.dart';

class _FakeCoachInfoRepo extends Mock implements CoachInfoRepository {}

class _FakePatch extends Fake implements CoachInfoPatch {}

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

Future<void> _scrollToSave(WidgetTester tester) async {
  await tester.dragUntilVisible(
    find.byKey(const Key('contact-phone-save')),
    find.byType(ListView),
    const Offset(0, -50),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(() {
    registerFallbackValue(_FakePatch());
  });

  group('CoachSettingsScreen', () {
    testWidgets('prefills with current contact_phone + bio + specialty + years',
        (tester) async {
      final repo = _FakeCoachInfoRepo();
      when(() => repo.fetch()).thenAnswer((_) async => const CoachInfo(
            name: 'דני',
            contactPhone: '+972501234567',
            bio: 'מאמן מנוסה',
            specialty: 'כוח',
            yearsExperience: 8,
          ));

      await tester.pumpWidget(_harness(repo: repo));
      await tester.pumpAndSettle();

      String text(String key) =>
          tester.widget<TextField>(find.byKey(Key(key))).controller!.text;

      expect(text('contact-phone-field'), '+972501234567');
      expect(text('coach-bio-field'), 'מאמן מנוסה');
      expect(text('coach-specialty-field'), 'כוח');
      expect(text('coach-years-field'), '8');
    });

    testWidgets('save → repo.update fired with patch', (tester) async {
      final repo = _FakeCoachInfoRepo();
      CoachInfoPatch? captured;
      when(() => repo.fetch()).thenAnswer(
        (_) async => const CoachInfo(name: 'דני', contactPhone: null),
      );
      when(() => repo.update(any())).thenAnswer((inv) async {
        captured = inv.positionalArguments.first as CoachInfoPatch;
      });

      await tester.pumpWidget(_harness(repo: repo));
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('contact-phone-field')), '+972509998888');
      await tester.enterText(find.byKey(const Key('coach-specialty-field')), 'שיקום');
      await tester.enterText(find.byKey(const Key('coach-years-field')), '5');
      await tester.enterText(find.byKey(const Key('coach-bio-field')), 'אוהב לעזור');
      await _scrollToSave(tester);
      await tester.tap(find.byKey(const Key('contact-phone-save')));
      await tester.pumpAndSettle();

      expect(captured, isNotNull);
      expect(captured!.contactPhone, '+972509998888');
      expect(captured!.specialty, 'שיקום');
      expect(captured!.yearsExperience, 5);
      expect(captured!.bio, 'אוהב לעזור');
      expect(find.text('נשמר'), findsOneWidget);
    });

    testWidgets('uses shared SectionHeader (R25), not custom _section helper',
        (tester) async {
      final repo = _FakeCoachInfoRepo();
      when(() => repo.fetch()).thenAnswer((_) async => null);

      await tester.pumpWidget(_harness(repo: repo));
      await tester.pumpAndSettle();

      // Two sections: contact / presentation.
      expect(find.byType(SectionHeader), findsNWidgets(2));
    });

    testWidgets('bio field has hint text (R27)', (tester) async {
      final repo = _FakeCoachInfoRepo();
      when(() => repo.fetch()).thenAnswer((_) async => null);

      await tester.pumpWidget(_harness(repo: repo));
      await tester.pumpAndSettle();

      final bio =
          tester.widget<TextField>(find.byKey(const Key('coach-bio-field')));
      expect(bio.minLines, 4);
      expect(
        bio.decoration!.hintText,
        'כמה משפטים על הניסיון והסגנון שלך',
      );
    });

    testWidgets('invalid years shows inline error and does not call repo',
        (tester) async {
      final repo = _FakeCoachInfoRepo();
      when(() => repo.fetch()).thenAnswer(
        (_) async => const CoachInfo(name: 'דני', contactPhone: null),
      );
      when(() => repo.update(any())).thenAnswer((_) async {});

      await tester.pumpWidget(_harness(repo: repo));
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('coach-years-field')), '999');
      await _scrollToSave(tester);
      await tester.tap(find.byKey(const Key('contact-phone-save')));
      await tester.pumpAndSettle();

      verifyNever(() => repo.update(any()));
      expect(find.text('מספר לא תקין (0-80)'), findsOneWidget);
    });
  });
}
