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
