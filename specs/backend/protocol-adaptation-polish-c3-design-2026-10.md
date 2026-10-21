# Design — C3 protocol adaptation polish

**Date (UTC):** 2026-10-17  
**Status:** Accepted · implemented (L1)  
**Parent:** [protocol-adaptation-layer-design-2026-10.md](./protocol-adaptation-layer-design-2026-10.md)

```text
HANDOFF ATOMIC STEP: C3 — capability chips, migration hints, performance budgets
PAUSED / CANCELLED: Soft L3 Fixed · remount · Step C · uncapped Quiet · Tor Verified
CANONICAL OWNER: ProtocolAdaptationLayer.capabilities() · shell affordances
PROOF: L1 — chips/hints/budgets contracts; composer gates media via capabilities() not if(isMatrix)
```

## Deliverables

| Item | Behavior |
|------|----------|
| **Capability chips** | Shell shows active protocol + capability chips from `capabilities()` (dms / groups / reactions / media) |
| **Composer gates** | Attachment / voice affordances disabled when `media: false` (Matrix MVP) — driven by capabilities, not protocol id checks in composer core |
| **Migration hints** | Settings + optional shell note when switching Nostr ↔ Matrix (honest gaps: no dual history, Matrix cleartext MVP, Nostr connection requests) |
| **Performance budgets** | Documented constants for Matrix sync/list limits (L1 contract); no Soft L3 reopen |

## Anti-patterns

- No `if (protocol === "matrix")` inside Composer for feature toggles — pass `capabilities` / boolean derived outside.
- No dual-write / bridge migration of message history.

## Proof

- L1 unit/contract tests for chips labels, composer media gate, budget constants, change event.
- L3 dual-profile soak remains PAUSED.

_Last updated: 2026-10-17T10:20:00Z_
