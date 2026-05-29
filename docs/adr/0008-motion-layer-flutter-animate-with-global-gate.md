# Motion layer: flutter_animate + a global infinite-motion gate

Velofit adopts a deliberate motion layer to feel alive and premium (2026 fitness-app bar) without gamification overload. Everyday motion uses **`flutter_animate`** (declarative, RTL-safe, ~tiny) plus Flutter's built-in implicit `AnimatedX` widgets. Tokens live in `mobile/lib/design/motion.dart` (`AppMotion`): durations (micro 120ms → emphasized 400ms), curves (entry `easeOutCubic`, exit `easeInCubic`, `springy` `easeOutBack`), and a per-item `stagger`.

**Infinite/repeating** animations (shimmer, pulse, wiggle) are gated behind `AppMotion.infiniteMotionEnabled(context)`, which is false when either (a) the OS "reduce motion" accessibility flag is set, or (b) `AppMotion.disableInfiniteForTests` is true. `test/flutter_test_config.dart` (auto-loaded by `flutter test` for the whole package) flips that bool, so loops collapse to a single static frame and never hang `pumpAndSettle`. Finite animations (entries, press, count-ups) need no gate — they settle.

## Considered options

- **`flutter_animate` for the everyday layer + implicits** — chosen. One small dependency covers staggered reveals, fades/slides, shimmer, and press effects declaratively; implicit `AnimatedX` covers state changes. Runs well on mid-range Android (common in IL). No asset pipeline.
- **Zero new dependencies (implicits only)** — rejected. `AnimatedContainer`/`Opacity`/`Scale` + `TweenAnimationBuilder` can do most of it, but staggers and shimmer become hand-rolled `AnimationController` boilerplate in every screen. More code, more ticker-leak risk, no real upside.
- **Lottie / Rive for set-pieces** — deferred (not rejected). Bespoke vector/state-machine animations (streak character, marquee success burst) need designer-made assets and add bundle weight. Revisit if a specific hero moment justifies it; the everyday layer does not.

## Consequences

- Every looping animation MUST go through `AppMotion.infiniteMotionEnabled` or it will hang the test suite and ignore the user's reduce-motion preference. Finite animations are free to use directly.
- `SkeletonList` now shimmers (gated); its old "static so tests don't hang" constraint is replaced by the global gate.
- **Locked product rules still hold:** no confetti on transactional actions (vision rule 3 — a checkmark-draw + haptic is the reward), and charts remain custom-painter (`WeightChart`), not `fl_chart`. The motion layer celebrates within those rules.
- Reduce-motion is now a first-class accessibility path, not an afterthought.
