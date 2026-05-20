class Booking {
  final String id;
  final String slotId;
  final String traineeId;
  final String status; // "confirmed" | "cancelled"
  final String? slotDate; // YYYY-MM-DD (enriched by server)
  final String? slotStartTime; // HH:mm
  final bool isLocked; // within 7h of slot start (server-computed)

  const Booking({
    required this.id,
    required this.slotId,
    required this.traineeId,
    required this.status,
    this.slotDate,
    this.slotStartTime,
    this.isLocked = false,
  });

  bool get isConfirmed => status == 'confirmed';

  factory Booking.fromJson(Map<String, dynamic> json) {
    final slot = json['slot'] as Map<String, dynamic>?;
    return Booking(
      id: json['id'] as String,
      slotId: json['slotId'] as String,
      traineeId: json['traineeId'] as String,
      status: json['status'] as String,
      slotDate: slot?['date'] as String?,
      slotStartTime: slot?['startTime'] as String?,
      isLocked: (json['isLocked'] as bool?) ?? false,
    );
  }
}
