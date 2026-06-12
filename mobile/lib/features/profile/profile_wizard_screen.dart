import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/spacing.dart';
import '../../theme.dart';
import 'trainee_profile.dart';
import 'trainee_profile_repository.dart';

/// 3-step profile wizard: goals → body data → medical. Every step saves its
/// own patch on "הבא", so quitting mid-way loses nothing (issue #82).
class ProfileWizardScreen extends ConsumerStatefulWidget {
  const ProfileWizardScreen({super.key});

  @override
  ConsumerState<ProfileWizardScreen> createState() =>
      _ProfileWizardScreenState();
}

class _ProfileWizardScreenState extends ConsumerState<ProfileWizardScreen> {
  int _step = 0;
  bool _saving = false;

  final _goals = TextEditingController();
  final _height = TextEditingController();
  final _weight = TextEditingController();
  final _medical = TextEditingController();
  DateTime? _dateOfBirth;
  bool _prefilled = false;

  @override
  void dispose() {
    _goals.dispose();
    _height.dispose();
    _weight.dispose();
    _medical.dispose();
    super.dispose();
  }

  void _prefill(TraineeProfile p) {
    if (_prefilled) return;
    _prefilled = true;
    _goals.text = p.goals ?? '';
    _height.text = p.heightCm?.toString() ?? '';
    _weight.text = p.weightKg?.toString() ?? '';
    _medical.text = p.medical ?? '';
    if (p.dateOfBirth != null) {
      _dateOfBirth = DateTime.tryParse(p.dateOfBirth!);
    }
  }

  TraineeProfilePatch _patchForStep() {
    switch (_step) {
      case 0:
        final goals = _goals.text.trim();
        return TraineeProfilePatch(goals: goals.isEmpty ? null : goals);
      case 1:
        return TraineeProfilePatch(
          heightCm: int.tryParse(_height.text.trim()),
          weightKg: int.tryParse(_weight.text.trim()),
          dateOfBirth: _dateOfBirth == null
              ? null
              : '${_dateOfBirth!.year}-${_dateOfBirth!.month.toString().padLeft(2, '0')}-${_dateOfBirth!.day.toString().padLeft(2, '0')}',
        );
      default:
        final medical = _medical.text.trim();
        return TraineeProfilePatch(medical: medical.isEmpty ? null : medical);
    }
  }

  Future<void> _saveAndAdvance() async {
    setState(() => _saving = true);
    try {
      final patch = _patchForStep();
      if (patch.toJson().isNotEmpty) {
        await ref.read(traineeProfileRepositoryProvider).update(patch);
        ref.invalidate(traineeProfileProvider);
      }
      if (!mounted) return;
      if (_step == 2) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('הפרופיל עודכן')),
        );
      } else {
        setState(() => _step++);
      }
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('השמירה נכשלה, נסה שוב')),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _pickDateOfBirth() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _dateOfBirth ?? DateTime(1990),
      firstDate: DateTime(1930),
      lastDate: DateTime.now(),
    );
    if (picked != null) setState(() => _dateOfBirth = picked);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final profile = ref.watch(traineeProfileProvider).valueOrNull;
    if (profile != null) _prefill(profile);

    const titles = ['מה המטרות שלך?', 'קצת נתונים', 'מידע רפואי'];

    return Scaffold(
      appBar: AppBar(title: Text('השלמת פרופיל · ${_step + 1}/3')),
      body: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Step progress: three sand/teal segments.
            Row(
              children: [
                for (var i = 0; i < 3; i++) ...[
                  if (i > 0) const SizedBox(width: AppSpacing.xxs),
                  Expanded(
                    child: Container(
                      height: 3,
                      decoration: BoxDecoration(
                        color: i <= _step ? BrandColors.teal : BrandColors.line,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(titles[_step], style: theme.textTheme.headlineSmall),
            const SizedBox(height: AppSpacing.md),
            Expanded(child: _stepFields()),
            FilledButton(
              key: const Key('wizard-next'),
              onPressed: _saving ? null : _saveAndAdvance,
              child: Text(_step == 2 ? 'סיום' : 'הבא'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _stepFields() {
    switch (_step) {
      case 0:
        return TextField(
          key: const Key('wizard-goals'),
          controller: _goals,
          maxLines: 4,
          decoration: const InputDecoration(
            labelText: 'מטרות אימון',
            hintText: 'למשל: לרדת במשקל, לבנות כוח, להרגיש טוב יותר',
          ),
        );
      case 1:
        return Column(
          children: [
            TextField(
              key: const Key('wizard-height'),
              controller: _height,
              keyboardType: const TextInputType.numberWithOptions(decimal: false),
              decoration: const InputDecoration(labelText: 'גובה (ס״מ)'),
            ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              key: const Key('wizard-weight'),
              controller: _weight,
              keyboardType: const TextInputType.numberWithOptions(decimal: false),
              decoration: const InputDecoration(labelText: 'משקל (ק״ג)'),
            ),
            const SizedBox(height: AppSpacing.sm),
            OutlinedButton.icon(
              key: const Key('wizard-dob'),
              onPressed: _pickDateOfBirth,
              icon: const Icon(Icons.cake_outlined, size: 18),
              label: Text(
                _dateOfBirth == null
                    ? 'תאריך לידה'
                    : '${_dateOfBirth!.day}.${_dateOfBirth!.month}.${_dateOfBirth!.year}',
              ),
            ),
          ],
        );
      default:
        return TextField(
          key: const Key('wizard-medical'),
          controller: _medical,
          maxLines: 4,
          decoration: const InputDecoration(
            labelText: 'מידע רפואי',
            hintText: 'פציעות, רגישויות, או "אין" — המאמן רואה את זה',
          ),
        );
    }
  }
}
