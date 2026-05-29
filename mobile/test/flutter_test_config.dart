import 'dart:async';

import 'package:velofit/design/motion.dart';

/// Auto-loaded by `flutter test` for every test in this package. Disables
/// looping animations so shimmer/pulse/wiggle render a static frame and never
/// hang `pumpAndSettle`. Finite animations still run and settle normally.
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  AppMotion.disableInfiniteForTests = true;
  await testMain();
}
