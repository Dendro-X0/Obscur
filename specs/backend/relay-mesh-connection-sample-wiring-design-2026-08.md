# Design — P3 mesh connection success-rate samples

- Date (UTC): 2026-08-01
- Research: [relay-latency-stability-research-2026-07.md](./relay-latency-stability-research-2026-07.md) · **P3**
- Related: [relay-settings-latency-metrics-investigation-2026-07.md](./relay-settings-latency-metrics-investigation-2026-07.md) · F5 (≥5 sample gate)

## Session gate

```text
NEXT ATOMIC STEP: Hold — P5 docs done; maintainer pick P3→P4
PAUSED / CANCELLED: COM-RUN-* · AUTH-SESSION · Dev Lab
CANONICAL OWNER: createConduitMeshNostrWsClient · relayHealthMonitor
PROOF: L1 conduit-mesh-nostr-ws-client + optional monitor wiring test
OUT OF SCOPE: Lowering ≥5 gate · dual sparklines · AUTH-SESSION
```

## Problem

Relays cards show permanent **Insufficient data (0)** / success **n/a** while sockets are open.

Product dial path is `createConduitMeshNostrWsClient` → `createRelayWebSocket`. Localhost always uses raw `WebSocket` (no `NativeRelay` health hooks). Even when `NativeRelay` records, mesh is the lifecycle owner; success samples must not depend on which socket impl was chosen.

## Contract

| Mesh event | `relayHealthMonitor` |
|------------|----------------------|
| Dial start | `recordConnectionAttempt(url)` |
| `onopen` | `recordConnectionSuccess(url)` |
| Fail to open (timeout / error / close while connecting) | `recordConnectionFailure(url, reason)` once |
| Close after open (idle / remove URL) | `recordDisconnection(url)` — **not** a failure (avoids circuit-breaker storms) |

**Subtraction:** Stop `NativeRelay` from calling `recordConnectionSuccess` / `recordConnectionFailure` (keep `recordLatency` for Connect RTT). Legacy `relay-browser-pool-runtime` already records its own open/fail. Mesh is the product connection-sample owner.

≥5 sample gate for showing `%` stays (honesty). Goal is counters **advance from 0**, not instant high confidence.

## Slice

1. Wire monitor in `conduit-mesh-nostr-ws-client.ts`.
2. Remove connection success/failure writes from `NativeRelay`.
3. L1: open → success count; timeout → failure once; intentional close after open → no failure.

## Claim

- After L1: success-rate samples **implemented** on mesh dial path.
- UI “fixed” only after Relays shows non-zero confidence after several opens (desktop optional).
