# Design — P2 Relays latency source labels (connect vs RTT)

- Date (UTC): 2026-08-01
- Research: [relay-latency-stability-research-2026-07.md](./relay-latency-stability-research-2026-07.md) · M3
- Depends on: P1 in-pool app RTT ([design](./relay-in-pool-app-rtt-design-2026-07.md))

## Session gate

```text
NEXT ATOMIC STEP: Hold — P1 in-pool REQ→EOSE app RTT implemented (L1)
PAUSED / CANCELLED: COM-RUN-* · AUTH-SESSION · Dev Lab
CANONICAL OWNER: relayHealthMonitor.latencySampleSource · formatRelayLatencyLabel · RelayDashboard
PROOF: L1 format + monitor + dashboard test
OUT OF SCOPE: Separate sparklines (M4) · Mbps · i18n catalog expansion beyond English literals already used on cards
```

## Goal

Relays cards must not imply one “latency” number means the same thing for connect-handshake samples and in-pool REQ→EOSE samples.

## Contract

| Writer | `latencySampleSource` |
|--------|------------------------|
| NativeRelay open RTT | `"connect"` |
| Standby/handshake WebSocket probe | `"connect"` |
| In-pool REQ→EOSE (P1) | `"app"` |
| Legacy / omitted | treat as `"connect"` |

| UI | Rule |
|----|------|
| Primary badge | `RTT {n}ms` if last source is `app`; else `Connect {n}ms`; else `n/a` |
| History caption | Optional one-word: “App RTT” / “Connect” matching last source when samples exist |

Average `latency` remains the rolling mean of `latencyHistory` (mixed sources OK for v1). Label reflects **last** sample source for honesty.

## Slice

1. Extend `RelayHealthMetrics` + `recordLatency(url, ms, source?)`.
2. Pure `formatRelayLatencyLabel` (+ history caption helper).
3. Wire writers; update `RelayDashboard` badge (and small caption).
4. L1 tests — no desktop required to claim implemented.

## Non-goals

- Dual sparklines
- Changing high-latency threshold semantics
- Full i18n keys (cards already use English literals)

## Claim

- After L1: source labels **implemented** (vitest format + dashboard — **10 Pass**).
- UI honesty **verified** when Relays shows `RTT` after P1 cycle on open remotes (desktop smoke — not claimed here).
