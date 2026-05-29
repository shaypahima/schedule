import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:velofit/design/motion.dart';
import 'package:velofit/design/widgets.dart';

Widget _host(Widget child, {bool reduceMotion = false}) {
  return MediaQuery(
    data: MediaQueryData(disableAnimations: reduceMotion),
    child: MaterialApp(
      home: Directionality(
        textDirection: TextDirection.rtl,
        child: Scaffold(body: child),
      ),
    ),
  );
}

void main() {
  group('PressableScale', () {
    testWidgets('renders its child', (tester) async {
      await tester.pumpWidget(
        _host(const PressableScale(child: Text('לחץ'))),
      );
      expect(find.text('לחץ'), findsOneWidget);
    });

    testWidgets('invokes onTap when tapped', (tester) async {
      var taps = 0;
      await tester.pumpWidget(
        _host(PressableScale(onTap: () => taps++, child: const Text('לחץ'))),
      );
      await tester.tap(find.text('לחץ'));
      await tester.pumpAndSettle();
      expect(taps, 1);
    });

    testWidgets('settles (no infinite animation) so pumpAndSettle returns',
        (tester) async {
      await tester.pumpWidget(
        _host(const PressableScale(child: Text('לחץ'))),
      );
      // Would hang if PressableScale ran an unbounded animation.
      await tester.pumpAndSettle();
      expect(find.text('לחץ'), findsOneWidget);
    });
  });

  group('SkeletonList', () {
    testWidgets('renders `count` skeleton boxes', (tester) async {
      await tester.pumpWidget(_host(const SkeletonList(count: 3)));
      // 3 skeleton containers nested in the list.
      expect(
        find.byKey(const Key('skeleton-box')),
        findsNWidgets(3),
      );
    });

    testWidgets('does not hang pumpAndSettle even though it shimmers',
        (tester) async {
      // disableInfiniteForTests is set by flutter_test_config.dart, so the
      // shimmer collapses to a static frame here.
      await tester.pumpWidget(_host(const SkeletonList(count: 4)));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('skeleton-box')), findsNWidgets(4));
    });
  });

  group('AppMotion gate', () {
    testWidgets('infiniteMotionEnabled is false under reduce-motion',
        (tester) async {
      // Force the test-disable off so we isolate the reduce-motion branch.
      AppMotion.disableInfiniteForTests = false;
      addTearDown(() => AppMotion.disableInfiniteForTests = true);

      late bool enabled;
      await tester.pumpWidget(
        _host(
          reduceMotion: true,
          Builder(builder: (context) {
            enabled = AppMotion.infiniteMotionEnabled(context);
            return const SizedBox();
          }),
        ),
      );
      expect(enabled, isFalse);
    });

    testWidgets('infiniteMotionEnabled is true when motion allowed',
        (tester) async {
      AppMotion.disableInfiniteForTests = false;
      addTearDown(() => AppMotion.disableInfiniteForTests = true);

      late bool enabled;
      await tester.pumpWidget(
        _host(
          reduceMotion: false,
          Builder(builder: (context) {
            enabled = AppMotion.infiniteMotionEnabled(context);
            return const SizedBox();
          }),
        ),
      );
      expect(enabled, isTrue);
    });
  });
}
