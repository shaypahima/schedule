import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/spacing.dart';
import '../../design/widgets.dart';
import 'coach_info.dart';
import 'coach_info_repository.dart';

class CoachSettingsScreen extends ConsumerStatefulWidget {
  const CoachSettingsScreen({super.key});

  @override
  ConsumerState<CoachSettingsScreen> createState() => _CoachSettingsScreenState();
}

class _CoachSettingsScreenState extends ConsumerState<CoachSettingsScreen> {
  final _phone = TextEditingController();
  final _bio = TextEditingController();
  final _specialty = TextEditingController();
  final _years = TextEditingController();

  bool _initialised = false;
  bool _saving = false;
  String? _error;
  String? _phoneError;
  String? _yearsError;

  @override
  void dispose() {
    _phone.dispose();
    _bio.dispose();
    _specialty.dispose();
    _years.dispose();
    super.dispose();
  }

  CoachInfoPatch? _buildPatch() {
    setState(() {
      _phoneError = null;
      _yearsError = null;
    });

    String? phone;
    if (_phone.text.trim().isNotEmpty) {
      phone = _phone.text.trim();
      if (!RegExp(r'^\+\d{8,15}$').hasMatch(phone)) {
        setState(() => _phoneError = 'טלפון לא תקין (+972...)');
        return null;
      }
    }

    int? years;
    if (_years.text.trim().isNotEmpty) {
      years = int.tryParse(_years.text.trim());
      if (years == null || years < 0 || years > 80) {
        setState(() => _yearsError = 'מספר לא תקין (0-80)');
        return null;
      }
    }

    return CoachInfoPatch(
      contactPhone: phone,
      bio: _bio.text.trim().isEmpty ? null : _bio.text.trim(),
      specialty: _specialty.text.trim().isEmpty ? null : _specialty.text.trim(),
      yearsExperience: years,
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
      await ref.read(coachInfoRepositoryProvider).update(patch);
      ref.invalidate(coachInfoProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('נשמר')));
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(coachInfoProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('הגדרות מאמן')),
      body: async.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(AppSpacing.md),
          child: SkeletonList(count: 3),
        ),
        error: (err, _) => const ErrorCard(message: 'שגיאה בטעינת ההגדרות'),
        data: (info) {
          if (!_initialised) {
            _phone.text = info?.contactPhone ?? '';
            _bio.text = info?.bio ?? '';
            _specialty.text = info?.specialty ?? '';
            _years.text = info?.yearsExperience?.toString() ?? '';
            _initialised = true;
          }
          return ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              const SectionHeader('יצירת קשר'),
              TextField(
                key: const Key('contact-phone-field'),
                controller: _phone,
                keyboardType: TextInputType.phone,
                decoration: InputDecoration(
                  labelText: 'טלפון (E.164, למשל +972501234567)',
                  errorText: _phoneError,
                ),
              ),
              const SizedBox(height: AppSpacing.xl),
              const SectionHeader('הצגה למתאמנים'),
              TextField(
                key: const Key('coach-specialty-field'),
                controller: _specialty,
                decoration: const InputDecoration(
                  labelText: 'התמחות (למשל: כוח, קרדיו, שיקום)',
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                key: const Key('coach-years-field'),
                controller: _years,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: false),
                decoration: InputDecoration(
                  labelText: 'שנות ניסיון',
                  errorText: _yearsError,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                key: const Key('coach-bio-field'),
                controller: _bio,
                minLines: 4,
                maxLines: 8,
                decoration: const InputDecoration(
                  labelText: 'תיאור קצר על עצמך',
                  hintText: 'כמה משפטים על הניסיון והסגנון שלך',
                ),
              ),
              const SizedBox(height: AppSpacing.xl),
              FilledButton(
                key: const Key('contact-phone-save'),
                onPressed: _saving ? null : _save,
                child: Text(_saving ? 'שומר...' : 'שמירה'),
              ),
              if (_error != null) ...[
                const SizedBox(height: AppSpacing.md),
                ErrorCard(
                  key: const Key('coach-settings-error'),
                  message: _error!,
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}
