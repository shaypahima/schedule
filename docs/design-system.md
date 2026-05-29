# Velofit — Design System

Canonical reference for visual + interaction patterns. Behavioral rules live in `docs/product-vision.md`; this doc is *how* we render them.

## 1. Tokens

### Color (`mobile/lib/theme.dart` → `BrandColors`)

| Token         | Hex       | Role |
|---------------|-----------|------|
| `teal`        | `#0EA89A` | Primary. CTAs, links, focus, dominant brand element. |
| `tealDark`    | `#076B61` | Primary-pressed, gradients, dark fill on light bg. |
| `orange`      | `#FF6B35` | Accent only. Streak fire, single hero stat, FAB. **Never** dominant. |
| `orangeDark`  | `#D94F1F` | Orange pressed/active. |
| `bg`          | `#FAF8F5` | Page background. Warm neutral — never pure white. |
| `surface`     | `#FFFFFF` | Card surface on top of `bg`. |
| `ink`         | `#1F2421` | Primary text. Near-black with green undertone. |
| `inkSoft`     | `#5B6260` | Secondary text, labels, meta. |
| `inkMuted`    | `#9BA29F` | Tertiary text, placeholders, "חסר". |
| `line`        | `#E6E2DC` | Hairlines, dividers, inactive borders. |
| `success`     | `#1F9D55` | Confirmed, approved, attended. |
| `error`       | `#C53030` | Rejected, no-show, validation errors. |

**Rules:**
- Never `Colors.*` (Material defaults). Always `BrandColors`.
- Orange is accent — appears once per screen max. Teal is dominant.
- Status colors (success/error) carry semantics; never use for decoration.
- All shadows hue-shifted (`teal.withValues(alpha: 0.08)`), not pure black.

### Spacing (`mobile/lib/design/spacing.dart` → `AppSpacing`)

4pt grid, geometric: 4 / 8 / 12 / 16 / 24 / 32 / 48 (`xxs` → `xxl`).

**Rules:**
- No raw pixel values for layout. Use tokens.
- Vertical rhythm between major sections: `xl` (32). Within a card: `md` (16). Inline rows: `sm` (12).
- Radius scale: `radiusSm` (8) buttons/chips, `radiusMd` (12) cards, `radiusLg` (16) sheets, `radiusXl` (20) hero, `radiusPill` (999) pills.

### Typography

Heebo (Hebrew sans). Sizes through `Theme.of(context).textTheme.*` — never hardcoded `fontSize:`.

| Use | Style |
|---|---|
| Page hero | `headlineMedium` (28-32) |
| Card title | `titleMedium` (16) |
| Section header | `labelMedium` w/ `letterSpacing: 0.4`, `weight: 700`, color `inkSoft` — via `SectionHeader` widget |
| Body | `bodyMedium` (14) |
| Meta / caption | `labelSmall` (12) |

### Motion (`mobile/lib/design/motion.dart` → `AppMotion`, ADR-0008)

`flutter_animate` for the declarative everyday layer; Flutter implicit `AnimatedX` for state. Tokens, never raw values.

| Token | Value | Use |
|---|---|---|
| `micro` | 120ms | press / tap acknowledgement |
| `fast` | 200ms | small state changes (chip, icon swap) |
| `standard` | 250ms | entries, `AnimatedSwitcher` crossfades |
| `emphasized` | 400ms | hero reveals, number count-ups |
| `stagger` | 55ms | per-item delay in a list reveal |
| `entry` / `exit` | `easeOutCubic` / `easeInCubic` | appearing / leaving |
| `springy` | `easeOutBack` | press release, pops |

**Rules:**
- **Infinite/repeating** animations (shimmer, pulse, wiggle) MUST gate behind `AppMotion.infiniteMotionEnabled(context)` — honors OS reduce-motion and prevents `pumpAndSettle` hangs (tests set `disableInfiniteForTests`). Finite animations need no gate.
- Press feedback on primary affordances via `PressableScale` (scale 0.97, `springy`).
- Reward stays rule-3 compliant: checkmark-draw + haptic on success. **No confetti.** Charts stay custom-painter — **no `fl_chart`.**
- Durations short (≤400ms); curves simple; test on mid-range Android.

## 2. Pattern library (shipped, in `mobile/lib/design/widgets.dart`)

| Widget | Use | Notes |
|---|---|---|
| `SectionHeader(text)` | Caption above a content block | Replaces ad-hoc `_section()` helpers in 3 screens (TODO: remove dupes). |
| `InfoRow(icon, label, value)` | Label/value pair with leading icon | Empty value → muted italic "חסר". |
| `DataGrid(children)` | 2-col grid of `InfoRow`s | Used for height/weight/age/etc. |
| `HeroStat(value, label, accent)` | Stat tile on gradient hero | 3px accent-top border, light glass (alpha 0.10). |
| `StatusStripeTile(stripeColor, title, subtitle, trailing)` | List row with 3px leading stripe | Replaces CircleAvatar+icon status pattern. |

### Progress patterns (shipped, #62 — coach + trainee progress)

