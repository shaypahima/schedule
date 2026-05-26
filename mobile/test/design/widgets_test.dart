import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:velofit/design/widgets.dart';

Widget _harness(Widget child) => MaterialApp(
      builder: (context, c) => Directionality(
        textDirection: TextDirection.rtl,
        child: c ?? const SizedBox.shrink(),
      ),
      home: Scaffold(body: child),
    );

void main() {
  group('EmptyState', () {
    testWidgets('renders icon + headline + helper', (tester) async {
      await tester.pumpWidget(_harness(
        const EmptyState(
          icon: Icons.event_busy_outlined,
          headline: 'אין מועדים',
          helper: 'בחר יום אחר',
        ),
      ));

      expect(find.byIcon(Icons.event_busy_outlined), findsOneWidget);
      expect(find.text('אין מועדים'), findsOneWidget);
      expect(find.text('בחר יום אחר'), findsOneWidget);
    });

    testWidgets('omits helper when null', (tester) async {
      await tester.pumpWidget(_harness(
        const EmptyState(icon: Icons.inbox, headline: 'אין'),
      ));
      expect(find.text('אין'), findsOneWidget);
      // Only one Text widget below the icon (headline). No helper line.
      expect(find.textContaining('בחר'), findsNothing);
    });

    testWidgets('action button renders + tappable', (tester) async {
      var taps = 0;
      await tester.pumpWidget(_harness(
        EmptyState(
          icon: Icons.inbox,
          headline: 'אין',
          action: FilledButton(
            key: const Key('empty-action'),
            onPressed: () => taps++,
            child: const Text('הוסף'),
          ),
        ),
      ));

      await tester.tap(find.byKey(const Key('empty-action')));
      await tester.pumpAndSettle();
      expect(taps, 1);
    });
  });

  group('ErrorCard', () {
    testWidgets('retry button fires onRetry', (tester) async {
      var retries = 0;
      await tester.pumpWidget(_harness(
        ErrorCard(
          message: 'שגיאה',
          retryKey: const Key('retry'),
          onRetry: () => retries++,
        ),
      ));

      expect(find.text('שגיאה'), findsOneWidget);
      expect(find.text('נסה שוב'), findsOneWidget);
      expect(find.byIcon(Icons.error_outline), findsOneWidget);

      await tester.tap(find.byKey(const Key('retry')));
      await tester.pumpAndSettle();
      expect(retries, 1);
    });

    testWidgets('without onRetry omits retry button', (tester) async {
      await tester.pumpWidget(_harness(
        const ErrorCard(message: 'שגיאה'),
      ));
      expect(find.text('נסה שוב'), findsNothing);
    });
  });

  group('SkeletonList', () {
    testWidgets('renders count rounded rectangles, sized by itemHeight',
        (tester) async {
      await tester.pumpWidget(_harness(
        const SkeletonList(count: 3, itemHeight: 40),
      ));

      final containers = find.descendant(
        of: find.byType(SkeletonList),
        matching: find.byWidgetPredicate((w) =>
            w is Container && w.constraints?.maxHeight == 40),
      );
      expect(containers, findsNWidgets(3));
    });

    testWidgets('does not loop animation (static — pumpAndSettle survives)',
        (tester) async {
      await tester.pumpWidget(_harness(const SkeletonList(count: 2)));
      // If SkeletonList had an infinite repeat animation, this would time
      // out (10s default).
      await tester.pumpAndSettle();
      expect(find.byType(SkeletonList), findsOneWidget);
    });
  });

  group('SectionHeader', () {
    testWidgets('renders given text with caption styling', (tester) async {
      await tester.pumpWidget(_harness(const SectionHeader('כותרת')));
      expect(find.text('כותרת'), findsOneWidget);
    });
  });
}
