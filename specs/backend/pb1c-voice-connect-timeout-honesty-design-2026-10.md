# Design — PB1-C connect-timeout reason honesty

**Date (UTC):** 2026-10-13  
**Status:** Implemented · L1 green (2026-10-13)  
**Parents:** [pre-b2b-capability-design-2026-10.md](./pre-b2b-capability-design-2026-10.md) §5 · [realtime-voice-timeout-policy.ts](../../apps/pwa/app/features/messaging/services/realtime-voice-timeout-policy.ts)

```text
HANDOFF ATOMIC STEP: Map connect-timeout decision → VoiceCallDock reasonCode (not always session_closed)
PAUSED / CANCELLED:  Shell-lag until end · M1–M3 · dialects · ASE-2 · SF-B · NIM until P0 · PB1-D A
CANONICAL OWNER:     main-shell voice timeout effect · voice-call-reason-honesty
PROOF BEFORE DONE:   L1 pure mapper test + existing timeout-policy / invite-card tests
SURFACE:             Voice dock interrupted copy
```

---

## Gap

Connect timeout already ends the call (no silent hang), but UI always paints `reasonCode: "session_closed"`. Transport/no-progress timeouts should read as **network interrupted**, not “session closed.”

## Contract

| `timeoutDecision.reasonCode` | Dock `reasonCode` |
|------------------------------|-------------------|
| `no_transport_progress` | `network_interrupted` |
| `extension_budget_exhausted` | `network_interrupted` |
| `no_active_session` | `session_closed` |
| `phase_not_eligible` (ring timeout) | `session_closed` |
| other | `session_closed` |

Extract pure `mapRealtimeVoiceConnectTimeoutToUiReasonCode` beside the policy module.

## Non-goals

- Changing timer budgets / extension counts  
- Camera / M1 video  
- Desktop L3 call soak  
