# Velofit — Product Vision

Evergreen "why" — not a roadmap. Roadmap lives in GitHub issues; domain glossary lives in `CONTEXT.md`; architecture in `docs/adr/`. This file is what we're aiming for and the rules we won't break.

## What Velofit replaces

WhatsApp threads + a private Google Calendar that only the coach sees. Every booking, cancel, and reschedule today is a manual back-and-forth. That doesn't scale past ~15 active trainees and costs the coach hours/week of admin.

## Core promise

Two-sided. We win when both are true:

- **Trainee** feels supported and sees tangible progress → shows up, stays.
- **Coach** spends ≤15 min/day on admin and has a clear view of business state.

Failure modes we explicitly refuse to optimize for: pure session count without progress; coach efficiency at the cost of trainee experience; engagement metrics decoupled from real outcomes.

## Personas

**Coach** — sole proprietor, 35-55, busy. High openness to tech but zero tolerance for complexity. Needs perceived control + quick wins ("who's coming today" in <5s). Motivation: income stability + clients transforming.

**Trainee** — 25-55, fitness-curious. Cognitive load is enemy #1; wants instant clarity ("Can I book tomorrow 18:00?"). Driven by small visible wins and accountability — *not* guilt. Hebrew RTL native.

## KPI targets

Aspirational; no analytics layer yet. Wire when we add measurement_logs.

- **30-day trainee retention** > 75%
- **No-show rate** < 8% (industry baseline ~20%)
- **Weekly bookings per active trainee** ≥ 1.8
- **Coach daily active time** < 15 min

## The habit loop

Every feature should serve one of the three:

- **Cue** — smart reminders (24h + 2h before slot), auto-booking for recurring trainees, post-session prompt (within 30min of slot end).
- **Action** — one-tap booking; one-tap log; one-tap approve.
- **Reward** — visible progress (charts, streak, coach note), peace of mind, coach recognition.

## Behavioral rules (non-negotiable)

These shape every UX decision. If a feature violates one of these, kill it.

1. **No dark patterns.** No fake urgency, no fake scarcity beyond real capacity, no guilt framing. A streak is a celebration of what happened, never a threat about what might not.
2. **Streaks are positive only.** Framed as "growth streak," never "don't break it." Attendance-derived. Breaking a streak is silent, not punitive.
3. **No confetti on transactional actions.** Booking a paid session is not a casino spin. Haptic + checkmark + immediate next-session card update — that's the celebration. Confetti is reserved for streak milestones (every 10 sessions) at most.
4. **Progress visibility creates the reward, not the app.** The trainee earned the progress; we just surface it. Charts update in real-time so the user sees their own act → effect.
5. **Coach speaks through notes.** A motivational note from the coach is more powerful than any in-app gamification. Shared notes appear on the trainee's home (ADR-0006).
6. **No notification spam.** Maximum 3 push notifications per trainee per day. Reminders + post-session prompt + coach-initiated message. Anything more is opt-in.
7. **Real-time feedback.** Booking → instant confirmation. Log → chart updates immediately. Riverpod + Supabase realtime where the change is observable.

## Industry validation (2025/26 patterns)

Reviewed against the retention playbooks of Duolingo (habit loop), Peloton (flexible goals), TrueCoach/Trainerize (coaching UX), and MyFitnessPal (low-effort logging). Most reinforce decisions already made here; the points worth recording:

- **Confirmed:** habit loop (cue→action→reward→investment), positive-only streaks, the 3/day notification ceiling, progress-visibility as the reward. These are convergent best practice, not just our preference.
- **Rejected on principle:** "small confetti on booking/completion" — violates rule 3. The haptic + checkmark + instant next-session update *is* the reward. Confetti stays reserved for genuine streak milestones at most.
- **Haptics as the reward signal** (rule 3): light impact on positive trainee actions, a heavier distinct impact on the coach no-show mark, selection ticks on slot/day picks. Tracked as a dedicated slice.
- **Coach progress visibility** (at-a-glance who's logging/attending) and **progress photos** are rated top retention drivers — shipped/queued as #62 and #61.

## Reminder cadence (committed)

Current cron fires 1h before. Doc-vision target:

- **24h before slot** — "tomorrow at HH:MM" with quick-cancel deep-link (outside the 24h window — so this fires *just* before the window closes; intentional nudge for trainees who'd cancel if it crossed inside-window).
- **2h before slot** — "in 2 hours" — final warmup nudge.
- **30 min after slot end** — "how did it feel?" → opens log sheet (weight/energy/photo, all optional).

The current 1h-before reminder is dropped in favor of 2h+post-session pairing. Tracked as #TBD.

## What's out of scope (intentionally)

- **WhatsApp/Telegram integration** — deep links to WhatsApp from "contact coach" are fine; building messaging inside the app is not.
- **Trainee-to-trainee visibility** — names are never shown to other trainees. Capacity bar shows "1 spot left", not "Yael + 1 other".
- **Payments** — coach bills outside the app.
- **Multi-coach.** Single-coach SaaS. `COACH_EMAIL` env is source of truth.
- **Public leaderboards / social.** Streaks are private between coach and trainee.
- **Apple Sign-In, SMS auth, OTP-by-phone-call.** Email OTP only.
- **Dark mode** — Hebrew RTL with our warm-neutral palette doesn't need it for v1.

## Source of truth references

- Domain glossary: `CONTEXT.md`
- Architecture decisions: `docs/adr/`
- Design tokens + patterns: `docs/design-system.md`
- Roadmap + open work: GitHub issues
