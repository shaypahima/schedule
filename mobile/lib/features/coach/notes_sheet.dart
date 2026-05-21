import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'notes_repository.dart';

/// Bottom sheet showing all notes for a trainee + an inline add form.
/// Each note has an edit/delete affordance and a visibility toggle.
class NotesSheet extends ConsumerStatefulWidget {
  final String traineeId;
  final String traineeName;
  const NotesSheet({super.key, required this.traineeId, required this.traineeName});

  @override
  ConsumerState<NotesSheet> createState() => _NotesSheetState();
}

class _NotesSheetState extends ConsumerState<NotesSheet> {
  final _bodyCtl = TextEditingController();
  bool _visibleToTrainee = false;
  bool _submitting = false;

  @override
  void dispose() {
    _bodyCtl.dispose();
    super.dispose();
  }

  Future<void> _addNote() async {
    final body = _bodyCtl.text.trim();
    if (body.isEmpty) return;
    setState(() => _submitting = true);
    try {
      await ref.read(notesRepositoryProvider).create(
            traineeId: widget.traineeId,
            body: body,
            visibleToTrainee: _visibleToTrainee,
          );
      _bodyCtl.clear();
      ref.invalidate(notesForTraineeProvider(widget.traineeId));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('שגיאה: $e')));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _toggleVisibility(CoachNote note) async {
    try {
      await ref.read(notesRepositoryProvider).update(
            note.id,
            visibleToTrainee: !note.visibleToTrainee,
          );
      ref.invalidate(notesForTraineeProvider(widget.traineeId));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('שגיאה: $e')));
    }
  }

  Future<void> _deleteNote(CoachNote note) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('למחוק את ההערה?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false), child: const Text('לא')),
          FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true), child: const Text('מחק')),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref.read(notesRepositoryProvider).delete(note.id);
      ref.invalidate(notesForTraineeProvider(widget.traineeId));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('שגיאה: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final notesAsync = ref.watch(notesForTraineeProvider(widget.traineeId));
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.7,
      maxChildSize: 0.95,
      minChildSize: 0.4,
      builder: (context, scrollController) {
        return Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom + 12,
            top: 12,
            left: 20,
            right: 20,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.4),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Text(
                'הערות על ${widget.traineeName}',
                style: Theme.of(context).textTheme.titleLarge,
                textAlign: TextAlign.right,
              ),
              const SizedBox(height: 12),
              Expanded(
                child: notesAsync.when(
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (err, _) => Center(child: Text('שגיאה: $err')),
                  data: (notes) {
                    if (notes.isEmpty) {
                      return const Center(child: Text('אין הערות עדיין'));
                    }
                    return ListView.separated(
                      controller: scrollController,
                      itemCount: notes.length,
                      separatorBuilder: (_, _) => const Divider(height: 1),
                      itemBuilder: (_, i) {
                        final n = notes[i];
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text(n.body),
                              const SizedBox(height: 6),
                              Row(
                                children: [
                                  IconButton(
                                    key: Key('toggle-visibility-${n.id}'),
                                    tooltip: n.visibleToTrainee ? 'גלוי למתאמן' : 'פרטי',
                                    icon: Icon(n.visibleToTrainee
                                        ? Icons.visibility
                                        : Icons.visibility_off),
                                    onPressed: () => _toggleVisibility(n),
                                  ),
                                  const Spacer(),
                                  IconButton(
                                    key: Key('delete-note-${n.id}'),
                                    icon: const Icon(Icons.delete_outline),
                                    onPressed: () => _deleteNote(n),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        );
                      },
                    );
                  },
                ),
              ),
              const Divider(),
              TextField(
                key: const Key('new-note-body'),
                controller: _bodyCtl,
                maxLines: 3,
                decoration: const InputDecoration(
                  hintText: 'הערה חדשה...',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: SwitchListTile(
                      key: const Key('visible-to-trainee-switch'),
                      title: const Text('גלוי למתאמן'),
                      value: _visibleToTrainee,
                      onChanged: (v) => setState(() => _visibleToTrainee = v),
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                  FilledButton(
                    key: const Key('add-note-submit'),
                    onPressed: _submitting ? null : _addNote,
                    child: _submitting
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('הוסף'),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}
