import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:velofit/design/motion.dart';

Widget _host(Widget child, {bool reduceMotion = false}) => MediaQuery(
      data: MediaQueryData(disableAnimations: reduceMotion),
      child: MaterialApp(
        home: Directionality(
          textDirection: TextDirection.rtl,
          child: Scaffold(body: child),
        ),
      ),
    );

void main() {
  group('Reveal', () {
    testWidgets('renders its child', (tester) async {
      await tester.pumpWidget(
        _host(const Reveal(Text('שורה'), index: 2)),
      );
      expect(find.text('שורה'), findsOneWidget);
    });

    testWidgets('returns child untouched (no animation) in tests', (tester) async {
      // disableInfiniteForTests is set by flutter_test_config — the child is
      // visible and tappable on the first frame, no pumpAndSettle needed.
      var taps = 0;
      await tester.pumpWidget(
        _host(Reveal(
          GestureDetector(onTap: () => taps++, child: const Text('שורה')),
          index: 5,
        )),
      );
      await tester.tap(find.text('שורה'));
      await tester.pump();
      expect(taps, 1);
    });

    testWidgets('plays a finite entrance when motion is enabled (settles)',
        (tester) async {
      AppMotion.disableInfiniteForTests = false;
      addTearDown(() => AppMotion.disableInfiniteForTests = true);

      await tester.pumpWidget(
        _host(const Reveal(Text('שורה'), index: 3)),
      );
      // Pump past the stagger delay (a Timer) so the entrance starts, then let
      // it settle. Would hang here if the entrance looped.
      await tester.pump(const Duration(milliseconds: 300));
      await tester.pumpAndSettle();
      expect(find.text('שורה'), findsOneWidget);
    });
  });
}
