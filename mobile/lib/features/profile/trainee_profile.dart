/// The trainee-specific fields stored in `trainee_profile` (Phase 14+18).
/// Mirrors the JSON shape returned by `/api/me/profile`.
class TraineeProfile {
  final String? phone;
  final String? introText;
  final String? photoUrl;
  final String? dateOfBirth; // YYYY-MM-DD
  final int? heightCm;
  final int? weightKg;
  final String? goals;
  final String? medical;

  const TraineeProfile({
    this.phone,
    this.introText,
    this.photoUrl,
    this.dateOfBirth,
    this.heightCm,
    this.weightKg,
    this.goals,
    this.medical,
  });

  factory TraineeProfile.fromJson(Map<String, dynamic> json) => TraineeProfile(
        phone: json['phone'] as String?,
        introText: json['introText'] as String?,
        photoUrl: json['photoUrl'] as String?,
        dateOfBirth: json['dateOfBirth'] as String?,
        heightCm: (json['heightCm'] as num?)?.toInt(),
        weightKg: (json['weightKg'] as num?)?.toInt(),
        goals: json['goals'] as String?,
        medical: json['medical'] as String?,
      );
}

/// A partial update payload. Only non-null fields are sent.
class TraineeProfilePatch {
  final String? phone;
  final String? dateOfBirth;
  final int? heightCm;
  final int? weightKg;
  final String? goals;
  final String? medical;

  const TraineeProfilePatch({
    this.phone,
    this.dateOfBirth,
    this.heightCm,
    this.weightKg,
    this.goals,
    this.medical,
  });

  Map<String, dynamic> toJson() {
    final m = <String, dynamic>{};
    if (phone != null) m['phone'] = phone;
    if (dateOfBirth != null) m['dateOfBirth'] = dateOfBirth;
    if (heightCm != null) m['heightCm'] = heightCm;
    if (weightKg != null) m['weightKg'] = weightKg;
    if (goals != null) m['goals'] = goals;
    if (medical != null) m['medical'] = medical;
    return m;
  }
}
