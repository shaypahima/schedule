import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'trainee_profile.dart';
import 'trainee_profile_repository.dart';

class TraineeProfileEditorScreen extends ConsumerStatefulWidget {
  const TraineeProfileEditorScreen({super.key});

  @override
  ConsumerState<TraineeProfileEditorScreen> createState() =>
      _TraineeProfileEditorScreenState();
}

class _TraineeProfileEditorScreenState
    extends ConsumerState<TraineeProfileEditorScreen> {
  final _phone = TextEditingController();
  final _dob = TextEditingController();
  final _height = TextEditingController();
  final _weight = TextEditingController();
  final _goals = TextEditingController();
  final _medical = TextEditingController();

  bool _initialised = false;
  bool _saving = false;
  String? _error;
  String? _heightError;
  String? _weightError;
  String? _phoneError;

  @override
  void dispose() {
    _phone.dispose();
    _dob.dispose();
    _height.dispose();
    _weight.dispose();
    _goals.dispose();
    _medical.dispose();
    super.dispose();
  }

  void _prefill(TraineeProfile p) {
    _phone.text = p.phone ?? '';
    _dob.text = p.dateOfBirth ?? '';
    _height.text = p.heightCm?.toString() ?? '';
    _weight.text = p.weightKg?.toString() ?? '';
    _goals.text = p.goals ?? '';
    _medical.text = p.medical ?? '';
    _initialised = true;
  }

  TraineeProfilePatch? _buildPatch() {
    setState(() {
      _heightError = null;
      _weightError = null;
      _phoneError = null;
    });

    int? height;
    if (_height.text.trim().isNotEmpty) {
      height = int.tryParse(_height.text.trim());
      if (height == null || height < 50 || height > 250) {
        setState(() => _heightError = 'גובה לא תקין');
        return null;
      }
    }

    int? weight;
    if (_weight.text.trim().isNotEmpty) {
      weight = int.tryParse(_weight.text.trim());
      if (weight == null || weight < 20 || weight > 400) {
        setState(() => _weightError = 'משקל לא תקין');
        return null;
      }
    }

    String? phone;
    if (_phone.text.trim().isNotEmpty) {
      phone = _phone.text.trim();
      if (!RegExp(r'^\+\d{8,15}$').hasMatch(phone)) {
        setState(() => _phoneError = 'טלפון לא תקין (פורמט: +972...)');
        return null;
      }
    }

    String? dob;
    if (_dob.text.trim().isNotEmpty) dob = _dob.text.trim();

    return TraineeProfilePatch(
      phone: phone,
      dateOfBirth: dob,
      heightCm: height,
      weightKg: weight,
      goals: _goals.text.trim().isEmpty ? null : _goals.text.trim(),
      medical: _medical.text.trim().isEmpty ? null : _medical.text.trim(),
    );
  }

  Future<void> _save() async {
    final patch = _buildPatch();
    if (patch == null) return;

    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(traineeProfileRepositoryProvider).update(patch);
      ref.invalidate(traineeProfileProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('נשמר')),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(traineeProfileProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('עריכת פרופיל')),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(
          child: Text('שגיאה: $err', key: const Key('editor-fetch-error')),
        ),
        data: (profile) {
          if (!_initialised) _prefill(profile);
          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              _section('פרטי קשר'),
              TextField(
                key: const Key('phone-field'),
                controller: _phone,
                keyboardType: TextInputType.phone,
                decoration: InputDecoration(
                  labelText: 'טלפון (E.164, +972...)',
                  errorText: _phoneError,
                ),
              ),
              const SizedBox(height: 16),
              _section('פרטים אישיים'),
              TextField(
                key: const Key('dob-field'),
                controller: _dob,
                decoration: const InputDecoration(
                  labelText: 'תאריך לידה (YYYY-MM-DD)',
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      key: const Key('height-field'),
                      controller: _height,
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                        labelText: 'גובה (ס״מ)',
                        errorText: _heightError,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                      key: const Key('weight-field'),
                      controller: _weight,
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                        labelText: 'משקל (ק״ג)',
                        errorText: _weightError,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              _section('מטרות וביטחון'),
              TextField(
                key: const Key('goals-field'),
                controller: _goals,
                minLines: 2,
                maxLines: 5,
                decoration: const InputDecoration(
                  labelText: 'מטרות האימון',
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                key: const Key('medical-field'),
                controller: _medical,
                minLines: 2,
                maxLines: 5,
                decoration: const InputDecoration(
                  labelText: 'מידע רפואי / מגבלות',
                ),
              ),
              const SizedBox(height: 24),
              FilledButton(
                key: const Key('save-button'),
                onPressed: _saving ? null : _save,
                child: Text(_saving ? 'שומר...' : 'שמירה'),
              ),
              if (_error != null) ...[
                const SizedBox(height: 16),
                Text(
                  _error!,
                  key: const Key('editor-error'),
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
            ],
          );
        },
      ),
    );
  }

  Widget _section(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(
          text,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                color: Theme.of(context).colorScheme.primary,
                fontWeight: FontWeight.bold,
              ),
        ),
      );
}
