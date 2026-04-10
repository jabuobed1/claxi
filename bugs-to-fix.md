# Claxi audit: bugs and risks to fix before launch

> Scope: full-app code inspection focused on reliability, functional correctness, production readiness, and user trust.

> **Application status:** This application is currently in **development** (pre-production).

## P0 — Critical reliability bugs

### 1) Request matching is controlled by client polling/listeners (race condition risk)
**Problem**
- Core matching state (`pending` -> `matching` -> `offered` -> `accepted`) is advanced by client code running in subscriptions and intervals.
- Multiple clients/tabs/components can write to the same request document concurrently.

**Symptoms you may see**
- Student status flickers between searching/found/searching.
- Tutor popup appears/disappears repeatedly.
- Accept/decline can fail intermittently.

**Where**
- `refreshActiveMatchingRequests` and periodic calls from subscriptions.

**Fix recommendation**
1. Move all matching transitions to backend (Cloud Function, Cloud Tasks, or a single worker).
2. Keep client read-only for request lifecycle, except explicit user action APIs (`accept`, `decline`, `cancel`).
3. Add idempotency tokens (`requestId + tutorId + action + offerEpoch`).

---

### 2) Duplicate subscriptions can mutate the same offer simultaneously
**Problem**
- `TutorOfferOverlay` subscribes globally in `AppShell`.
- Tutor pages also subscribe (`TutorDashboardPage`, `AvailableRequestsPage`).
- Snapshot callbacks include write side effects (offer timeout handling), so duplicate listeners cause duplicate writes.

**Fix recommendation**
1. Single source of truth: one offer subscription in a shared provider/store.
2. UI components read from store only.
3. Remove write side effects from snapshot callbacks.

---

### 3) Offer acceptance can fail due to race with timeout/reassignment
**Problem**
- Accept transaction requires `currentOfferTutorId === tutorId`.
- Timeout logic can clear/reassign offer around click time.
- User experiences repeated “try again” before success.

**Fix recommendation**
1. Add `offerEpoch`/`offerVersion` field and include it in accept request.
2. Server validates `(requestId, tutorId, offerEpoch)` atomically.
3. Return structured error codes (`offer_expired`, `already_taken`, `stale_offer`) for UX clarity.

---

## P1 — High impact functional issues

### 4) Status oscillation is built into current logic (flicker by design)
**Problem**
- Flow intentionally toggles `no_tutor_available` back to `matching` with short delays.
- This can feel like unstable UX when no tutor is available.

**Fix recommendation**
1. Keep one stable status for a minimum display window.
2. Add a separate `phaseMessage` for UX, instead of changing canonical status frequently.
3. Use explicit retry backoff schedule (e.g., 5s, 15s, 30s) server-side.

---

### 5) Timeout mismatch in UI vs logic
**Problem**
- UI copy says 10 seconds, while `OFFER_TIMEOUT_MS` is 30 seconds.

**Fix recommendation**
1. Centralize timeout constants in one module.
2. Render UI copy from the same constant.

---

### 6) Session room subscribes to both student and tutor sessions for every user
**Problem**
- `SessionRoomPage` calls both `useStudentSessions` and `useTutorSessions` always.
- Only one is used based on role, but both subscriptions are still active.

**Fix recommendation**
1. Subscribe conditionally by role only.
2. Reduce read load and eliminate chance of cross-role state confusion.

---

### 7) Role source inconsistency in Session room
**Problem**
- Session room derives role from `user.role` instead of `activeRole`.
- Other routing/guards use `activeRole` fallback.

**Risk**
- Wrong role behavior if user supports role switching and `activeRole` differs from `role`.

**Fix recommendation**
- Standardize role derivation across app: `activeRole || role`.

---

### 8) Rating modal has duplicate actions wired to same handler
**Problem**
- “Close” and “Cancel” both call `markRatingDone`.

**Fix recommendation**
- Make “Cancel” close modal without submitting.
- Keep one explicit submit action.

---

### 9) Async subscription setup can leak listeners on rapid mount/unmount
**Problem**
- Many `subscribeTo...` functions initialize listener inside `getFirebaseClients().then(...)`.
- Cleanup can run before promise resolves, then listener still gets attached.

**Fix recommendation**
1. Use `let canceled = false` guard in setup.
2. If canceled before resolve, immediately unsubscribe newly created listener.

---

## P1 — Payments / financial correctness

### 10) Frontend wallet top-up uses mock gateway behavior
**Problem**
- `paymentGatewayService` currently simulates card charge in frontend.

**Risk**
- Non-production-safe if accidentally reused outside mock/testing paths.

**Fix recommendation**
1. Route all financial operations through backend-only verified APIs.
2. Explicitly gate mock gateway to development mode.
3. Add environment assertions that fail fast in production builds.

---

### 11) Floating-point arithmetic for billing amounts
**Problem**
- Billing calculations use decimal floats in multiple places.

**Risk**
- Rounding drift over time and reconciliation mismatches.

**Fix recommendation**
1. Store/compute money in minor units (cents).
2. Convert to display currency only in UI.

---

