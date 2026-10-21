# Design — PB1-C joiner answer dispatch honesty

**Date (UTC):** 2026-10-18  
**Status:** Implemented · L1 Pass  
**Parents:** [pre-b2b-capability-design-2026-10.md](./pre-b2b-capability-design-2026-10.md) §5 · [pb1c-host-offer-dispatch-honesty-design-2026-10.md](./pb1c-host-offer-dispatch-honesty-design-2026-10.md)

```text
HANDOFF ATOMIC STEP: more PB1-C — joiner answer / setRemote fail must not leave silent connecting dock
PAUSED / CANCELLED: Claim video shipped · M1-L3 · Soft L3 Fixed · S6
CANONICAL OWNER:     main-shell inbound offer handler · voice-answer-dispatch-honesty
PROOF BEFORE DONE:   L1 mapper + joiner path uses it
SURFACE:             Desktop DM call dock (joiner)
```

## Gap

Host offer dispatch honesty landed. Joiner path can still `return` after `setRemoteDescription` / `createAnswer` / answer send failure with only a log.

## Contract

| Failure | UI |
|---------|-----|
| setRemote(offer) fails with no answer fallback | interrupted · `network_interrupted` · toast · tear down |
| createAnswer / setLocal fails | same |
| answer send returns false | same |

Pure helper: `resolveVoiceAnswerDispatchFailureUi()`.

## Non-goals

- Changing ICE buffering  
- Host answer setRemote soft-fail (best-effort until separate charter)  
- Camera / M1-L3
