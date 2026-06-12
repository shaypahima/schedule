# Warm-studio palette refresh

> **Superseded by [ADR-0011](0011-cream-editorial-palette.md)** (2026-06-12): the orange/peach family and gradient heroes were replaced by the cream-editorial palette after the owner judged the shipped result an "AI-template look".

The mobile app moves from the original bright teal/orange "athletic energy" scheme to a **warm-studio** palette chosen by the user: muted teal `#588B8B` anchor + a warm peach→amber→terracotta family (`#FFD5C2` / `#F28F3B` / `#C8553D`) on `#FFFFFF` surfaces. Teal and amber are complementary, so the cool primary and warm accents reinforce each other. Tokens live in `mobile/lib/theme.dart` → `BrandColors` (names unchanged, so the whole app repainted from one edit — every screen already used the tokens, no hardcoded colors).

The hero gradient is **warm amber→terracotta** (was teal→tealDark); both full-bleed heroes (trainee home, coach dashboard) curve into the content (28px bottom radius). Cards lift on a soft teal-tinted shadow (radius 20) instead of a flat hairline. FAB is amber; inputs are filled/rounded with a teal focus ring; dialogs + bottom sheets are rounded.

## Considered options

- **Keep the original bright teal/orange + only add motion** — the earlier call (ADR-0008 era). Rejected once the user ran the app and explicitly wanted a *visibly different, better* look, not just motion. A design audit had rated the old palette "fine," but that was a judgment call the user overrode with a concrete swatch.
- **Dark / charcoal-hero direction** — offered, not chosen. The user supplied a specific warm light palette.
- **Warm-studio (chosen)** — the user's swatch. Light, friendly, boutique; complementary teal↔orange; keeps Hebrew RTL readability with warm neutrals.

## Consequences

- `BrandColors` token *names* are stable (`teal`, `orange`, `peach`, `terracotta`, …) so future screens keep using them; the hero gradient and all accents flow from these. New token `peach` is the designated soft-fill / "pops on the warm hero" color (e.g. hero-stat stripes, empty-state disc).
- `success` is a harmonized green (`#2F8F6B`); `error` is terracotta (`#C8553D`) — semantically distinct from the decorative warm accents, never used for decoration.
- The motion layer (ADR-0008) and its rules are unchanged: no confetti, custom-painter charts only, infinite animations gated.
- Supersedes the "don't re-open colors/fonts" guidance from the motion overhaul — colors were intentionally reopened here at the user's request. Heebo (fonts) is still kept.