### 12) finalize billing endpoint allows any participant to finalize
**Problem**
- Student or tutor can finalize session billing endpoint.

**Risk**
- Lifecycle authority ambiguity and accidental early finalization.

**Fix recommendation**
- Restrict finalize trigger to one authority path (e.g., tutor action or scheduled backend job), with strong state guards.

---

## P1 — Security/configuration readiness

### 13) Firestore rules coverage for business collections not defined in repo (**should be done prior production**)
**Problem**
- Rules doc only shows user-profile template and deny-all fallback example.
- `classRequests`, `sessions`, `notifications`, `emailEvents` need explicit production rules.

**Fix recommendation**
1. Add full Firestore rules file versioned in repo.
2. Define least-privilege rules per role and per status transition constraints.
3. Add emulator tests for rules.

---

### 14) Sensitive debug logs in Cloud Functions (**should be done prior production**)
**Problem**
- Cloud Function and client console logs can include sensitive request/debug context (for example Paystack verification payload details and secret previews).

**Fix recommendation**
1. Remove secret previews entirely.
2. Log only non-sensitive identifiers and redact payloads.
3. Add structured log policy (PII safe fields only).

---

## P2 — Performance and scalability concerns

### 15) Expensive full scans and per-request candidate queries in refresh loop
**Problem**
- Every refresh cycle may query active requests and then query tutors repeatedly.

**Fix recommendation**
1. Backend queue/worker for matching.
2. Precompute tutor availability index.
3. Avoid per-client periodic refresh writes.

---

### 16) Frequent UI timers across multiple surfaces
**Problem**
- Multiple 250ms/1s intervals for countdowns and overlays in parallel.

**Fix recommendation**
1. Use shared clock context or requestAnimationFrame throttle.
2. Pause countdown updates when tab hidden.

---

### 17) WebRTC cleanup is mostly good, but add robust unload handling
**Problem**
- Media/session cleanup depends on React lifecycle and route navigation.

**Fix recommendation**
- Add `beforeunload/pagehide` safeguards to close tracks, persist final telemetry, and avoid orphan state.

---

## P2 — Product quality / UX consistency

### 18) Competing request surfaces may confuse tutors
**Problem**
- Tutor can see overlay + dashboard cards + full list simultaneously.

**Fix recommendation**
1. Keep one primary action surface (overlay or list), not all.
2. If overlay active, suppress duplicate cards.

---

### 19) Cancel-class UX uses blocking `window.prompt`
**Problem**
- Blocking prompt is brittle on mobile and poor UX.

**Fix recommendation**
- Replace with in-app modal + validation + server-side audit trail.

---

### 20) Navigation fallback on missing session may redirect to generic request route
**Problem**
- Some fallback redirects can lose context and force extra user steps.

**Fix recommendation**
- Route users back to request/session detail page with preserved context whenever possible.

---

## Current tutor queue logic (how it works today)

### What the queue currently does
1. When a request is created, the app fetches online + verified tutor candidates and stores them as `tutorQueue` on the request.
2. `assignNextTutorOffer` picks the first tutor in queue (`queue[0]`) and sets:
   - `status: offered`
   - `currentOfferTutorId` to that tutor
   - `offerExpiresAt` for timeout
3. If tutor accepts, the request is marked `accepted`, tutor is assigned, and a session document is created/reused.
4. If tutor declines or times out, that tutor is removed from queue and the request returns to `matching` (or `no_tutor_available` if queue is empty), then next tutor is offered.
5. If no tutor accepts within the global matching window, request transitions to `expired`.

### Will backend-authoritative matching keep queue behavior?
**Yes.** The recommendations preserve this same queue model and sequence; they only move authority to the backend so the same queue is processed by one reliable writer.

That means you still get:
- ordered tutor offers
- timeout/decline -> next tutor
- single accepted tutor + session creation

But with fewer race conditions and much more predictable UX.

## Suggested implementation roadmap

### Phase 1 (stabilize core flow)
1. Backend-authoritative matching + offer timeout worker.
2. Remove client write side effects from subscriptions.
3. Introduce `offerEpoch` and idempotent accept/decline API.
4. Merge duplicate tutor offer subscriptions into one provider.

### Phase 2 (harden financial and lifecycle)
1. Convert billing to minor units (cents).
2. Tighten finalize-session authority and state machine checks.
3. Production-grade Firestore rules + emulator tests.

### Phase 3 (UX and ops quality)
1. Replace prompt-based cancellation with modal.
2. Consolidate request surfaces and countdown timers.
3. Add observability dashboard: offer sent/accepted latency, timeout rates, and acceptance conflicts.

---

## Quick verification checklist after fixes
- [ ] Single request never oscillates status unless explicit business event occurs.
- [ ] One tutor sees one stable incoming offer card/overlay.
- [ ] Accept works first click in normal network conditions.
- [ ] No duplicate `handleTutorOfferResponse` calls for same `(requestId, tutorId, action)`.
- [ ] Billing totals in DB match cents-based recomputation exactly.
- [ ] Firestore rules pass emulator tests for student/tutor/admin permissions.
