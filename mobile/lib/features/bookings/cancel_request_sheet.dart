import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../theme.dart';
import 'booking.dart';
import 'booking_repository.dart';

/// Sheet shown when a trainee taps Cancel on a booking that's inside the
/// 24h window. Submits a cancel REQUEST to the coach instead of an immediate
/// cancellation.
class CancelRequestSheet extends ConsumerStatefulWidget {
  final Booking booking;
  const CancelRequestSheet({super.key, required this.booking});

  @override
  ConsumerState<CancelRequestSheet> createState() => _CancelRequestSheetState();
}

class _CancelRequestSheetState extends ConsumerState<CancelRequestSheet> {
  final _reasonCtl = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _reasonCtl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final reason = _reasonCtl.text.trim();
    if (reason.isEmpty) {
      setState(() => _error = 'נדרשת סיבה');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref.read(bookingRepositoryProvider).requestCancel(
            widget.booking.id,
            reason: reason,
          );
      if (!mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('הבקשה נשלחה למאמן')),
      );
      ref.invalidate(myBookingsProvider);
    } on BookingFailure catch (e) {
      setState(() => _error = _humanError(e.message));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  String _humanError(String code) {
    switch (code) {
      case 'REASON_REQUIRED':
        return 'נדרשת סיבה';
      case 'ALREADY_REQUESTED':
        return 'כבר נשלחה בקשה לאימון הזה';
      default:
        return code;
    }
  }

  @override
  Widget build(BuildContext context) {
    final time = widget.booking.slotStartTime ?? '';
    final date = widget.booking.slotDate ?? '';
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
        top: 16,
        left: 20,
        right: 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'בקשת ביטול',
            style: Theme.of(context).textTheme.titleLarge,
            textAlign: TextAlign.right,
          ),
          const SizedBox(height: 4),
          Text(
            'אימון $date בשעה $time',
            style: Theme.of(context).textTheme.bodyMedium,
            textAlign: TextAlign.right,
          ),
          const SizedBox(height: 12),
          const Text(
            'הביטול דורש אישור המאמן. נא לפרט את הסיבה:',
            textAlign: TextAlign.right,
          ),
          const SizedBox(height: 8),
          TextField(
            key: const Key('cancel-request-reason'),
            controller: _reasonCtl,
            maxLines: 3,
            decoration: const InputDecoration(
              hintText: 'לדוגמה: לא מרגיש טוב, עניינים בעבודה...',
              border: OutlineInputBorder(),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: const TextStyle(color: BrandColors.error)),
          ],
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _submitting ? null : () => Navigator.of(context).pop(),
                  child: const Text('ביטול'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  key: const Key('cancel-request-submit'),
                  onPressed: _submitting ? null : _submit,
                  child: _submitting
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('שלח למאמן'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
