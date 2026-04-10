# Claxi Bugs / Stability Review (Whole Application)

This document is a **code-review checklist** based on a full pass through the app with a focus on reliability, realtime behavior, and launch readiness.

---

## 1) Core request flow flicker (student + tutor) — **Critical**

### What I found
- Matching state is being refreshed from **multiple periodic loops** (`setInterval`) and live listeners, which can repeatedly rewrite request state.
- `refreshActiveMatchingRequests()` runs every 5 seconds from student subscriptions and tutor subscriptions, and it can move a request between `matching`, `offered`, and `no_tutor_available` repeatedly depending on timing.
- `assignNextTutorOffer()` also rewrites status and emits notifications, so status writes can “fight” each other under load.

### Evidence
- `subscribeToStudentRequests` starts a 5s refresh loop.
- `subscribeToTutorAvailableRequests` starts another 5s refresh loop and also handles offer expiry.
- `refreshActiveMatchingRequests` updates statuses and may immediately call `assignNextTutorOffer`.

### Why this matches your reported issue
This explains the "shows/disappears/shows" behavior on both sides: status changes are being recalculated and rewritten by multiple workers.

### Recommended fix (implementation steps)
1. Move matching/offer state transitions to **one backend authority** (Cloud Function / server worker).
2. Stop running status transition logic in frontend subscriptions.
3. Keep frontend realtime listeners **read-only** (just render current state).
4. Enforce idempotent transition guards server-side (e.g., lease/version/transaction checks).

---

## 2) Accept action races with timeout handling — **Critical**

### What I found
- Tutor offer expiry is processed inside listener paths; if the tutor clicks accept near expiry, timeout/decline logic may run concurrently.
- Accept is transactional (good), but competing timeout paths can still clear assignment and cause retries from UI perspective.

### Recommended fix (implementation steps)
1. Handle expiry only on backend (scheduled/atomic process).
2. In accept transaction, verify `offerExpiresAt > now` and lock by offer revision/token.
3. Add idempotency key for accept requests to prevent duplicate retries.
4. Return deterministic response payload so UI can stop retry spam.

---

## 3) Duplicate offer UX surfaces (overlay + page actions) — **High**

### What I found
- Tutors can respond from both `TutorOfferOverlay` and `AvailableRequestsPage`, creating multiple action entry points for the same offer and increasing race probability.

### Recommended fix
- Choose one primary interaction surface for live offers (overlay preferred), or lock one while the other is active.
- Keep a shared in-memory lock per request id in UI state manager.

---

## 4) Offer timeout messaging mismatch — **Medium**

### What I found
- Offer timeout constant is 30 seconds, but UI text in some places still says 10 seconds.

### Why it matters
- Inconsistent UX increases confusion and false bug reports.

### Recommended fix
- Centralize timeout text from one constant and render consistently everywhere.

---

## 5) Debug logs left in production screen — **Medium**

### What I found
- `StudentRequestStatusPage` has direct `console.log` calls for live request/session state.

### Why it matters
- Noise in production logs and potential performance impact in high traffic tabs.

### Recommended fix
- Remove direct console calls or guard them under `import.meta.env.DEV` using your existing logger utility.

---

## 6) Silent fallback to mock mode when Firebase env is missing — **High (release risk)**

### What I found
- If Firebase env variables are missing/incorrect, app falls back to local mock mode.

### Why it matters
- In staging/production misconfiguration, app can appear "working" but actually run disconnected from real backend.

### Recommended fix
1. Add explicit environment guard for production builds.
2. Hard-fail startup in production when required Firebase env vars are missing.
3. Show a clear blocking error screen instead of silently using mock mode.

---

## 7) Frontend as workflow orchestrator instead of backend — **High**

### What I found
- Critical lifecycle logic (matching, retries, timeout progression) lives in client services.

### Why it matters
- Multiple clients/tabs and flaky networks produce inconsistent outcomes.

### Recommended fix
- Shift request lifecycle state machine fully to backend.
- Frontend should only request actions (create/accept/decline/cancel) and subscribe to authoritative state.

---

## 8) No lint/test scripts in root package — **High (quality gate gap)**

### What I found
- `package.json` has `dev/build/preview` only; no lint, unit tests, or smoke checks.

### Why it matters
- Regression risk is high, especially with AI-assisted edits across isolated files.

### Recommended fix
1. Add ESLint + Prettier checks.
2. Add at least smoke tests for request/accept/session lifecycle.
3. Gate merges with CI checks.

---

## 9) Security rules posture unclear from repo root — **High**

### What I found
- There is a Firestore rules document template in docs, but no clearly enforced production ruleset in this review path.

### Why it matters
- Request/session/payment docs are highly sensitive and must be tightly constrained.

### Recommended fix
- Verify deployed Firestore/Storage rules for:
  - ownership checks,
  - tutor/student role access boundaries,
  - immutable financial fields,
  - admin-only write paths.

---

## 10) Polling/timer density could hurt performance on long sessions — **Medium**

### What I found
- Multiple 250ms/1000ms/5000ms timers exist across request and tutor pages + overlays.

### Why it matters
- Increased CPU wake-ups and battery/network cost, especially on low-end devices.

### Recommended fix
- Prefer event-driven updates from realtime snapshots.
- Keep a single shared clock source for countdown UIs if needed.

---

## 11) Immediate launch priorities (ordered)

1. **Backend-authoritative request state machine** for create/match/offer/accept/timeout/decline.
2. Remove frontend status mutation loops and keep listeners read-only.
3. Add idempotent accept endpoint and offer token/version checks.
4. Add observability: request timeline logs + correlation id for each request lifecycle.
5. Add CI quality gates (lint + lifecycle integration tests).

---

## 12) Suggested rollout plan

### Phase 1 (stability hotfix)
- Freeze current UI, patch lifecycle orchestration into backend, and disable client-side mutation loops.

### Phase 2 (hardening)
- Add deterministic retry strategy, dead-letter handling for stuck requests, and operational dashboard views.

### Phase 3 (launch readiness)
- Add SLO alerts for: request->offer latency, offer->accept success rate, and timeout/error rates.

---

## 13) Notes on your reported bug

Given this codebase, the flickering/request reset behavior is most likely from **concurrent frontend status rewrites** and **timer-driven refreshes** that race with accept/timeout transitions. Moving lifecycle transitions to backend authority is the most reliable long-term fix.

---

## 14) Production build currently fails — **Critical**

### What I found
- `npm run build` fails because Rollup/Vite cannot resolve `tldraw/tldraw.css` imported from `src/components/app/TldrawSdkEmbed.jsx`.

### Why it matters
- This blocks production deployment and indicates dependency/import path mismatch.

### Recommended fix
1. Validate installed `tldraw` package version and the correct CSS import path for that version.
2. Align import path to official package docs for the pinned version.
3. Add CI build check so this is caught before release.
