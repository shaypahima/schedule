import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../theme.dart';
import 'motion.dart';
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

/// A large number that counts up to [value] on first appear and renders with
/// tabular figures (digits don't jiggle as they change). The count-up is
/// finite, but gated by [AppMotion.infiniteMotionEnabled] so reduce-motion
/// users and widget tests see the final value immediately.
///
/// The emotional payload of a fitness app lives in its numbers (streak,
/// weight, attendance) — this gives them a moment.
class HeroNumber extends StatelessWidget {
  final num value;
  final int fractionDigits;
  final String prefix;
  final String suffix;
  final TextStyle? style;

  const HeroNumber({
    super.key,
    required this.value,
    this.fractionDigits = 0,
    this.prefix = '',
    this.suffix = '',
    this.style,
  });

  String _fmt(num v) => '$prefix${v.toStringAsFixed(fractionDigits)}$suffix';

  @override
  Widget build(BuildContext context) {
    final base = (style ?? Theme.of(context).textTheme.headlineSmall)?.copyWith(
      fontFeatures: const [FontFeature.tabularFigures()],
    );
    final animate = AppMotion.infiniteMotionEnabled(context) && value != 0;
    if (!animate) {
      return Text(_fmt(value), style: base);
    }
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: value.toDouble()),
      duration: AppMotion.emphasized,
      curve: AppMotion.entry,
      builder: (context, v, _) => Text(
        _fmt(fractionDigits == 0 ? v.round() : v),
        style: base,
      ),
    );
  }
}

/// Soft, brand-tinted container — replaces the heavy translucent glass on hero stats.
/// Use over the gradient hero only. Pass [valueWidget] (e.g. a [HeroNumber])
/// to render an animated number instead of the plain [value] string.
class HeroStat extends StatelessWidget {
  final String value;
  final Widget? valueWidget;
  final String label;
  final IconData? icon;
  final Color? accent;

  const HeroStat({
    super.key,
    required this.value,
    this.valueWidget,
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
            valueWidget ??
                Text(
                  value,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        height: 1.05,
                        fontFeatures: const [FontFeature.tabularFigures()],
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

/// Error card — error-tinted container with icon, message, and optional retry.
/// Replaces bare `Text('שגיאה: $err')`.
class ErrorCard extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;
  final String retryLabel;
  final Key? retryKey;

  const ErrorCard({
    super.key,
    required this.message,
    this.onRetry,
    this.retryLabel = 'נסה שוב',
    this.retryKey,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: BrandColors.error.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          border: const Border(
            right: BorderSide(color: BrandColors.error, width: 3),
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, color: BrandColors.error, size: 20),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                message,
                style: theme.textTheme.bodyMedium?.copyWith(color: BrandColors.ink),
              ),
            ),
            if (onRetry != null) ...[
              const SizedBox(width: AppSpacing.sm),
              TextButton(
                key: retryKey,
                onPressed: onRetry,
                child: Text(retryLabel),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Empty state — icon + headline + helper. Replaces bare "אין X" text.
/// When the recovery action is an already-visible affordance (e.g., the day
/// picker), helper text alone suffices and no button is rendered.
class EmptyState extends StatelessWidget {
  final IconData icon;
  final String headline;
  final String? helper;
  final Widget? action;

  const EmptyState({
    super.key,
    required this.icon,
    required this.headline,
    this.helper,
    this.action,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xl),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 40, color: BrandColors.inkSoft),
          const SizedBox(height: AppSpacing.sm),
          Text(
            headline,
            textAlign: TextAlign.center,
            style: theme.textTheme.titleSmall?.copyWith(color: BrandColors.ink),
          ),
          if (helper != null) ...[
            const SizedBox(height: AppSpacing.xxs),
            Text(
              helper!,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall?.copyWith(
                    color: BrandColors.inkSoft,
                  ),
            ),
          ],
          if (action != null) ...[
            const SizedBox(height: AppSpacing.md),
            action!,
          ],
        ],
      ),
    );
  }
}

/// Loading skeleton — replaces bare CircularProgressIndicator.
/// Renders N rounded rectangles sized to mirror the content that will resolve
/// into place, reducing layout shift on load. A soft shimmer sweeps across
/// them to signal "loading, not frozen". The shimmer is gated by
/// [AppMotion.infiniteMotionEnabled] so it honors reduce-motion and collapses
/// to a static frame in widget tests (no `pumpAndSettle` hang).
class SkeletonList extends StatelessWidget {
  final int count;
  final double itemHeight;
  final double gap;
  const SkeletonList({
    super.key,
    this.count = 4,
    this.itemHeight = 64,
    this.gap = AppSpacing.sm,
  });

  @override
  Widget build(BuildContext context) {
    final shimmer = AppMotion.infiniteMotionEnabled(context);
    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: count,
      separatorBuilder: (_, _) => SizedBox(height: gap),
      itemBuilder: (_, _) {
        Widget box = Container(
          key: const Key('skeleton-box'),
          height: itemHeight,
          decoration: BoxDecoration(
            color: BrandColors.line.withValues(alpha: 0.75),
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          ),
        );
        if (shimmer) {
          box = box
              .animate(onPlay: (c) => c.repeat())
              .shimmer(
                duration: AppMotion.shimmerCycle,
                color: BrandColors.surface.withValues(alpha: 0.65),
              );
        }
        return box;
      },
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
