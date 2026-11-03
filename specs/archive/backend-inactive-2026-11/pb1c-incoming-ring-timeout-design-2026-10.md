# Design — PB1-C incoming ring timeout (no silent hang)

**Date (UTC):** 2026-10-13  
**Status:** Implemented · L1 green (2026-10-13)  
**Parents:** [pre-b2b-capability-design-2026-10.md](./pre-b2b-capability-design-2026-10.md) §5 · [pb1c-voice-connect-timeout-honesty-design-2026-10.md](./pb1c-voice-connect-timeout-honesty-design-2026-10.md)

```text
HANDOFF ATOMIC STEP: Timeout ringing_incoming same budget as ringing_outgoing → interrupted honesty
PAUSED / CANCELLED:  Shell-lag until end · M1–M3 · dialects · ASE-2 · SF-B · NIM until P0
CANONICAL OWNER:     main-shell voice timeout effect · realtime-voice-timeout-policy
PROOF BEFORE DONE:   L1 policy phase eligibility + existing timeout tests
SURFACE:             Voice dock (callee)
```

---

## Gap

Connect/outgoing-ring timeout is wired. **`ringing_incoming` is not** — callee dock can sit forever if neither Accept nor Decline is pressed.

## Contract

| Phase | On budget expiry |
|-------|------------------|
| `ringing_outgoing` | End (existing) |
| `connecting` | Policy extend/end (existing) |
| `ringing_incoming` | **End** → UI `interrupted` + `session_closed` (missed/timeout honesty) |

Reuse `VOICE_CALL_MIN_WAIT_MS`. Extend policy phase type to include `ringing_incoming` with same “not connecting → end / phase_not_eligible” behavior (or treat both ring phases identically).

## Non-goals

- Changing wait budget values  
- Auto-accept  
- Desktop L3  
