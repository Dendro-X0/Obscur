# Design — Relays settings latency metrics (conduit mesh bridge)

- Date (UTC): 2026-08-01
- Investigation: [relay-settings-latency-metrics-investigation-2026-07.md](./relay-settings-latency-metrics-investigation-2026-07.md)

## Goal

Settings → Relays cards show connect/probe latency samples for open mesh relays (not forever “NO SAMPLES / n/a” while sockets are open).

## Invariants

1. **One metrics owner:** global `relayHealthMonitor` remains the sample store (already used by NativeRelay + standby probe + dial hints).
2. **One pool UI surface:** `EnhancedRelayPoolResult.healthMetrics` / `getRelayHealth` stay the Settings/dashboard contract — no parallel Settings→monitor bypass.
3. **No second orchestrator:** do not revive browser-pool healthMonitor as a product path.
4. **No extra sockets on active pool** for v1 — prefer connect-RTT on the existing NativeRelay open.

## Slice A — Bridge (required)

In `useConduitMeshRelayPool`:

- Subscribe to `relayHealthMonitor` via `useSyncExternalStore` (or equivalent).
- `getRelayHealth(url)` → `relayHealthMonitor.getMetrics(url)`.
- `healthMetrics` → array of metrics for URLs in `poolUrls ∪ connection urls`, falling back to all monitor entries keyed by those URLs (exact string match as today).

## Slice B — Connect RTT writer (required)

In `NativeRelay`:

- Capture `connectStartedAtUnixMs` when connect begins.
- On successful open (native + browser fallback paths):  
  `relayHealthMonitor.recordLatency(url, max(1, now - connectStartedAtUnixMs))`  
  after (or with) `recordConnectionSuccess`.

## Slice C — Latency probes include active pool (required for live shells)

`useStandbyLatencyProbe` receives **all** `effectiveDmTransportRelayUrls`, not only standbys.
Short-lived probe sockets sample RTT for Settings cards without changing mesh ownership of the permanent pool sockets.

## Slice D — out of scope this pass

- Lowering success-rate sample threshold (<5 → still n/a by design).
- REQ/EOSE RTT without a probe socket.
- “No recent events” freshness copy.

## Proof plan

| Layer | Command / evidence |
|-------|-------------------|
| L1 | Vitest: conduit pool exposes monitor metrics; NativeRelay records latency on open (unit) |
| L2 | N/A (no schema) |
| L3 | Optional: open Settings → Relays on live desktop; note latencyHistory > 0 on at least one open public node — **do not claim fixed without this** if maintainer requires desktop |

## Claim language

- After L1 only: **implemented** (bridge + RTT writer).
- **Verified / fixed** only with named L3 evidence if required.
