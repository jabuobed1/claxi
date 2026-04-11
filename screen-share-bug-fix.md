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

`DONE ✅`

## Results

```md
Files:
- src/services/webrtcService.js
- src/pages/app/SessionRoomPage.jsx

Functions:
- createWebRtcSessionController(...)
  - startScreenShare()
  - stopScreenShare()
  - switchScreenTrack(nextTrack)
  - publishUpdatedOffer(status)
  - updateScreenShareDocState(active)
  - clearRemoteScreenStream()
  - attachRemoteScreenReceiverTrack() (defined, but not invoked in shown flow)
  - pc.ontrack = (...)
  - onSnapshot(sessionRef, ...) (student offer receive/apply + answer publish)
- SessionRoomPage
  - initializeCall(...)
  - shareScreen()
  - useEffect (remoteScreenStreamObj -> remoteScreenVideoRef.current.srcObject)
  - onRemoteScreenStream callback
  - onScreenShareStateChange callback
  - renderStudentStage()

Flow:
- Tutor clicks Share/Stop in shareScreen() -> startScreenShare() / stopScreenShare().
- Start path: getDisplayMedia() -> replaceTrack(screenTrack) -> set webrtc.screenShare.active=true -> publishUpdatedOffer('screen_sharing').
- Stop path: stop display tracks -> replaceTrack(null) -> set webrtc.screenShare.active=false -> publishUpdatedOffer('connected').
- Student session snapshot sees newer offerRevision + offer -> setRemoteDescription(offer) -> createAnswer() -> setLocalDescription(answer) -> writes answer.
- Student receives video in pc.ontrack; clears/replaces remoteScreenStream, sets mute/unmute/ended handlers, calls onRemoteScreenStream(stream|null).
- SessionRoomPage stores stream in remoteScreenStreamObj; effect attaches it to remoteScreenVideoRef.srcObject.
- Student UI shows <video ref={remoteScreenVideoRef}> when isRemoteScreenSharing=true, otherwise placeholder.

Weak Points:
- attachRemoteScreenReceiverTrack() exists but appears unused; screen flow depends on pc.ontrack only.
- replaceTrack(null) on stop may make restart sensitive to renegotiation/order timing.
- Student offer handling is gated by offerRevision; revision/state desync could skip restart offers.
- onScreenShareStateChange clears srcObject on remote=false; fast false->true transitions can race stream callback.
- pc.ontrack treats any student-side video as screen track.
- UI visibility depends on mute/unmute/ended events; delayed browser events can leave placeholder shown.
```

# =========================
# PHASE 2 — ADD LOGGING
# =========================

## Purpose
Observe behavior across:
- First share
- Stop share
- Second share

## Instructions

Add minimal logs at:

- Tutor start screen share
- Tutor stop screen share
- Track replacement (replaceTrack / switchScreenTrack)
- Offer publish (offerRevision + status)
- Firestore screenShare.active updates
- Student receiving offer
- Student applying offer
- pc.ontrack (ALL video/audio tracks)
- Remote screen stream creation / clearing
- onRemoteScreenStream callback
- UI attaching srcObject
- UI clearing srcObject
- Track mute / unmute / ended events

## Boundaries

- ❌ No logic changes
- ❌ No UI changes
- ❌ No refactor
- ✅ Logs only
- Keep logs small and readable

## Log Prefixes

- [claxi:screen:tutor]
- [claxi:screen:student]
- [claxi:screen:ui]

## Expected Output

Return:

1. Files changed  
2. Logs added  
3. Why logs were added  

## Completion Condition

Logs must clearly show full lifecycle for:
- first share
- stop
- second share

## Status

`NOT STARTED`

## Results

```md
Files Changed:
- 

Logs Added:
- 

Test Summary:
- 

Tutor Events:
- 

Student Events:
- 

Second Share Visible:
-
```


# =========================
# PHASE 3 — COMPARE FLOWS
# =========================

## Purpose
Identify the exact point where the second screen share flow diverges from the first (working) screen share.

---

## Instructions

Using the logs collected in Phase 2, compare:

- First screen share (working)
- Stop sharing
- Second screen share (failing or inconsistent)

Focus on **behavioral differences**, not assumptions.

---

## Comparison Order

Follow this exact sequence and compare step-by-step:

1. Tutor gets display media (`getDisplayMedia`)
2. Tutor replaces or adds screen track (`replaceTrack` / `addTrack`)
3. Tutor updates sender or transceiver
4. Tutor publishes updated offer
5. offerRevision increments correctly
6. Student receives new offer revision
7. Student applies remote description (`setRemoteDescription`)
8. Student receives `ontrack`
9. Track becomes live or unmuted
10. Remote screen stream is created or rebuilt
11. UI attaches stream (`srcObject`)
12. UI visibility state updates (e.g., `isRemoteScreenSharing`)

---

## Boundaries

- ❌ Do NOT modify code
- ❌ Do NOT add logs
- ❌ Do NOT refactor
- ✅ Use only logs + existing code
- ✅ Keep output short and structured

---

## Expected Output

Return ONLY:

1. First share flow (summarized)
2. Second share flow (summarized)
3. First missing or different step
4. Most likely cause of failure
5. Exact file and function where the issue likely exists

---

## Completion Condition

This phase is complete when:
- The **first exact divergence point** is identified
- The issue is narrowed down to a **specific function or logic area**

---

## Status

`NOT STARTED`

---

## Results

```md
First Share:
- 

Second Share:
- 

First Missing Step:
- 

Likely Cause:
- 

Suspected Location:
-
```

# =========================
# PHASE 4 — ROOT CAUSE ANALYSIS
# =========================

