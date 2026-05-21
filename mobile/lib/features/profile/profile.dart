class Profile {
  final String id;
  final String email;
  final String name;
  final String role; // 'coach' | 'trainee'
  final String status; // 'pending' | 'active' | 'rejected' | 'deactivated'
  final bool hasIntro;
  final String? phone;

  const Profile({
    required this.id,
    required this.email,
    required this.name,
    required this.role,
    this.status = 'active',
    this.hasIntro = false,
    this.phone,
  });

  factory Profile.fromJson(Map<String, dynamic> json) => Profile(
        // Backend returns `userId` in the new shape (RFC #43), but `id` was the
        // legacy field — accept either.
        id: (json['userId'] ?? json['id']) as String,
        email: json['email'] as String,
        name: json['name'] as String,
        role: json['role'] as String,
        status: (json['status'] as String?) ?? 'active',
        hasIntro: (json['hasIntro'] as bool?) ?? false,
        phone: json['phone'] as String?,
      );
}
