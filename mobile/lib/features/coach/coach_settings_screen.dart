import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'coach_info_repository.dart';

class CoachSettingsScreen extends ConsumerStatefulWidget {
  const CoachSettingsScreen({super.key});

  @override
  ConsumerState<CoachSettingsScreen> createState() => _CoachSettingsScreenState();
}

class _CoachSettingsScreenState extends ConsumerState<CoachSettingsScreen> {
  final _controller = TextEditingController();
  bool _initialised = false;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(coachInfoRepositoryProvider).updateContactPhone(_controller.text.trim());
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('נשמר')));
      ref.invalidate(coachInfoProvider);
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
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(child: Text('שגיאה: $err')),
        data: (info) {
          if (!_initialised) {
            _controller.text = info?.contactPhone ?? '';
            _initialised = true;
          }
          return Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  key: const Key('contact-phone-field'),
                  controller: _controller,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    labelText: 'טלפון ליצירת קשר (E.164, למשל +972501234567)',
                  ),
                ),
                const SizedBox(height: 24),
                FilledButton(
                  key: const Key('contact-phone-save'),
                  onPressed: _saving ? null : _save,
                  child: Text(_saving ? 'שומר...' : 'שמור'),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 16),
                  Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}