## Purpose
Determine the most likely root cause of the second screen share failure using the Phase 3 comparison results.

---

## Instructions

Inspect only the exact file, function, and logic path identified in Phase 3.

Answer the following questions using the current code and the logs already collected:

1. Does the code assume that a new `ontrack` event will always fire when screen sharing starts again?
2. Does the code clear the remote screen stream when screen sharing stops?
3. After the stream is cleared, what exact code path is responsible for rebuilding or reattaching it?
4. Does screen-track detection rely on fragile conditions such as:
   - `mid`
   - stream count
   - track kind only
   - previous stream state
   - mute/unmute timing
5. Does the tutor-side logic use:
   - `replaceTrack`
   - `addTrack`
   - `removeTrack`
   - transceiver reuse
   - sender reuse
6. Can signaling and renegotiation succeed while the student UI still fails to render the screen?
7. Is there any race condition between:
   - remote screen state updates
   - stream clear callbacks
   - UI placeholder/show logic
   - second share stream attachment

---

## Boundaries

- ❌ Do NOT apply a fix yet
- ❌ Do NOT add new logs
- ❌ Do NOT refactor
- ✅ Analysis only
- ✅ Keep answers direct and short

---

## Expected Output

Return ONLY:

1. Short answer to each question
2. One clearly stated root-cause theory
3. One smallest-safe-fix candidate

---

## Completion Condition

This phase is complete when:
- the likely root behavior is clearly identified
- there is enough confidence to make one focused fix in Phase 5

---

## Status

`NOT STARTED`

---

## Results

```md
1. New ontrack assumption:
- 

2. Stream clearing behavior:
- 

3. Stream rebuild path:
- 

4. Fragile detection logic:
- 

5. Tutor track/transceiver method:
- 

6. Can signaling succeed while UI fails:
- 

7. Possible race condition:
- 

Root-cause theory:
- 

Smallest-safe-fix candidate:
-
```


# =========================
# PHASE 5 — APPLY FIX
# =========================

## Purpose
Apply the smallest safe fix based on the confirmed root cause from Phase 4.

---

## Instructions

Implement ONLY ONE focused fix that directly addresses the identified issue.

The fix must:
- Target the exact function or logic identified in Phase 4
- Solve the second screen share failure
- Preserve existing working behavior (audio, first share, connection)

---

## Allowed Fix Types

Choose ONLY ONE of the following (based on Phase 4 findings):

- Reattach remote screen stream when track becomes unmuted
- Rebuild `MediaStream` after screen share restarts
- Handle reused transceiver correctly (do not rely only on `ontrack`)
- Fix screen track detection logic
- Ensure UI reattaches stream when a valid remote track becomes active again
- Resolve race condition between stream clearing and reattachment

---

## Boundaries

- ❌ Do NOT refactor unrelated code
- ❌ Do NOT introduce multiple fixes
- ❌ Do NOT remove logs yet
- ❌ Do NOT change UI design
- ✅ Keep change minimal and targeted

---

## Expected Output

Return ONLY:

1. File changed  
2. Exact change made (short explanation)  
3. Why this fix solves the issue  

---

## Test Procedure

After applying the fix, perform this exact test:

1. Start call  
2. First screen share → verify visible  
3. Stop sharing → verify cleared  
4. Second screen share → verify visible  
5. Stop again  
6. Third screen share → verify consistent behavior  

---

## Completion Condition

This phase is complete when:
- Second screen share works reliably
- Repeated start/stop works
- No regression is introduced

---

## Status

`NOT STARTED`

---

## Results

```md
File Changed:
- 

Change Applied:
- 

Reason for Fix:
- 

Test Result:
- 

Second Share Works:
- 

Third Share Works:
- 

Any Regression:
-
```


# =========================
# PHASE 6 — VALIDATION
# =========================

## Purpose
Verify that the fix from Phase 5 is stable, does not introduce regressions, and works across repeated screen share cycles.

---

## Instructions

Using the current code (with the fix applied), run controlled tests and validate behavior against the checklist below.

Perform tests in this order:

1. Start call  
2. First screen share → verify visible  
3. Stop sharing → verify cleared  
4. Second screen share → verify visible  
5. Stop again  
6. Third screen share → verify consistent behavior  
7. Repeat stop/start multiple times (at least 3 cycles)

---

## Validation Checklist

Confirm each of the following:

- Audio connection still works correctly  
- First screen share works  
- Second screen share works  
- Repeated stop/start works consistently  
- UI state matches actual screen share (no mismatch between status and video)  
- Remote screen stream clears correctly when sharing stops  
- Remote screen stream reattaches correctly when sharing restarts  
- No duplicate streams are attached  
- No stale (old) streams remain in the video element  
- No unexpected flicker or stuck placeholder state  

---

## Boundaries

- ❌ Do NOT introduce new fixes in this phase  
- ❌ Do NOT refactor  
- ❌ Do NOT remove logs yet  
- ✅ Validation only  
- ✅ Observe behavior and logs  

---

## Expected Output

Return pass/fail and short notes for each item in the checklist.

---

## Completion Condition

This phase is complete when:
- All critical checks pass  
- Behavior is stable across repeated tests  
- No regression is observed  

---

## Status

`NOT STARTED`

---

## Results

```md
Audio Works:
- 

First Share Works:
- 

Second Share Works:
- 

Repeated Stop/Start Works:
- 

UI Matches State:
- 

Stream Clears Properly:
- 

Stream Reattaches Properly:
- 

No Duplicate Streams:
- 

No Stale Streams:
- 

UI Flicker or Issues:
- 

Remaining Risk:
- 
