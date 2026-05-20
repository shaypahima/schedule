import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:velofit/features/auth/auth_repository.dart';
import 'package:velofit/features/dev/dev_login_panel.dart';
import 'package:velofit/features/profile/profile.dart';
import 'package:velofit/features/profile/profile_repository.dart';
import 'package:velofit/features/slots/slot_repository.dart';

class _FakeAuth extends Mock implements AuthRepository {}

class _FakeSlotRepo extends Mock implements SlotRepository {}

class _FakeProfileRepo extends Mock implements ProfileRepository {}

Widget _harness(
  Widget child, {
  AuthRepository? auth,
  SlotRepository? slots,
  ProfileRepository? profile,
}) {
  final profileRepo = profile ?? _FakeProfileRepo();
  if (profile == null) {
    when(() => (profileRepo as _FakeProfileRepo).fetchMe()).thenAnswer(
      (_) async => const Profile(id: 'u1', email: 'u1@example.com', name: 'U', role: 'trainee'),
    );
  }
  return ProviderScope(
      overrides: [
        if (auth != null) authRepositoryProvider.overrideWithValue(auth),
        if (slots != null) slotRepositoryProvider.overrideWithValue(slots),
        profileRepositoryProvider.overrideWithValue(profileRepo),
      ],
      child: MaterialApp(
        builder: (context, c) => Directionality(
          textDirection: TextDirection.rtl,
          child: c ?? const SizedBox.shrink(),
        ),
        home: Scaffold(body: child),
      ),
    );
}

void main() {
  group('DevLoginPanel', () {
    testWidgets('renders one button per dev account', (tester) async {
      const accounts = [
        DevAccount(email: 'yael.cohen@example.com', name: 'יעל כהן', role: 'trainee'),
        DevAccount(email: 'itai.levi@example.com', name: 'איתי לוי', role: 'trainee'),
        DevAccount(email: 'dev.coach@example.com', name: 'דני אמסלם', role: 'coach'),
      ];
      await tester.pumpWidget(_harness(
        const DevLoginPanel(accounts: accounts, password: 'devpassword123'),
      ));

      expect(find.byKey(const Key('dev-login-panel')), findsOneWidget);
      expect(find.byKey(const Key('dev-login-yael.cohen@example.com')), findsOneWidget);
      expect(find.byKey(const Key('dev-login-itai.levi@example.com')), findsOneWidget);
      expect(find.byKey(const Key('dev-login-dev.coach@example.com')), findsOneWidget);
      expect(find.text('יעל כהן — מתאמן'), findsOneWidget);
      expect(find.text('דני אמסלם — מאמן'), findsOneWidget);
    });

    testWidgets('tapping a trainee button signs in with that account', (tester) async {
      final auth = _FakeAuth();
      final slots = _FakeSlotRepo();
      when(() => auth.signInWithPassword(
            email: any(named: 'email'),
            password: any(named: 'password'),
          )).thenAnswer((_) async {});
      when(() => slots.fetchSlots(any())).thenAnswer((_) async => []);

      const accounts = [
        DevAccount(email: 'yael.cohen@example.com', name: 'יעל כהן', role: 'trainee'),
      ];

      await tester.pumpWidget(_harness(
        const DevLoginPanel(accounts: accounts, password: 'devpassword123'),
        auth: auth,
        slots: slots,
      ));

      await tester.tap(find.byKey(const Key('dev-login-yael.cohen@example.com')));
      await tester.pumpAndSettle();

      verify(() => auth.signInWithPassword(
            email: 'yael.cohen@example.com',
            password: 'devpassword123',
          )).called(1);
    });
  });
}
