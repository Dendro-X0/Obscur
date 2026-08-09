# Design — TI-4 Relays DISABLED duplex + detail codes

**Date (UTC):** 2026-08-08  
**Status:** Design Ready · **Implemented (L1)** · L3 UI Pass pending  
**Parents:** [tor-ti0-lifecycle-design-2026-08.md](./tor-ti0-lifecycle-design-2026-08.md) §5 · charter TI-4

```text
HANDOFF ATOMIC STEP:  TI-4 Relays DISABLED duplex
PAUSED / CANCELLED:   Community · AUTH-SESSION
CANONICAL OWNER:      deriveRelayNodeStatus · translateRelayNodeDetail · Relays list chips
PROOF BEFORE DONE:    L1 unit · L3 UI Pass (maintainer)
OUT OF SCOPE:         Tor dial policy · TI-5 onion · Community
```

## Contracts

1. When `enabled === false`: **one** Disabled signal — `badge: "Disabled"`, `roleLabel: ""` (role chip omitted).
2. Machine detail codes (`websocket_error`, snake_case) always humanize via `translateRelayNodeDetail` / shared helper — never show raw codes as the only user string when a known mapping exists.
3. Relays settings + relay dashboard skip rendering an empty role chip.

## Proof

| Layer | Check |
|-------|--------|
| L1 | `deriveRelayNodeStatus` disabled → badge Disabled, roleLabel empty · detail humanize maps `websocket_error` |
| L3 | Maintainer: disabled relay shows one Disabled chip |
