# Investigation — Relays settings latency / network-speed metrics empty

- Date (UTC): 2026-08-01
- Surface: Settings → Relays → node cards (desktop online shell)
- Symptom: open public relays show **n/a** latency, **NO SAMPLES (0)**, success **n/a** / Insufficient data (0), while sockets are open

## Handoff gate

```text
NEXT ATOMIC STEP: Hold — public-only L3 Pass (Docker on)
PAUSED / CANCELLED: COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab as validation · AUTH-SESSION
User ask: Relays cards omit latency / network-speed metrics
OUT OF SCOPE: community un-pause · AUTH-SESSION · inventing U7
```

Not a PAUSED-band conflict. Optional next after B→C→E public-only L3.

## Evidence (UI)

Screenshot: nos.lol / primal / damus open (“ACTIVE TRANSPORT” / “POOL MEMBER”) but:

- LATENCY HISTORY: No latency samples yet / NO SAMPLES (0)
- SUCCESS RATE: n/a · Insufficient data (0)
- STABILITY: No recent events (separate freshness path — out of primary fix)

## Owner map

| Concern | Owner |
|---------|--------|
| Settings Relays cards | `apps/pwa/app/components/relay-dashboard.tsx` ← `relayPool.healthMetrics` |
| Pool hook (canonical) | `useRelayPoolRuntime` → **`useConduitMeshRelayPool` only** (RUST-4c) |
| Health samples store | Global `relayHealthMonitor` |
| Standby latency probes | `useStandbyLatencyProbe` → `recordLatency` on **standby** URLs only |
| Connect lifecycle | `NativeRelay` via `createRelayWebSocket` (mesh WS client uses this) |

## Findings

### F1 — Settings reads an always-empty array (primary)

`useConduitMeshRelayPool` returns:

- `healthMetrics: []` (hardcoded)
- `getRelayHealth: () => undefined`

`RelayDashboard` / settings model build maps from `pool.healthMetrics` only. With conduit-only wiring, the UI **cannot** show latency even when the global monitor has data.

### F2 — Writers still target the global monitor (orphaned for UI)

- `NativeRelay` records `recordConnectionSuccess` / `recordConnectionFailure` on `relayHealthMonitor`
- `useStandbyLatencyProbe` records `recordLatency` on `relayHealthMonitor` (comment claims “for settings UI”)
- Dial hints correctly fall back: `pool.getRelayHealth?.(url) ?? relayHealthMonitor.getMetrics(url)`
- Settings / dashboard **do not** use that fallback

### F3 — Active pool members are not standby-probed

`resolveStandbyProbeUrls` excludes `activePoolUrls`. Active public nodes therefore never get probe `recordLatency` from the standby cycle. Even after F1 is fixed, latency history stays empty unless something else records RTT.

### F4 — Native connect does not record latency

`NativeRelay` never calls `recordLatency`. Browser pool runtime (legacy, not product path) did measure open RTT. Mesh path lost that sample source.

### F5 — Success “n/a” until ≥5 connection samples (by design)

`relay-runtime-status.ts` `getSuccessLabel` returns `"n/a"` when `successfulConnections + failedConnections < 5`. Connection counters may exist on the monitor after F1; UI may still show n/a until enough samples. Latency cards key off `latencyHistory.length`, not that threshold.

## Mental simulation (one open Relays tab)

1. Mesh opens `wss://nos.lol` via NativeRelay → monitor gets success (maybe).
2. Pool exposes `healthMetrics: []` → dashboard Map empty → card shows NO SAMPLES.
3. Standby probe skips nos (active) → no latency samples.
4. User sees open socket + empty metrics (matches screenshot).

## Root cause (concise)

**Broken read path after RUST-4c:** metrics UI still assumes enhanced browser-pool `healthMetrics`, while the canonical pool stubs them empty and never bridges `relayHealthMonitor`. Secondary: no connect-RTT / active-pool latency writer for mesh.

## Non-goals

- Reintroducing enhanced-relay-pool orchestrator
- Changing “No recent events” freshness window as the primary fix
- Claiming desktop L3 “fixed” without Relays UI evidence after impl

## Proposed next

Design + smallest slice: bridge monitor → conduit `healthMetrics` / `getRelayHealth`; record connect RTT in `NativeRelay`. L1 unit tests; optional desktop smoke.
