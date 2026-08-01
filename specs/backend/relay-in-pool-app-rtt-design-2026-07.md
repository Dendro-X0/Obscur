# Design — P1 In-pool REQ→EOSE application RTT

- Date (UTC): 2026-08-01
- Research: [relay-latency-stability-research-2026-07.md](./relay-latency-stability-research-2026-07.md) · M1
- Prior: P0 smoke Pass · metrics bridge · open-handshake probe fix

## Session gate

```text
NEXT ATOMIC STEP: Hold — P0 desktop Relays smoke Pass
PAUSED / CANCELLED: COM-RUN-* · AUTH-SESSION · Dev Lab as validation
CANONICAL OWNER: in-pool-app-rtt-probe → relayHealthMonitor.recordLatency
PROOF: L1 vitest · optional Relays UI refresh
OUT OF SCOPE: M3 UI labels · EVENT→OK write probes · Mbps · community
```

## Goal

Measure **application RTT (L-app)** on **existing open pool sockets** via Nostr `REQ` → `EOSE`, without opening a second WebSocket. Feed `relayHealthMonitor` so Relays cards show ongoing latency for quiet relays (not only connect/handshake).

## Contract

| Item | Value |
|------|--------|
| Trigger | Periodic cycle on open pool URLs (visible document only) |
| Wire | `["REQ", subId, filter]` then `["CLOSE", subId]` via `pool.sendToOpen` |
| Filter | Impossible match: `{ ids: ["0000…0001"] }` (64-hex) — expect empty set + quick EOSE |
| subId | `obscur-rtt-<nonce>` — never reuse product subscription ids |
| Success | First `["EOSE", subId]` from that relay URL → `latencyMs = now - start` (≥1) |
| Timeout | Default 4s per cycle; timed-out URLs → `ok: false` (no latency write) |
| Fan-out | One REQ to all open sockets; attribute EOSE by `subscribeToMessages` `url` |

## Owners

| Piece | Module |
|-------|--------|
| Pure cycle | `apps/pwa/app/features/relays/services/in-pool-app-rtt-probe.ts` |
| Hook | `use-in-pool-app-rtt-probe.ts` |
| Wire | `relay-provider.tsx` — open connection URLs |
| Samples | `relayHealthMonitor.recordLatency` (existing UI bridge) |

## Subtraction

- **Standby/second-socket probe** only for enabled URLs that are **not** currently `open` in the pool (avoid double sockets on active members).
- Do not add a parallel health monitor.

## Timing

| Constant | Value |
|----------|--------|
| Initial delay | 8_000 ms (after shell paint) |
| Interval | 30_000 ms |
| Per-cycle timeout | 4_000 ms |
| Inter-cycle overlap | Single-flight (`runningRef`) |

## Non-goals

- Tagging UI “connect vs RTT” (P2/M3)
- Changing “No recent events” freshness window
- Claiming throughput / Mbps

## Proof

| Layer | Command / evidence |
|-------|-------------------|
| L1 | vitest `in-pool-app-rtt-probe.test.ts` (+ standby URL filter if added) |
| L3 | Optional: Relays latency updates while sockets stay open without reconnect |

## Claim language

- After L1: in-pool app RTT **implemented**.
- Relays accuracy **verified** only with desktop evidence of updating samples on open quiet relays.
