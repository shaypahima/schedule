import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/spacing.dart';
import '../../utils/haptics.dart';
import 'progress.dart';
import 'progress_repository.dart';

/// Bottom sheet for logging a measurement. All fields optional; nothing
/// required. Empty submit shows a Hebrew "fill at least one" hint instead of
/// firing a no-op POST (server would reject with EMPTY_PAYLOAD anyway).
class MeasurementLoggerSheet extends ConsumerStatefulWidget {
  const MeasurementLoggerSheet({super.key});

  @override
  ConsumerState<MeasurementLoggerSheet> createState() =>
      _MeasurementLoggerSheetState();
}

class _MeasurementLoggerSheetState
    extends ConsumerState<MeasurementLoggerSheet> {
  final _weightController = TextEditingController();
  final _noteController = TextEditingController();
  int? _energy;
  int? _soreness;
  bool _submitting = false;

  @override
  void dispose() {
    _weightController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  MeasurementInput _buildInput() {
    final weightStr = _weightController.text.trim().replaceAll(',', '.');
    final weight = weightStr.isEmpty ? null : double.tryParse(weightStr);
    final metrics = <String, dynamic>{};
    if (_energy != null) metrics['energy_1to5'] = _energy;
    if (_soreness != null) metrics['soreness_1to5'] = _soreness;
    return MeasurementInput(
      weightKg: weight,
      metrics: metrics.isEmpty ? null : metrics,
      note: _noteController.text,
    );
  }

  Future<void> _submit() async {
    final input = _buildInput();
    if (input.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('יש להזין לפחות שדה אחד')),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      await ref.read(progressRepositoryProvider).logMeasurement(input);
      if (!mounted) return;
      Haptics.logSaved();
      ref.invalidate(progressProvider);
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('נשמר')),
      );
    } on MeasurementValidationFailure catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('שגיאת רשת — נסה שוב')),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      key: const Key('measurement-logger-sheet'),
      padding: EdgeInsets.only(
        left: AppSpacing.lg,
        right: AppSpacing.lg,
        top: AppSpacing.lg,
        bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.lg,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'תיעוד התקדמות',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 4),
          Text(
            'כל השדות אופציונליים. גם רק משקל זה בסדר.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
          const SizedBox(height: AppSpacing.md),
          TextField(
            key: const Key('weight-input'),
            controller: _weightController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
            ],
            decoration: const InputDecoration(
              labelText: 'משקל (ק"ג)',
              hintText: 'לדוגמה: 72.5',
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          _RatingRow(
            label: 'אנרגיה',
            keyPrefix: 'energy',
            value: _energy,
            onChanged: (v) => setState(() => _energy = v),
          ),
          const SizedBox(height: AppSpacing.sm),
          _RatingRow(
            label: 'כאבי שרירים',
            keyPrefix: 'soreness',
            value: _soreness,
            onChanged: (v) => setState(() => _soreness = v),
          ),
          const SizedBox(height: AppSpacing.md),
          TextField(
            key: const Key('note-input'),
            controller: _noteController,
            minLines: 2,
            maxLines: 4,
            decoration: const InputDecoration(
              labelText: 'הערה',
              hintText: 'איך הרגשת? משהו ששווה לזכור?',
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              key: const Key('measurement-submit'),
              onPressed: _submitting ? null : _submit,
              child: _submitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('שמור'),
            ),
          ),
        ],
      ),
    );
  }
}

class _RatingRow extends StatelessWidget {
  final String label;
  final String keyPrefix;
  final int? value;
  final void Function(int?) onChanged;

  const _RatingRow({
    required this.label,
    required this.keyPrefix,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Row(
      children: [
        SizedBox(
          width: 110,
          child: Text(label, style: Theme.of(context).textTheme.bodyMedium),
        ),
        Expanded(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              for (var i = 1; i <= 5; i++)
                _RatingDot(
                  key: Key('$keyPrefix-$i'),
                  value: i,
                  selected: value == i,
                  color: scheme.primary,
                  onTap: () => onChanged(value == i ? null : i),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _RatingDot extends StatelessWidget {
  final int value;
  final bool selected;
  final Color color;
  final VoidCallback onTap;

  const _RatingDot({
    super.key,
    required this.value,
    required this.selected,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: selected ? color : Colors.transparent,
          border: Border.all(color: color, width: 1.5),
        ),
        alignment: Alignment.center,
        child: Text(
          '$value',
          style: TextStyle(
            color: selected ? Colors.white : color,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}
