import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

/// Thin abstraction over `url_launcher.launchUrl` so widget tests can inject
/// a fake that records opened URLs instead of hitting the platform.
abstract class UrlOpener {
  Future<void> open(Uri url);
}

class UrlLauncherUrlOpener implements UrlOpener {
  const UrlLauncherUrlOpener();

  @override
  Future<void> open(Uri url) async {
    final ok = await launchUrl(url, mode: LaunchMode.externalApplication);
    if (!ok) throw 'Could not launch $url';
  }
}

final urlOpenerProvider = Provider<UrlOpener>((ref) => const UrlLauncherUrlOpener());
