import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../utils/url_opener.dart';
import 'coach_info_repository.dart';

class ContactCoachCard extends ConsumerWidget {
  /// Slot start time (HH:mm) — embedded in the WhatsApp prefilled message.
  final String? lockedSlotStartTime;
  const ContactCoachCard({super.key, this.lockedSlotStartTime});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(coachInfoProvider);
    return Card(
      key: const Key('contact-coach-card'),
      margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 0),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: async.maybeWhen(
          orElse: () => const SizedBox(
            height: 24,
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          ),
          data: (info) {
            if (info == null || !info.hasContact) {
              return const Text(
                'פרטי קשר של המאמן חסרים — פנה למאמן',
                key: Key('contact-coach-missing'),
              );
            }
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('פנה למאמן: ${info.name}',
                    style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: [
                    FilledButton.tonalIcon(
                      key: const Key('contact-coach-whatsapp'),
                      icon: const Icon(Icons.chat_bubble_outline),
                      label: const Text('וואטסאפ'),
                      onPressed: () {
                        final msg = lockedSlotStartTime != null
                            ? 'היי, אני נעול מהאימון ב-$lockedSlotStartTime, אפשר חריג?'
                            : 'היי, צריך לדבר על אימון';
                        final url = Uri.parse(
                          'https://wa.me/${info.contactPhone!.replaceFirst("+", "")}?text=${Uri.encodeComponent(msg)}',
                        );
                        ref.read(urlOpenerProvider).open(url);
                      },
                    ),
                    FilledButton.tonalIcon(
                      key: const Key('contact-coach-call'),
                      icon: const Icon(Icons.call_outlined),
                      label: const Text('התקשרות'),
                      onPressed: () {
                        final url = Uri.parse('tel:${info.contactPhone}');
                        ref.read(urlOpenerProvider).open(url);
                      },
                    ),
                  ],
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
