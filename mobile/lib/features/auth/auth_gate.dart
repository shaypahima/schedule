import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../profile/profile_repository.dart';
import 'login_screen.dart';
import 'role_router.dart';

/// Watches Supabase auth state and switches between [LoginScreen]
/// (no session) and [RoleRouter] (active session). Handles both cold-start
/// session restore and the post-OAuth deep-link callback.
///
/// On any auth state change (sign-in OR sign-out) it invalidates the
/// cached profile so the new user's profile is fetched fresh — fixes the
/// "switching users still shows the previous user's profile" bug.
class AuthGate extends ConsumerStatefulWidget {
  const AuthGate({super.key});

  @override
  ConsumerState<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends ConsumerState<AuthGate> {
  Session? _session;
  String? _userId; // track the user id so we know when it actually changes
  StreamSubscription<AuthState>? _sub;

  @override
  void initState() {
    super.initState();
    _session = Supabase.instance.client.auth.currentSession;
    _userId = _session?.user.id;
    _sub = Supabase.instance.client.auth.onAuthStateChange.listen((data) {
      final newUserId = data.session?.user.id;
      if (newUserId != _userId) {
        // User changed (or signed out) — clear the cached profile.
        ref.invalidate(profileProvider);
      }
      if (mounted) {
        setState(() {
          _session = data.session;
          _userId = newUserId;
        });
      }
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _session == null ? const LoginScreen() : const RoleRouter();
  }
}
