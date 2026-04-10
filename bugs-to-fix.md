# Claxi Bug Fix Plan (Phase-by-Phase, One Task at a Time)

Use this file as the **single execution plan** for future AI chats.

## Rules for execution (important)
1. **Do only ONE phase per chat/session.**
2. Do not start the next phase until the current phase is reviewed and approved.
3. After finishing a phase, update its status from `NOT STARTED` to `DONE`.
4. If work is partially complete, mark as `IN PROGRESS` and list exactly what remains.
5. Keep all code changes limited to the files listed in that phase unless approval is given.

## Status legend
- `NOT STARTED`
- `IN PROGRESS`
- `DONE`
- `BLOCKED`

---

## Phase 01 — Backend-authoritative request lifecycle (Critical)
**Status:** `NOT STARTED`

### Problem
Request matching/offer transitions are currently driven from frontend timers/listeners, causing flicker and race conditions.

### Goal
Move request lifecycle transitions to backend authority and make frontend listeners read-only.

### Scope (expected)
- Introduce/extend backend handlers (Cloud Functions) for lifecycle transitions.
- Stop frontend from performing status mutation loops for matching/offers.
- Keep only action calls from frontend (create/accept/decline/cancel).

### Suggested files
- `functions/index.js`
- `src/services/classRequestService.js`
- `src/hooks/useClassRequests.js`

### Definition of done
- No frontend interval-based lifecycle mutation remains for active request transitions.
- Lifecycle transitions are atomic/idempotent on backend.
- Student/tutor status no longer oscillates between matching/found/retry states due to client loops.

### Validation checks
- Create request -> offer -> accept flow runs once without status flicker.
- Timeout flow transitions once and does not re-open stale offers.

---

## Phase 02 — Accept/timeout race hardening (Critical)
**Status:** `NOT STARTED`

### Problem
Tutor accept can race with timeout/decline logic near offer expiry.

### Goal
Guarantee deterministic accept behavior with idempotency and offer version checks.

### Scope (expected)
- Add offer token/revision validation on accept.
- Ensure timeout handler cannot cancel a successfully accepted offer.
- Add idempotency guard for repeated accept calls.

### Suggested files
- `functions/index.js`
- `src/services/classRequestService.js`

### Definition of done
- Duplicate accept clicks do not create duplicate side effects.
- Near-expiry accept produces deterministic success/failure once.

### Validation checks
- Simulate multiple accept attempts for the same offer.
- Simulate accept at countdown end and confirm consistent result.

---

## Phase 03 — Single tutor-offer action surface (High)
**Status:** `NOT STARTED`

### Problem
Tutor can respond from multiple UI surfaces (overlay + page), increasing duplicate actions/races.

### Goal
Allow exactly one active action surface for live offers.

### Scope (expected)
- Keep one primary action path.
- Disable/lock secondary path while an offer action is in-flight.

### Suggested files
- `src/components/app/TutorOfferOverlay.jsx`
- `src/pages/app/tutor/AvailableRequestsPage.jsx`

### Definition of done
- One offer has one actionable control path at a time.
- No duplicate accept/decline calls from parallel UI elements.

### Validation checks
- Offer appears once effectively; second surface cannot submit duplicate action.

---

## Phase 04 — Timeout UX consistency (Medium)
**Status:** `NOT STARTED`

### Problem
UI copy says 10 seconds in places while logic uses 30 seconds.

### Goal
Render timeout duration from one shared source of truth.

### Scope (expected)
- Centralize offer timeout constant and all related labels/tooltips.

### Suggested files
- `src/services/classRequestService.js`
- `src/pages/app/tutor/AvailableRequestsPage.jsx`
- any other offer countdown UI component(s)

### Definition of done
- All user-facing timeout text matches actual timeout behavior.

### Validation checks
- Compare countdown UI text with configured timeout constant.

---

## Phase 05 — Remove production debug logs (Medium)
**Status:** `NOT STARTED`

### Problem
Direct console logs exist in live request status page.

