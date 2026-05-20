import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class AuthFailure implements Exception {
  final String message;
  const AuthFailure(this.message);
  @override
  String toString() => 'AuthFailure: $message';
}

abstract class AuthRepository {
  Future<void> signInWithPassword({required String email, required String password});
  Future<void> signOut();
  String? get currentUserId;
  Stream<AuthState> authStateChanges();
}

class SupabaseAuthRepository implements AuthRepository {
  final SupabaseClient _client;
  SupabaseAuthRepository(this._client);

  @override
  Future<void> signInWithPassword({required String email, required String password}) async {
    try {
      await _client.auth.signInWithPassword(email: email, password: password);
    } on AuthException catch (e) {
      throw AuthFailure(e.message);
    }
  }

  @override
  Future<void> signOut() => _client.auth.signOut();

  @override
  String? get currentUserId => _client.auth.currentUser?.id;

  @override
  Stream<AuthState> authStateChanges() => _client.auth.onAuthStateChange;
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return SupabaseAuthRepository(Supabase.instance.client);
});