- **WeightChart** (`features/progress/weight_chart.dart`) — hand-rolled `CustomPainter` line chart (teal line, alpha-fill, min/max + first/last-date labels). Renders a placeholder below 2 weight points. **No charting dependency** — `fl_chart` was considered and rejected to keep the bundle lean; extend the painter instead. Reused on both the trainee progress screen and the coach trainee-detail progress card.
- **Progress chips** (`features/coach/coach_trainees_screen.dart` → `_ProgressChips`) — compact per-row signals on the coach trainees list: a teal weight chip with a trend arrow (`north_east`/`east`/`south_east` for up/flat/down) and a muted attendance-% chip. Each hides when its datum is absent, so never-logged/never-attended trainees show a clean row (no misleading placeholder). Pattern for surfacing at-a-glance accountability without shaming.

## 3. Pattern specs (not yet built)

### Capacity bar
3px horizontal bar inside slot row. Fill = `teal`; remainder = `line`. Width = `capacity / max`. Tooltip / aria-label = "נשאר מקום X" — never trainee names.

### Lockout badge
Small chip on slot row when `slot.startsAt < now + 7h`. `inkMuted` bg, `inkSoft` text, lock icon, label "נעול". Slot still visible (not hidden) but unbookable.

### Loading skeleton
Replace bare `CircularProgressIndicator`. Use `shimmer` package or hand-rolled `AnimatedOpacity` rectangles matching the resolved layout's shape. Bg color `line` with ~700ms shimmer cycle. Required on: trainee home (slot list, hero stats), coach week, history, profile.

### Empty state
Composition: icon (40px, `inkSoft`) + headline + 1-line helper + optional CTA. Never just bare "אין X". Examples:
- No slots that day → icon: calendar_today_outlined, helper: "בחר יום אחר או צור קשר עם המאמן", CTA: deep-link to coach contact.
- No bookings yet → icon: fitness_center, helper: "כשתבצע אימון ראשון הוא יופיע כאן".

### Error card
Replace bare `Text('שגיאה: $err')`. Composition: card (`error.withValues(alpha: 0.06)` bg, `error` left-border 3px), icon `error_outline`, message in `ink`, retry CTA.

### Swipe-to-cancel
On confirmed booking row. Right→left (RTL inverted) reveals red "ביטול" action. Tap requires confirmation sheet. If inside 24h window → "שלח בקשה למאמן" not direct cancel.

### Haptic patterns (tracked as #69)
Haptic is the reward signal — explicitly NOT confetti (behavioral rule 3). Centralize behind a `Haptics` helper with named intents:
- `HapticFeedback.lightImpact` on tap of a primary CTA / booking success / log saved.
- `HapticFeedback.mediumImpact` on selection (slot/day pick).
- `HapticFeedback.heavyImpact` on the coach no-show mark, and reserved for streak milestones (rare).

## 4. Layout rules

- **Hero gradient direction**: `Alignment.topRight → Alignment.bottomLeft` everywhere. Don't invert per screen.
- **Avatar gradient**: gone. Use solid `teal` fill with white initial. Gradient on avatars reads as overdesigned.
- **Card surface**: `surface` (white) on `bg` (warm neutral). Container background only via `surfaceContainerHighest` when nesting.
- **One dominant element per screen.** Hero owns dominance on home; everywhere else, the primary action does.
- **Section spacing**: `xl` (32) between conceptually distinct blocks; `lg` (24) inside a section.

## 5. Remediation list (current pages)

Concrete items from the audit. Group by screen; each → file:line + fix.

### Trainee home (`features/slots/home_screen.dart`)

- **R1** L95-97 + L227 — **Duplicate greeting.** AppBar "שלום $name" + Hero "צהריים טובים, $name". → Drop AppBar greeting; AppBar shows nothing or a discreet menu. Hero owns greeting.
- **R2** L216-221 — **Hero gradient teal→orange too loud.** Clashes with warm-neutral palette. → Use `teal → tealDark` (single-hue depth). Reserve orange for accent stat + FAB.
- **R3** L143 — **Bare spinner on slot load.** → Skeleton matching slot-row shape.
- **R4** L161 — **Empty state weak.** "אין מועדים פנויים בתאריך זה" no next-step. → Empty-state pattern (icon + helper + CTA to other day or contact).
- **R5** L256-271 — **HeroStat row too tight.** `sm` between stats. → `md`. Plus: drop one of the 3 stats. Showing all three on every load is hierarchy noise; keep `streak` (most psychologically meaningful), rotate `attendance` and `sessions this week` into the next-session pill area.
- **R6** L279 — **`_QuickActions` row.** "עזרה" is a weak chip — opens a static dialog. → Drop it; surface coach contact as a real action.
- **R7** L399-406 — **Raw `BorderRadius.circular(10)`** → `AppSpacing.radiusMd` (12).

### Trainee profile (`features/profile/profile_screen.dart`)