### Goal
Remove or DEV-gate noisy logs.

### Scope (expected)
- Replace direct `console.log` with gated debug utility or remove.

### Suggested files
- `src/pages/app/student/StudentRequestStatusPage.jsx`
- `src/utils/devLogger.js`

### Definition of done
- No unconditional console noise from request status path in production.

### Validation checks
- Open status page in production mode; no debug spam in console.

---

## Phase 06 — Environment safety (mock fallback hardening) (High)
**Status:** `NOT STARTED`

### Problem
App can silently fall back to mock mode if Firebase env is missing.

### Goal
Fail safely in production when required env is missing.

### Scope (expected)
- Add explicit production env validation.
- Show blocking config error screen in production misconfig.

### Suggested files
- `src/firebase/config.js`
- app bootstrap entry / route shell for config errors

### Definition of done
- Production build/runtime does not silently use mock mode.

### Validation checks
- Start app with missing env in production mode and confirm blocking error behavior.

---

## Phase 07 — Build blocker fix: `tldraw` CSS import (Critical)
**Status:** `NOT STARTED`

### Problem
`npm run build` currently fails because `tldraw/tldraw.css` cannot be resolved.

### Goal
Make production build pass.

### Scope (expected)
- Align `tldraw` import path to installed version docs.
- Update dependency/version if necessary.

### Suggested files
- `src/components/app/TldrawSdkEmbed.jsx`
- `package.json` (if version change required)

### Definition of done
- `npm run build` succeeds.

### Validation checks
- Run `npm run build` and confirm pass.

---

## Phase 08 — Quality gates (lint/tests/CI) (High)
**Status:** `NOT STARTED`

### Problem
No lint/test scripts in root package; regressions are easy to introduce.

### Goal
Introduce minimum automated checks for safe iteration.

### Scope (expected)
- Add lint script.
- Add at least one lifecycle smoke/integration test path.
- Add CI workflow to run checks.

### Suggested files
- `package.json`
- test config/files
- CI workflow file(s)

### Definition of done
- PR checks fail on lint/build/test regressions.

### Validation checks
- Run lint/build/tests locally and in CI.

---

## Phase 09 — Security rules verification (High)
**Status:** `NOT STARTED`

### Problem
Rules posture for sensitive request/session/payment data must be verified before launch.

### Goal
Confirm and enforce least-privilege Firestore/Storage rules.

### Scope (expected)
- Validate deployed rules for user ownership and role boundaries.
- Ensure financial fields are protected from client-side mutation.

### Suggested files
- Firestore rules files (repo/deployment)
- Storage rules files (repo/deployment)
- `docs/firestore-user-rules.md` (if documentation updates needed)

### Definition of done
- Rules reviewed and tested against unauthorized read/write attempts.

### Validation checks
- Emulator or scripted rules tests for allowed and denied cases.

---

## Phase 10 — Timer/polling performance cleanup (Medium)
**Status:** `NOT STARTED`

### Problem
High timer density (250ms/1s/5s) can create unnecessary CPU/network load.

### Goal
Reduce timers; prefer event-driven updates.

### Scope (expected)
- Consolidate countdown clock usage.
- Remove unnecessary polling where realtime snapshots already exist.

### Suggested files
- `src/components/app/TutorOfferOverlay.jsx`
- `src/pages/app/tutor/AvailableRequestsPage.jsx`
- `src/services/classRequestService.js`

### Definition of done
- Noticeably fewer recurring timers while preserving UX responsiveness.

### Validation checks
- Compare timer count before/after and verify offer/session UX still updates correctly.

---

## Execution template for future AI chats
When starting a new chat, use this exact instruction format:

1. "Execute **Phase XX only** from `bugs-to-fix.md`."
2. "Do not work on any other phase."
3. "After implementation, set Phase XX status to `DONE` (or `IN PROGRESS` with remaining items)."
4. "Provide tests run, risks, and rollback notes."

This ensures one-phase-at-a-time delivery with review/approval between phases.
