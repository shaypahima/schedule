import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../theme.dart';
import '../profile/profile_repository.dart';
import 'intro_repository.dart';
import 'role_router.dart';

class IntroFormScreen extends ConsumerStatefulWidget {
  const IntroFormScreen({super.key});

  @override
  ConsumerState<IntroFormScreen> createState() => _IntroFormScreenState();
}

class _IntroFormScreenState extends ConsumerState<IntroFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phoneCtl = TextEditingController();
  final _introCtl = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _phoneCtl.dispose();
    _introCtl.dispose();
    super.dispose();
  }

  String _normalizePhone(String raw) {
    final cleaned = raw.replaceAll(RegExp(r'[\s\-()]'), '');
    if (cleaned.startsWith('+')) return cleaned;
    if (cleaned.startsWith('972')) return '+$cleaned';
    if (cleaned.startsWith('0')) return '+972${cleaned.substring(1)}';
    return cleaned;
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref.read(introRepositoryProvider).submit(
            phone: _normalizePhone(_phoneCtl.text),
            introText: _introCtl.text.trim(),
          );
      // Refresh profile so the router transitions out of the intro screen.
      ref.invalidate(profileProvider);
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const RoleRouter()),
      );
    } on IntroFailure catch (e) {
      setState(() => _error = _humanError(e.code, e.message));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  String _humanError(String code, String fallback) {
    switch (code) {
      case 'PHONE_INVALID':
        return 'מספר הטלפון אינו תקין';
      case 'INTRO_TOO_SHORT':
        return 'נא לכתוב לפחות 10 תווים';
      case 'INTRO_ALREADY_SUBMITTED':
        return 'כבר שלחת את הטופס';
      default:
        return fallback;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('הצטרפות')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Form(
            key: _formKey,
            child: ListView(
              children: [
                const SizedBox(height: 8),
                Text(
                  'ברוך הבא לבלופיט!',
                  style: Theme.of(context).textTheme.headlineSmall,
                  textAlign: TextAlign.right,
                ),
                const SizedBox(height: 8),
                const Text(
                  'מלא את הפרטים כדי שהמאמן יוכל לאשר את הבקשה.',
                  textAlign: TextAlign.right,
                ),
                const SizedBox(height: 24),
                TextFormField(
                  key: const Key('intro-phone'),
                  controller: _phoneCtl,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    labelText: 'מספר טלפון',
                    hintText: '0501234567',
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) {
                    final cleaned = (v ?? '').replaceAll(RegExp(r'[\s\-()]'), '');
                    if (cleaned.isEmpty) return 'נדרש מספר טלפון';
                    if (cleaned.length < 9) return 'מספר טלפון קצר מדי';
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                TextFormField(
                  key: const Key('intro-text'),
                  controller: _introCtl,
                  maxLines: 5,
                  decoration: const InputDecoration(
                    labelText: 'למה אתה רוצה להתאמן?',
                    hintText: 'ספר על עצמך בקצרה (לפחות 10 תווים)',
                    border: OutlineInputBorder(),
                    alignLabelWithHint: true,
                  ),
                  validator: (v) {
                    if ((v ?? '').trim().length < 10) {
                      return 'לפחות 10 תווים';
                    }
                    return null;
                  },
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    _error!,
                    style: const TextStyle(color: BrandColors.error),
                    textAlign: TextAlign.right,
                  ),
                ],
                const SizedBox(height: 24),
                FilledButton(
                  key: const Key('intro-submit'),
                  onPressed: _submitting ? null : _submit,
                  child: _submitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('שלח לאישור המאמן'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
