import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:velofit/utils/haptics.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final calls = <MethodCall>[];
  setUp(() {
    calls.clear();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (call) async {
      calls.add(call);
      return null;
    });
  });
  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, null);
  });

  Future<void> expectFeedback(
      Future<void> Function() intent, String type) async {
    await intent();
    final haptic = calls.where((c) => c.method == 'HapticFeedback.vibrate');
    expect(haptic, hasLength(1));
    expect(haptic.single.arguments, type);
  }

  test('bookingSuccess → lightImpact', () async {
    await expectFeedback(Haptics.bookingSuccess, 'HapticFeedbackType.lightImpact');
  });

  test('logSaved → lightImpact', () async {
    await expectFeedback(Haptics.logSaved, 'HapticFeedbackType.lightImpact');
  });

  test('noShowMark → heavyImpact', () async {
    await expectFeedback(Haptics.noShowMark, 'HapticFeedbackType.heavyImpact');
  });

  test('select → mediumImpact', () async {
    await expectFeedback(Haptics.select, 'HapticFeedbackType.mediumImpact');
  });
}
