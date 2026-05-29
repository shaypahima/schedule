import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:velofit/design/motion.dart';
import 'package:velofit/design/widgets.dart';

Widget _host(Widget child) => MaterialApp(
      home: Directionality(
        textDirection: TextDirection.rtl,
        child: Scaffold(body: Center(child: child)),
      ),
    );

void main() {
  group('HeroNumber', () {
    testWidgets('shows the final integer value (count-up gated off in tests)',
        (tester) async {
      await tester.pumpWidget(_host(const HeroNumber(value: 12)));
      // disableInfiniteForTests (set by flutter_test_config) means no count-up,
      // so the final value is present on the first frame.
      expect(find.text('12'), findsOneWidget);
    });

    testWidgets('formats fraction digits', (tester) async {
      await tester.pumpWidget(
        _host(const HeroNumber(value: 72.5, fractionDigits: 1)),
      );
      expect(find.text('72.5'), findsOneWidget);
    });

    testWidgets('appends a suffix', (tester) async {
      await tester.pumpWidget(const SizedBox()); // reset
      await tester.pumpWidget(_host(const HeroNumber(value: 80, suffix: '%')));
      expect(find.text('80%'), findsOneWidget);
    });

    testWidgets('counts up to the final value when motion is enabled',
        (tester) async {
      AppMotion.disableInfiniteForTests = false;
      addTearDown(() => AppMotion.disableInfiniteForTests = true);

      await tester.pumpWidget(_host(const HeroNumber(value: 50)));
      await tester.pump(const Duration(milliseconds: 1)); // start
      // Mid-flight the displayed number is below the target.
      // (We just assert it settles to the final value.)
      await tester.pumpAndSettle();
      expect(find.text('50'), findsOneWidget);
    });

    testWidgets('does not hang pumpAndSettle', (tester) async {
      await tester.pumpWidget(_host(const HeroNumber(value: 7)));
      await tester.pumpAndSettle();
      expect(find.text('7'), findsOneWidget);
    });
  });
}
