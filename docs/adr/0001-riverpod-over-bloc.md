# Use Riverpod (not Bloc) for Flutter state management

The Flutter client is thin — almost all business logic lives in the Next.js API. Most screens reduce to "fetch, render, submit," which maps naturally to Riverpod's async providers and `AsyncValue`. Bloc's event/state ceremony adds cost per feature without paying for itself when there is no complex client-side state machine to model.

We picked Riverpod 2.x with `riverpod_generator` + `build_runner`. Tests use `ProviderContainer.overrideWith(fakeApiClient)` — a one-line swap that matches the TDD workflow we expect to use for every screen.

## Considered options

- **Bloc** — rejected. Designed for complex client-side flows we don't have. Heavier boilerplate per feature.
- **Provider / setState** — rejected. Too primitive for an app with auth state, role-gated routing, async fetches, and FCM token lifecycles.
- **GetX** — rejected. Couples too tightly to global state and side effects; harder to test in isolation.

## Consequences

- Every screen, route, and test in `mobile/` depends on Riverpod conventions. Swapping later means rewriting all of them.
- `build_runner` is part of the dev loop — adds a `dart run build_runner watch` step alongside `flutter run`.
- New contributors who only know Bloc need to learn Riverpod patterns before they're productive.
