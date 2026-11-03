# Design — PB1-C peer-connection start honesty

**Date (UTC):** 2026-10-18  
**Status:** Implemented · L1 Pass  
**Parents:** [pre-b2b-capability-design-2026-10.md](./pre-b2b-capability-design-2026-10.md) §5 · [pb1c-voice-dial-relay-preflight-design-2026-10.md](./pb1c-voice-dial-relay-preflight-design-2026-10.md)

```text
HANDOFF ATOMIC STEP: more PB1-C polish — host/signal path must not hang when RTC never starts
PAUSED / CANCELLED:  Claim video shipped · M1-L3 · Soft L3 Fixed · S6
CANONICAL OWNER:     main-shell ensureVoicePeerConnection callers · voice-peer-connection-start-honesty
PROOF BEFORE DONE:   L1 mapper + host/signal fail path uses it
SURFACE:             Desktop DM call dock
```

## Gap

Joiner already toasts `voiceCallJoinConnectionFailed` and marks `interrupted` when `ensureVoicePeerConnection` returns null. Host offer setup and the inbound-signal path return with no toast, leaving connecting/ring chrome up.

## Contract

| Path | On null connection |
|------|--------------------|
| Host offer start | Clear session · dock `interrupted` / `session_closed` · error toast · log `peer_connection_start_failed` |
| Host offer reset retry | Same |
| Inbound signal while session live | Same |

Pure helper: `resolveVoicePeerConnectionStartFailureUi()`.

## Non-goals

- Changing mic consent dialog  
- Camera / M1-L3  
- New call type
