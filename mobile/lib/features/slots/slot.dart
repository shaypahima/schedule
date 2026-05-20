class Slot {
  final String id;
  final String date; // YYYY-MM-DD
  final String startTime; // HH:mm
  final int capacity;
  final int currentBookings;
  final int remainingCapacity;
  final bool lockoutOverride;
  final bool lockedOut;

  const Slot({
    required this.id,
    required this.date,
    required this.startTime,
    required this.capacity,
    required this.currentBookings,
    required this.remainingCapacity,
    required this.lockoutOverride,
    required this.lockedOut,
  });

  bool get isFull => remainingCapacity <= 0;

  factory Slot.fromJson(Map<String, dynamic> json) => Slot(
        id: json['id'] as String,
        date: json['date'] as String,
        startTime: json['startTime'] as String,
        capacity: json['capacity'] as int,
        currentBookings: json['currentBookings'] as int,
        remainingCapacity: json['remainingCapacity'] as int,
        lockoutOverride: json['lockoutOverride'] as bool,
        lockedOut: json['lockedOut'] as bool,
      );
}
