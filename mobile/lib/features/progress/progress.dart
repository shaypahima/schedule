class MeasurementLog {
  final String id;
  final String traineeId;
  final DateTime loggedAt;
  final double? weightKg;
  final Map<String, dynamic>? metrics;
  final String? photoUrl;
  final String? note;

  const MeasurementLog({
    required this.id,
    required this.traineeId,
    required this.loggedAt,
    this.weightKg,
    this.metrics,
    this.photoUrl,
    this.note,
  });

  factory MeasurementLog.fromJson(Map<String, dynamic> json) => MeasurementLog(
        id: json['id'] as String,
        traineeId: json['traineeId'] as String,
        loggedAt: DateTime.parse(json['loggedAt'] as String),
        weightKg: (json['weightKg'] as num?)?.toDouble(),
        metrics: json['metrics'] as Map<String, dynamic>?,
        photoUrl: json['photoUrl'] as String?,
        note: json['note'] as String?,
      );
}

class ProgressView {
  final List<MeasurementLog> measurements;
  final MeasurementLog? lastMeasurement;

  const ProgressView({required this.measurements, this.lastMeasurement});

  factory ProgressView.fromJson(Map<String, dynamic> json) {
    final list = (json['measurements'] as List? ?? [])
        .cast<Map<String, dynamic>>()
        .map(MeasurementLog.fromJson)
        .toList();
    final last = json['lastMeasurement'] as Map<String, dynamic>?;
    return ProgressView(
      measurements: list,
      lastMeasurement: last != null ? MeasurementLog.fromJson(last) : null,
    );
  }
}

class MeasurementInput {
  final double? weightKg;
  final Map<String, dynamic>? metrics;
  final String? photoUrl;
  final String? note;

  const MeasurementInput({this.weightKg, this.metrics, this.photoUrl, this.note});

  Map<String, dynamic> toJson() {
    final m = <String, dynamic>{};
    if (weightKg != null) m['weightKg'] = weightKg;
    if (metrics != null && metrics!.isNotEmpty) m['metrics'] = metrics;
    if (photoUrl != null && photoUrl!.isNotEmpty) m['photoUrl'] = photoUrl;
    if (note != null && note!.trim().isNotEmpty) m['note'] = note!.trim();
    return m;
  }

  bool get isEmpty => toJson().isEmpty;
}
