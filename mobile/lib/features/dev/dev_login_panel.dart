import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/env.dart';
import '../auth/auth_repository.dart';
import '../slots/home_screen.dart';

class DevAccount {
  final String email;
  final String name;
  final String role;
  const DevAccount({required this.email, required this.name, required this.role});
}

List<DevAccount> devAccountsFromEnv() {
  final emails = Env.devTraineeEmails
      .split(',')
      .map((s) => s.trim())
      .where((s) => s.isNotEmpty)
      .toList();
  final names = Env.devTraineeNames
      .split(',')
      .map((s) => s.trim())
      .where((s) => s.isNotEmpty)
      .toList();
  final accounts = <DevAccount>[];
  for (var i = 0; i < emails.length; i++) {
    final name = i < names.length ? names[i] : emails[i].split('@').first;
    accounts.add(DevAccount(email: emails[i], name: name, role: 'trainee'));
  }
  if (Env.devCoachEmail.isNotEmpty) {
    accounts.add(DevAccount(
      email: Env.devCoachEmail,
      name: Env.devCoachName.isEmpty ? 'Coach' : Env.devCoachName,
      role: 'admin',
    ));
  }
  return accounts;
}

/// Public entry point used by [LoginScreen] — renders nothing unless DEV_MODE
/// is set at compile time and credentials are populated.
Widget devLoginPanelFromEnv() {
  if (!Env.devMode) return const SizedBox.shrink();
  if (Env.devPassword.isEmpty) return const SizedBox.shrink();
  final accounts = devAccountsFromEnv();
  if (accounts.isEmpty) return const SizedBox.shrink();
  return DevLoginPanel(accounts: accounts, password: Env.devPassword);
}

class DevLoginPanel extends ConsumerWidget {
  final List<DevAccount> accounts;
  final String password;
  const DevLoginPanel({super.key, required this.accounts, required this.password});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      key: const Key('dev-login-panel'),
      padding: const EdgeInsets.all(12),
      margin: const EdgeInsets.only(top: 32),
      decoration: BoxDecoration(
        color: Colors.amber.shade100,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('DEV MODE — לוגין מהיר', textAlign: TextAlign.center),
          const SizedBox(height: 8),
          for (final acc in accounts)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: OutlinedButton(
                key: Key('dev-login-${acc.email}'),
                onPressed: () async {
                  await ref.read(authRepositoryProvider).signInWithPassword(
                        email: acc.email,
                        password: password,
                      );
                  if (!context.mounted) return;
                  Navigator.of(context).pushReplacement(
                    MaterialPageRoute(builder: (_) => HomeScreen()),
                  );
                },
                child: Text('${acc.name} — ${acc.role == 'admin' ? 'מאמן' : 'מתאמן'}'),
              ),
            ),
        ],
      ),
    );
  }
}
