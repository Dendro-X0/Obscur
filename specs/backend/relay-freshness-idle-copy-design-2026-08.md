# Design — P4 Relays freshness copy (idle ≠ slow)

- Date (UTC): 2026-08-01
- Research: [relay-latency-stability-research-2026-07.md](./relay-latency-stability-research-2026-07.md) · **P4**
- Depends on: P2 Connect/RTT labels (done L1)

## Session gate

```text
NEXT ATOMIC STEP: after P3 L1
PAUSED / CANCELLED: COM-RUN-* · AUTH-SESSION · Dev Lab
CANONICAL OWNER: deriveRelayNodeStatus · deriveRelayRuntimeStatus (+ i18n keys that mirror badge strings)
PROOF: L1 relay-runtime-status.test.ts
OUT OF SCOPE: Changing STALE_EVENT_WINDOW_MS · Mbps · treating idle as healthy SLA
```

## Problem

Open sockets with fine Connect/RTT still show **No recent events** / “event flow degraded,” which users read as broken or slow.

## Contract

| Surface | Before | After |
|---------|--------|-------|
| Node badge (stale + open) | `No recent events` | `Quiet` |
| Node detail | “has not seen recent useful relay events” | Explicit: socket open; quiet ≠ high latency; send/wait for traffic |
| Runtime label (stale) | `Relay event flow degraded` | `Relay window quiet` |
| Runtime actionText (stale) | “has not seen recent relay events” | Quiet window; latency is separate (see Connect/RTT on cards) |

Status may remain `degraded` for filter/availability honesty — **copy** is the fix, not pretending traffic exists.

## Slice

1. Update English literals in `relay-runtime-status.ts`.
2. Update i18n keys that switch on those badge/label strings (`settings.relays.node.badge.*`, confidence already separate).
3. L1 expectations in `relay-runtime-status.test.ts`.

## Claim

- After L1: idle≠slow copy **implemented**.
- Verified when Relays Quiet badge appears with healthy Connect/RTT on idle open sockets (desktop optional).
