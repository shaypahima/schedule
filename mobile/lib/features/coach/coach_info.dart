class CoachInfo {
  final String name;
  final String? contactPhone;
  final String? bio;
  final String? specialty;
  final int? yearsExperience;

  const CoachInfo({
    required this.name,
    required this.contactPhone,
    this.bio,
    this.specialty,
    this.yearsExperience,
  });

  bool get hasContact => contactPhone != null && contactPhone!.isNotEmpty;

  factory CoachInfo.fromJson(Map<String, dynamic> json) => CoachInfo(
        name: json['name'] as String,
        contactPhone: json['contactPhone'] as String?,
        bio: json['bio'] as String?,
        specialty: json['specialty'] as String?,
        yearsExperience: (json['yearsExperience'] as num?)?.toInt(),
      );
}

class CoachInfoPatch {
  final String? contactPhone;
  final String? bio;
  final String? specialty;
  final int? yearsExperience;

  const CoachInfoPatch({
    this.contactPhone,
    this.bio,
    this.specialty,
    this.yearsExperience,
  });

  Map<String, dynamic> toJson() {
    final m = <String, dynamic>{};
    if (contactPhone != null) m['contactPhone'] = contactPhone;
    if (bio != null) m['bio'] = bio;
    if (specialty != null) m['specialty'] = specialty;
    if (yearsExperience != null) m['yearsExperience'] = yearsExperience;
    return m;
  }
}
