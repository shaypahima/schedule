class CoachInfo {
  final String name;
  final String? contactPhone;

  const CoachInfo({required this.name, required this.contactPhone});

  bool get hasContact => contactPhone != null && contactPhone!.isNotEmpty;

  factory CoachInfo.fromJson(Map<String, dynamic> json) => CoachInfo(
        name: json['name'] as String,
        contactPhone: json['contactPhone'] as String?,
      );
}
