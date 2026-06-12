import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../theme.dart';

/// Properly-branded "Continue with Google" button — the real multicolor Google
/// "G" on a clean white pill with a subtle border. Matches Google's sign-in
/// branding rather than a generic Material icon.
class GoogleSignInButton extends StatelessWidget {
  final VoidCallback onPressed;
  final String label;

  const GoogleSignInButton({
    super.key,
    required this.onPressed,
    this.label = 'המשך עם Google',
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 52,
      child: OutlinedButton(
        key: const Key('google-signin-button'),
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          backgroundColor: Colors.white,
          foregroundColor: BrandColors.ink,
          side: BorderSide(color: BrandColors.line),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            SvgPicture.asset('assets/brand/google_g.svg', width: 20, height: 20),
            const SizedBox(width: 12),
            Text(
              label,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: BrandColors.ink,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
