import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/env.dart';
import '../../theme.dart';
import 'auth_repository.dart';
import 'role_router.dart';
import '../dev/dev_login_panel.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref.read(authRepositoryProvider).signInWithPassword(
            email: _emailController.text.trim(),
            password: _passwordController.text,
          );
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const RoleRouter()),
      );
    } on AuthFailure catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('כניסה')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Brand header.
            Center(
              child: Column(
                children: [
                  Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      color: BrandColors.peach.withValues(alpha: 0.55),
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: const Icon(Icons.fitness_center,
                        size: 38, color: BrandColors.teal),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Velofit',
                    style: Theme.of(context).textTheme.displaySmall?.copyWith(
                          color: BrandColors.teal,
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'האימון הבא שלך מתחיל כאן',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: BrandColors.inkSoft,
                        ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 36),
            // Supabase-based auth (email + Google) is unavailable on the local
            // native-Postgres path (no GoTrue) — use the dev quick-login below.
            if (!Env.pgDev) ...[
              TextField(
                key: const Key('email-field'),
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'אימייל'),
              ),
              const SizedBox(height: 16),
              TextField(
                key: const Key('password-field'),
                controller: _passwordController,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'סיסמה'),
              ),
              const SizedBox(height: 24),
              FilledButton(
                key: const Key('submit-button'),
                onPressed: _submitting ? null : _submit,
                child: Text(_submitting ? 'מתחבר...' : 'התחבר'),
              ),
              if (_error != null) ...[
                const SizedBox(height: 16),
                Text(
                  _error!,
                  key: const Key('login-error'),
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                  textAlign: TextAlign.center,
                ),
              ],
              const SizedBox(height: 24),
              const Divider(),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                key: const Key('google-signin-button'),
                icon: const Icon(Icons.g_mobiledata, size: 28),
                label: const Text('המשך עם Google'),
                onPressed: () async {
                  try {
                    await ref.read(authRepositoryProvider).signInWithGoogle();
                  } on AuthFailure catch (e) {
                    if (!mounted) return;
                    setState(() => _error = e.message);
                  }
                },
              ),
            ],
            devLoginPanelFromEnv(),
          ],
        ),
      ),
    );
  }
}
