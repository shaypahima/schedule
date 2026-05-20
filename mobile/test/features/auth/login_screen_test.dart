import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:velofit/features/auth/auth_repository.dart';
import 'package:velofit/features/auth/login_screen.dart';
import 'package:velofit/features/profile/profile_repository.dart';
import 'package:velofit/features/slots/slot_repository.dart';

class _FakeAuth extends Mock implements AuthRepository {}

class _FakeSlotRepo extends Mock implements SlotRepository {}

Widget _harness({
  required AuthRepository auth,
  ProfileRepository? profile,
  SlotRepository? slots,
}) {
  return ProviderScope(
    overrides: [
      authRepositoryProvider.overrideWithValue(auth),
      if (profile != null) profileRepositoryProvider.overrideWithValue(profile),
      if (slots != null) slotRepositoryProvider.overrideWithValue(slots),
    ],
    child: MaterialApp(
      builder: (context, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: child ?? const SizedBox.shrink(),
      ),
      home: const LoginScreen(),
    ),
  );
}

void main() {
  setUpAll(() {
    registerFallbackValue(const AuthState(AuthChangeEvent.signedIn, null));
  });

  group('LoginScreen', () {
    testWidgets('shows "Sign in with Google" button', (tester) async {
      await tester.pumpWidget(_harness(auth: _FakeAuth()));
      expect(find.byKey(const Key('google-signin-button')), findsOneWidget);
      expect(find.text('המשך עם Google'), findsOneWidget);
    });

    testWidgets('Google button tap calls signInWithGoogle', (tester) async {
      final auth = _FakeAuth();
      when(() => auth.signInWithGoogle()).thenAnswer((_) async {});

      await tester.pumpWidget(_harness(auth: auth));
      await tester.tap(find.byKey(const Key('google-signin-button')));
      await tester.pumpAndSettle();

      verify(() => auth.signInWithGoogle()).called(1);
    });

    testWidgets('renders Hebrew email + password fields + submit button under RTL',
        (tester) async {
      await tester.pumpWidget(_harness(auth: _FakeAuth()));

      expect(find.text('כניסה'), findsOneWidget); // app bar
      expect(find.text('אימייל'), findsOneWidget); // email label
      expect(find.text('סיסמה'), findsOneWidget); // password label
      expect(find.text('התחבר'), findsOneWidget); // submit

      final dir = Directionality.of(tester.element(find.byType(LoginScreen)));
      expect(dir, TextDirection.rtl);
    });

    testWidgets('failed login shows the auth failure message', (tester) async {
      final auth = _FakeAuth();
      when(() => auth.signInWithPassword(
            email: any(named: 'email'),
            password: any(named: 'password'),
          )).thenThrow(const AuthFailure('שם משתמש או סיסמה שגויים'));

      await tester.pumpWidget(_harness(auth: auth));

      await tester.enterText(find.byKey(const Key('email-field')), 'wrong@example.com');
      await tester.enterText(find.byKey(const Key('password-field')), 'badpass');
      await tester.tap(find.byKey(const Key('submit-button')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('login-error')), findsOneWidget);
      expect(find.text('שם משתמש או סיסמה שגויים'), findsOneWidget);
    });

    testWidgets('successful login navigates to home screen', (tester) async {
      final auth = _FakeAuth();
      final slots = _FakeSlotRepo();
      when(() => auth.signInWithPassword(
            email: any(named: 'email'),
            password: any(named: 'password'),
          )).thenAnswer((_) async {});
      when(() => slots.fetchSlots(any())).thenAnswer((_) async => []);

      await tester.pumpWidget(_harness(auth: auth, slots: slots));

      await tester.enterText(find.byKey(const Key('email-field')), 'yael.cohen@example.com');
      await tester.enterText(find.byKey(const Key('password-field')), 'devpassword123');
      await tester.tap(find.byKey(const Key('submit-button')));
      await tester.pumpAndSettle();

      // HomeScreen's profile icon button is present
      expect(find.byKey(const Key('profile-button')), findsOneWidget);
      verify(() => auth.signInWithPassword(
            email: 'yael.cohen@example.com',
            password: 'devpassword123',
          )).called(1);
    });
  });
}
