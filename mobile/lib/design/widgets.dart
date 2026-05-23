import 'package:flutter/material.dart';

import '../theme.dart';
import 'spacing.dart';

/// Small uppercase-ish caption used above a data block.
/// Establishes hierarchy without competing with content (Tufte: minimal ornament).
class SectionHeader extends StatelessWidget {
  final String text;
  const SectionHeader(this.text, {super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
      child: Text(
        text,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: BrandColors.inkSoft,
              letterSpacing: 0.4,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}

/// Label/value row aligned to a 24px gutter on the leading edge.
/// Replaces the icon+label+value pattern that was duplicated 3+ places.
/// Empty `value` is shown as a muted "חסר" inline placeholder.
class InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String? value;
  final String? emptyText;

  const InfoRow({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    this.emptyText = 'חסר',
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isEmpty = value == null || value!.isEmpty;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: BrandColors.inkSoft),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: theme.textTheme.labelSmall?.copyWith(
                          color: BrandColors.inkSoft,
                        )),
                const SizedBox(height: 2),
                Text(
                  isEmpty ? emptyText! : value!,
                  style: theme.textTheme.bodyMedium?.copyWith(
                        color: isEmpty ? BrandColors.inkMuted : BrandColors.ink,
                        fontStyle: isEmpty ? FontStyle.italic : FontStyle.normal,
                      ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// 2-column data grid for short label/value pairs (e.g., גובה/משקל/גיל).
class DataGrid extends StatelessWidget {
  final List<InfoRow> children;
  const DataGrid({super.key, required this.children});

  @override
  Widget build(BuildContext context) {
    final pairs = <Widget>[];
    for (var i = 0; i < children.length; i += 2) {
      pairs.add(
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: children[i]),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: i + 1 < children.length
                  ? children[i + 1]
                  : const SizedBox.shrink(),
            ),
          ],
        ),
      );
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: pairs);
  }
}

/// Soft, brand-tinted container — replaces the heavy translucent glass on hero stats.
/// Use over the gradient hero only.
class HeroStat extends StatelessWidget {
  final String value;
  final String label;
  final IconData? icon;
  final Color? accent;

  const HeroStat({
    super.key,
    required this.value,
    required this.label,
    this.icon,
    this.accent,
  });

  @override
  Widget build(BuildContext context) {
    final accentColor = accent ?? Colors.white;
    return Expanded(
      child: Container(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.sm,
          AppSpacing.xs,
          AppSpacing.sm,
          AppSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          border: Border(
            top: BorderSide(color: accentColor.withValues(alpha: 0.8), width: 3),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 14, color: Colors.white.withValues(alpha: 0.85)),
              const SizedBox(height: AppSpacing.xxs),
            ],
            Text(
              value,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    height: 1.05,
                  ),
            ),
            Text(
              label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: Colors.white.withValues(alpha: 0.85),
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Status leading-stripe — replaces CircleAvatar+icon for list status indicators.
/// 3px vertical bar in the status color, no chrome.
class StatusStripeTile extends StatelessWidget {
  final Color stripeColor;
  final Widget title;
  final Widget? subtitle;
  final Widget? trailing;

  const StatusStripeTile({
    super.key,
    required this.stripeColor,
    required this.title,
    this.subtitle,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 3,
            height: 36,
            decoration: BoxDecoration(
              color: stripeColor,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                title,
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  subtitle!,
                ],
              ],
            ),
          ),
          if (trailing != null) ...[
            const SizedBox(width: AppSpacing.sm),
            trailing!,
          ],
        ],
      ),
    );
  }
}
