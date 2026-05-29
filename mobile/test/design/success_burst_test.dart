import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:velofit/design/motion.dart';
import 'package:velofit/design/success_burst.dart';

Widget _host(Widget child) => MaterialApp(
      home: Directionality(
        textDirection: TextDirection.rtl,
        child: Scaffold(body: child),
      ),
    );

void main() {
  group('SuccessBurst', () {
    testWidgets('renders and calls onDone when it finishes', (tester) async {
      var done = false;
      await tester.pumpWidget(
        _host(SuccessBurst(onDone: () => done = true)),
      );
      expect(find.byType(SuccessBurst), findsOneWidget);
      await tester.pumpAndSettle(); // would hang if it looped
      expect(done, isTrue);
    });
  });

  group('showSuccessBurst', () {
    testWidgets('inserts an overlay then removes it after the burst',
        (tester) async {
      late BuildContext ctx;
      await tester.pumpWidget(
        _host(Builder(builder: (c) {
          ctx = c;
          return const SizedBox.expand();
        })),
      );

      showSuccessBurst(ctx);
      await tester.pump(); // build the overlay entry
      expect(find.byType(SuccessBurst), findsOneWidget);

      await tester.pumpAndSettle();
      // Auto-removed once the controller completed.
      expect(find.byType(SuccessBurst), findsNothing);
    });

    testWidgets('flashes briefly and settles even with motion enabled',
        (tester) async {
      AppMotion.disableInfiniteForTests = false;
      addTearDown(() => AppMotion.disableInfiniteForTests = true);

      late BuildContext ctx;
      await tester.pumpWidget(
        _host(Builder(builder: (c) {
          ctx = c;
          return const SizedBox.expand();
        })),
      );
      showSuccessBurst(ctx);
      await tester.pump();
      expect(find.byType(SuccessBurst), findsOneWidget);
      await tester.pumpAndSettle();
      expect(find.byType(SuccessBurst), findsNothing);
    });
  });
}
