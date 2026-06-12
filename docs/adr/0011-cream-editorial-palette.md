# ADR-0011: Cream-editorial palette replaces warm-studio orange

Date: 2026-06-12
Status: Accepted (supersedes ADR-0009)

## Context

The warm-studio palette (ADR-0009) shipped with a dominant orange→terracotta
gradient hero and orange accents across both home screens. In real use the
owner judged it "AI-template look": a large saturated gradient block carrying
no information, translucent white chips that read as disabled, and decorative
orange competing with semantic color. A second UX failure compounded it: data
and actions were visually identical (coach stats card mixed read-only numbers
with tappable ones; nothing marked what was pressable).

## Decision

1. **Palette**: warm paper neutrals (`bg #F7F2EA`, `surface #FFFDF8`,
   `cream #EFE6D8`, `sand #D9CBB4`, `sandDeep #A08B66`) + ink text. Teal
   (`#4F7E7E`) is the **only** action color. Orange/peach/terracotta tokens
   deleted.
2. **No gradients.** Heroes are flat ink typography on the paper background.
3. **Flat cards**: ivory surface + sand hairline, elevation 0, no shadows.
4. **Color == meaning**: teal → tappable/actionable; `sandDeep` → quiet data
   accent; success/warning/error → semantics. Nothing colored for decoration.
5. **Data/action separation**: read-only numbers in `StatGroupCard`; items
   needing action in the teal inbox card or as outlined teal icon buttons.
6. **Chronological nav is LTR** in the RTL UI (prev = left, next = right),
   wrapped in `Directionality(TextDirection.ltr)` so bidi can't reorder dates.

## Consequences

- `BrandColors` is the palette contract; the orange family no longer exists,
  so stale usages fail to compile rather than silently regress the look.
- `HeroStat` (glass tile for gradient heroes) deleted — no callers.
- ADR-0009's gradient-direction rule is void; design-system.md §1/§4 rewritten.
- Heebo type + spacing/motion tokens (ADR-0008) unchanged.
