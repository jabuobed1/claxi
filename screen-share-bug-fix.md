# Screen Share Bug Fix

## Goal
Investigate and fix the issue where:
- Tutor can share screen initially
- After stopping and sharing again, the student does not reliably see the screen

---

## Working Rules (VERY IMPORTANT)

- Always work on **ONE PHASE at a time**
- Do NOT jump phases
- Do NOT fix code unless the phase explicitly says so
- Keep all outputs **small and structured**
- Do NOT refactor unrelated code
- Do NOT introduce new patterns unless required
- Prefer:
  1. Inspect
  2. Log
  3. Compare
  4. Fix (only when confident)

---

## Known Facts

- WebRTC connection succeeds
- ICE reaches `connected`
- Audio works
- First screen share works
- Issue occurs after stop → restart sharing
- Likely NOT a connection issue
- Likely related to:
  - track lifecycle
  - renegotiation
  - student-side stream handling
  - UI attachment

---

## Global Status

- Current Phase: `PHASE 1`
- Overall Status: `IN PROGRESS`
- Last Updated: `YYYY-MM-DD HH:MM`
- Current Theory: `Unknown`

---

# =========================
# PHASE 1 — CODE FLOW ANALYSIS
# =========================

## Purpose
Understand how screen sharing currently works.

## Instructions

Inspect ONLY the code responsible for:

- Tutor start screen share
- Tutor stop screen share
- Tutor publish offer
- Student receive offer
- Student handle remote track
- Student attach screen stream to UI

## Boundaries

- ❌ Do NOT modify code
- ❌ Do NOT add logs
- ❌ Do NOT refactor
- ✅ Only inspect

## Expected Output

Return ONLY:

1. Files involved  
2. Functions involved  
3. Step-by-step flow  
4. Possible weak points  

## Completion Condition

Clear understanding of full screen-share flow.

## Status

`NOT STARTED`

## Results

```md
Files:
- 

Functions:
- 

Flow:
- 

Weak Points:
-
