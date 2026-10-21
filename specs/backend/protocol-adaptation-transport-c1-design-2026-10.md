# Design — C1 transport selector → Tor gateway

**Date (UTC):** 2026-10-17  
**Status:** Accepted · implemented (L1)  
**Parent:** [protocol-adaptation-layer-design-2026-10.md](./protocol-adaptation-layer-design-2026-10.md)

```text
HANDOFF ATOMIC STEP: C1 — Clearnet|Tor wired to existing Tor gateway; NostrAdapter.connect honors transport
PAUSED / CANCELLED: Soft L3 Fixed · remount · Step C · uncapped Quiet · Tor Verified
CANONICAL OWNER: ProtocolAdaptationLayer.applyTransport · NostrAdapter.connect
PROOF: L1 contract — tor ↔ enableTorProxy + save_tor_settings/start_tor; clearnet stops; quiet persists without uncapped Quiet
```

## Goal

Make Settings **Network** transport selection operational (not prefs-only):

| Transport | Behavior |
|-----------|----------|
| `clearnet` | Tor preference OFF; `stop_tor` when native |
| `tor` | Tor preference ON (`enableTorProxy`); `save_tor_settings` + `start_tor` — existing dial policy arms SOCKS when Ready |
| `quiet` | Persist preference; Tor OFF; **do not** reopen uncapped Quiet (existing dial caps remain) |

## Invariants

1. ProtocolAdaptationLayer owns the transport plane; NostrAdapter.connect applies it.
2. Reuse existing gateway IPC (`save_tor_settings` / `start_tor` / `stop_tor`) — no new Tor spawn path.
3. Security panel Tor toggle stays valid: when `enableTorProxy` flips, sync `activeTransportId` (`tor` ↔ `clearnet`; leave `quiet` alone when turning Tor off from quiet).
4. Do not reopen Tor Verified / Soft L3 / uncapped Quiet bands.

## Proof

- **L1:** Contract + unit tests on `applyActiveTransport` / adapter connect wiring.
- **L2:** Desktop manual — Tor selected → gateway Ready → dials Tor-viable (ask / later soak).

_Last updated: 2026-10-17T09:35:00Z_
