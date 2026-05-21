import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:velofit/features/profile/trainee_profile.dart';
import 'package:velofit/features/profile/trainee_profile_editor_screen.dart';
import 'package:velofit/features/profile/trainee_profile_repository.dart';

class _FakeRepo extends Mock implements TraineeProfileRepository {}

class _FakePatch extends Fake implements TraineeProfilePatch {}

Widget _harness(TraineeProfileRepository repo) => ProviderScope(
      overrides: [
        traineeProfileRepositoryProvider.overrideWithValue(repo),
      ],
      child: MaterialApp(
        builder: (context, child) => Directionality(
          textDirection: TextDirection.rtl,
          child: child ?? const SizedBox.shrink(),
        ),
        home: const TraineeProfileEditorScreen(),
      ),
    );

void main() {
  setUpAll(() {
    registerFallbackValue(_FakePatch());
  });

  group('TraineeProfileEditorScreen', () {
    testWidgets('prefills current values from server', (tester) async {
      final repo = _FakeRepo();
      when(() => repo.fetch()).thenAnswer((_) async => const TraineeProfile(
            phone: '+972501234567',
            dateOfBirth: '1992-04-08',
            heightCm: 168,
            weightKg: 65,
            goals: 'לרדת 5 קילו',
            medical: 'אין',
          ));

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      expect(_text(tester, 'phone-field'), '+972501234567');
      expect(_text(tester, 'height-field'), '168');
      expect(_text(tester, 'weight-field'), '65');
      expect(_text(tester, 'goals-field'), 'לרדת 5 קילו');
      expect(_text(tester, 'medical-field'), 'אין');
      expect(_text(tester, 'dob-field'), '1992-04-08');
    });

    testWidgets('save → repo.update with edited fields', (tester) async {
      final repo = _FakeRepo();
      TraineeProfilePatch? captured;
      when(() => repo.fetch()).thenAnswer((_) async => const TraineeProfile());
      when(() => repo.update(any())).thenAnswer((inv) async {
        captured = inv.positionalArguments.first as TraineeProfilePatch;
        return const TraineeProfile();
      });

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('phone-field')), '+972500000000');
      await tester.enterText(find.byKey(const Key('height-field')), '175');
      await tester.enterText(find.byKey(const Key('weight-field')), '70');
      await tester.enterText(find.byKey(const Key('goals-field')), 'חיטוב');
      await _scrollToSave(tester);
      await tester.tap(find.byKey(const Key('save-button')));
      await tester.pumpAndSettle();

      expect(captured, isNotNull);
      expect(captured!.phone, '+972500000000');
      expect(captured!.heightCm, 175);
      expect(captured!.weightKg, 70);
      expect(captured!.goals, 'חיטוב');
    });

    testWidgets('save shows snackbar on success', (tester) async {
      final repo = _FakeRepo();
      when(() => repo.fetch()).thenAnswer((_) async => const TraineeProfile());
      when(() => repo.update(any())).thenAnswer((_) async => const TraineeProfile());

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      await _scrollToSave(tester);
      await tester.tap(find.byKey(const Key('save-button')));
      await tester.pump(); // queue snackbar
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('נשמר'), findsOneWidget);
    });

    testWidgets('save shows error message on failure', (tester) async {
      final repo = _FakeRepo();
      when(() => repo.fetch()).thenAnswer((_) async => const TraineeProfile());
      when(() => repo.update(any())).thenThrow(Exception('boom'));

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      await _scrollToSave(tester);
      await tester.tap(find.byKey(const Key('save-button')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('editor-error')), findsOneWidget);
    });

    testWidgets('invalid height shows inline validation error and does not call repo',
        (tester) async {
      final repo = _FakeRepo();
      when(() => repo.fetch()).thenAnswer((_) async => const TraineeProfile());
      when(() => repo.update(any())).thenAnswer((_) async => const TraineeProfile());

      await tester.pumpWidget(_harness(repo));
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('height-field')), 'abc');
      await _scrollToSave(tester);
      await tester.tap(find.byKey(const Key('save-button')));
      await tester.pumpAndSettle();

      verifyNever(() => repo.update(any()));
      expect(find.text('גובה לא תקין'), findsOneWidget);
    });
  });
}

String _text(WidgetTester t, String key) =>
    t.widget<TextField>(find.byKey(Key(key))).controller!.text;

Future<void> _scrollToSave(WidgetTester tester) async {
  await tester.dragUntilVisible(
    find.byKey(const Key('save-button')),
    find.byType(ListView),
    const Offset(0, -50),
  );
  await tester.pumpAndSettle();
}
