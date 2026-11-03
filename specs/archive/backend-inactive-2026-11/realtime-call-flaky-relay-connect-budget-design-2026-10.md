# Design — Flaky-relay connect budget + timeout honesty

**Date (UTC):** 2026-10-19  
**Status:** Implemented (L1) · degraded-pool / dual-SDP extension budget · timeout honesty without left_by_user  
**Parent:** [realtime-call-flaky-relay-drop-investigation-2026-10.md](./realtime-call-flaky-relay-drop-investigation-2026-10.md)

```text
HANDOFF ATOMIC STEP: Call drops ~30s under 2/3 relays — connect budget + honesty
PAUSED / CANCELLED: Claim video usable · ICE restart this slice · Soft L3 Fixed
CANONICAL OWNER:     realtime-voice-timeout-policy · main-shell timeout effect
PROOF BEFORE DONE:   L1 resolve max extensions + reason mapping; wire main-shell
SURFACE:             Connecting / ringing timeout only
```

## Contracts

### A — Max connecting extensions

```ts
resolveRealtimeVoiceConnectTimeoutMaxExtensions({
  openRelayCount,
  configuredRelayCount,
  hasLocalDescription,
  hasRemoteDescription,
  baselineMaxExtensionAttempts, // existing constant (1)
}): number
```

| Condition | Max extensions |
|-----------|----------------|
| Baseline | `baseline` (1) |
| `0 < open < configured` (degraded pool) | `max(baseline, 3)` |
| Both local + remote SDP set | `max(baseline, 3)` |
| Both degraded **and** dual SDP | still 3 (cap) |

Ring phases remain **no extend** (missed/no-answer honesty stays).

### B — Timeout leave honesty

When the 30s timer **ends** the call and an active session exists, set UI `interrupted` + `reasonCode = mapRealtimeVoiceConnectTimeoutToUiReasonCode(...)` **before/with** teardown — do not leave only `session_closed` from generic leave.

Ring `phase_not_eligible` may stay `session_closed` (or later map to timed-out card); connecting transport stalls stay `network_interrupted`.

## Non-goals

- Changing `VOICE_CALL_MIN_WAIT_MS` itself  
- ICE restart / TURN landlord  
- M1-L3 Pass claim  

## Proof

L1: max-extension matrix + existing timeout decision tests.  
Runtime: optional dual-profile with 2/3 relays — not required for L1 Pass.

_Last updated: 2026-10-19T10:42:00Z_
