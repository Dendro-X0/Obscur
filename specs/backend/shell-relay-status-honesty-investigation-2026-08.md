# Investigation — Shell relay status honesty (sidebar vs composer)

**Date (UTC):** 2026-08-08  
**Status:** Root cause identified · Slice: unify on open sockets  
**Parent:** [public-nostr-always-on-investigation-2026-08.md](./public-nostr-always-on-investigation-2026-08.md)

```text
HANDOFF:              Shell relay status honesty — open sockets only
PAUSED / CANCELLED:   Tor R4 · Community · AUTH-SESSION
CANONICAL OWNER:      relay-status-indicator · composer relayStatus · resolveShellRelayActiveCounts
PROOF BEFORE DONE:    L1 unit tests · L3 visual: sidebar fraction == composer fraction
OUT OF SCOPE:         Tor · Docker requirement · public Nostr SLA
```

## Symptom (maintainer screenshots)

| Surface | Shown |
|---------|--------|
| Sidebar `RelayStatusIndicator` | **Connected** · `3/4` or `4/5` active relays |
| Composer / bottom chrome | Red · `0/1` or `0/4` relays active |
| Relays settings (later) | Public sockets open / quiet |
| Toast | damus connect failures (x6) — separate partial failure |

## Root cause

Two numerators, two denominators:

| Surface | Numerator | Denominator |
|---------|-----------|-------------|
| Sidebar label Connected | `max(writableRelayCount, openSockets)` | — |
| Sidebar fraction | `writableRelayCount` only | `max(connections, enabled…)` |
| Composer | `connections.status===open` | `connections.length` only |

Mesh / recovery **writable** (publish-ready) can exceed open sockets → sidebar claims Connected while composer correctly shows zero opens. Composer `total` from `connections.length` alone can under-count vs enabled list.

## Fix (subtraction)

1. One pure helper: `openCount` + `totalCount` from connections + enabled URLs.  
2. Sidebar Connected / fraction use **openCount** (not writable).  
3. Provider `relayStatus` uses the same helper.  
4. Writable remains for recovery/supervisor — not for “Connected” chrome.

## Proof

- L1: presentation + counts unit tests (writable>0, open=0 ⇒ not Connected; fractions match).  
- L3: maintainer glance — same `N/M` on sidebar and composer.