- **R8** L108-132 — **Avatar gradient (teal→tealDark) is busy on a small element.** → Solid `teal` + white initial.
- **R9** L228-239 — **`Colors.amber.shade100` warning banner.** Hardcoded color. → Add `BrandColors.warning` token (e.g., `#F59F00` bg @ alpha 0.10, full strength text).
- **R10** L242-246 — **"Calendar connected" reads as gray filler.** → Add checkmark icon, `success` color, bold weight.
- **R11** L54 — **Bare error.** → Error card pattern.

### Trainee profile editor (`features/profile/trainee_profile_editor_screen.dart`)

- **R12** L135/186/226 — **`_section()` helper duplicated.** → Replace with shared `SectionHeader` widget.
- **R13** L164, L176 — **Height/weight allow decimals via `TextInputType.number`.** → `numberWithOptions(decimal: false)` since cm + kg integer is enough.
- **R14** L210-218 — **Plain red text error.** → Error card.
- **R15** Section separation — **All sections blur together.** → `xl` gap between phone / personal / goals.

### Coach week (`features/coach/coach_week_screen.dart`)

- **R16** L189-195 — **Gradient direction inverted vs trainee home** (`tealDark→teal`). → Match canonical direction.
- **R17** L143 — **Bare error.** → Error card.
- **R18** L152 — **Empty state terse.** → Empty-state pattern with "אין שעות פנויות ביום זה" + day-switch hint.
- **R19** L118-124 — **Day chip hardcodes `primaryContainer`** → Use computed accent (mirror trainee `_DayChip` logic).
- **R20** L270-276 — **`_DashStat` hardcoded `BrandColors.orange.withValues(alpha:0.85)`** → Use a single semantic color (e.g., teal for "today/pending", orange only for the "needs attention" stat).
- **R21** L156 — **`ListView.separated` with flush divider, no breathing room.** → 8px vertical padding around items.

### Coach trainee detail (`features/coach/coach_trainee_detail_screen.dart`)

- **R22** L68-74 / L122 — **Avatar gradient** → Solid teal.
- **R23** L182-196 — **Empty intro_text silent.** → Show "המתאמן לא הוסיף הצגה עצמית" in muted italic.
- **R24** L233-241 — **Sessions empty state plain text.** → Empty-state pattern with history icon.

### Coach settings (`features/coach/coach_settings_screen.dart`)

- **R25** L166-175 — **`_section()` duplicate.** → `SectionHeader`.
- **R26** L107-144 — **Fields not grouped.** → Group "contact" vs "presentation" in separate cards.
- **R27** L143 — **Bio minLines=3 too cramped.** → 4 + add hint text "כמה משפטים על הניסיון והסגנון שלך".

### Change requests (`features/coach/change_requests_screen.dart`)

- **R28** L21-24 — **Empty state silent.** → Empty-state pattern with "אין בקשות פתוחות" + helper "כשמתאמן יבקש ביטול בתוך 24 שעות הבקשה תופיע כאן".
- **R29** L108-115 — **Reason field unlabeled.** → Add "סיבה:" label or comment-icon prefix.
- **R30** L84-87 — **Initial-letter avatar fails on empty name.** → Fallback "?" with `inkMuted` bg.

### Coach about card (`features/coach/coach_about_card.dart`)

- **R31** L26 — **Card bg at alpha 0.4 too washed.** → 0.7 or use full `primaryContainer`.
- **R32** L99-101 — **Both pills same color (specialty + experience).** → Specialty in teal, experience in orange — visual scannability.
- **R33** L48-52 — **Label "המאמן שלי" redundant.** → Drop label; let the card title carry it.

### History (`features/history/history_screen.dart`)

- **R34** L23-27 — **Empty state weak.** → "עדיין אין היסטוריית אימונים" + "כשתשלים את האימון הראשון, הוא יופיע כאן" + icon.
- **R35** L100-111 — **StatusStripeTile subtitle inherits stripe color**, low contrast for light stripes. → Subtitle always `inkSoft`; stripe color only on the 3px bar.

### Cross-cutting

- **R36** Spacing: replace remaining raw `EdgeInsets.fromLTRB(16, ...)` / `EdgeInsets.symmetric(horizontal: 16)` with `AppSpacing.md` references.
- **R37** Loading: replace all `CircularProgressIndicator()` with skeletons or labeled progress.
- **R38** Empty: every "אין X" upgraded to empty-state pattern.
- **R39** Gradients: extract canonical gradients to `theme.dart` constants (`gradientHero`, `gradientAvatar` — and `gradientAvatar` is *removed* per R8/R22).
- **R40** `_section()` helper: extract to `SectionHeader`. Remove from `trainee_profile_editor_screen.dart`, `coach_settings_screen.dart`, anywhere else.

## 6. Implementation order

When we work through remediation, vertical slices per screen — not horizontal per pattern:

1. **Trainee home** (R1-R7) — most-seen screen; highest leverage. Includes drop-greeting, gradient retune, hero stat trim, empty/loading retrofit.
2. **Coach week** (R16-R21) — second-most-seen.
3. **Profile pair** (R8-R15, R25-R27) — editor flows together.
4. **Detail / change-requests / about / history** (R22-R35).
5. **Cross-cutting cleanup** (R36-R40) — only after the above.
