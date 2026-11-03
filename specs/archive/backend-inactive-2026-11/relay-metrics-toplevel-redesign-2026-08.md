# Design + frontend — Relays metrics top-level + quieter open cards (U7)

- Date (UTC): 2026-08-01
- Trigger: Maintainer — redesign still needed; latency dashboard must not live under Advanced Settings
- Evidence: screenshot — metrics only after Advanced + nested collapse; Quiet cards still dense (Success n/a, Stability, long Quiet box)

## Session gate

```text
NEXT ATOMIC STEP: Hold — Relays offline card compact U6; continue → U7
PAUSED / CANCELLED: COM-RUN-* · AUTH-SESSION · Dev Lab
CANONICAL OWNER: relays-settings-tab-panel · RelayMetricCard
PROOF: L1 relay-dashboard (+ settings search if index changes)
OUT OF SCOPE: COM-RUN · AUTH-SESSION · primary failover · Mbps SLA
```

## Information architecture

**Before:** Connectivity → Advanced (toggle) → [lists…] → Collapsed “Network performance metrics” → RelayDashboard  

**After:**

1. Connectivity summary + redundancy + runtime strip (unchanged)
2. **Network performance** (always on main Relays surface) — toolbar + `RelayDashboard`
3. Advanced (toggle) — bulk actions + DM/community endpoint lists only

Anchor: `id="relay-performance-metrics"` for settings search scroll.

Remove nested Collapsible + `showPerformanceMetrics` default-closed gate.

## Quiet / open card slim (when open)

When `socketOpen` and (`badge === "Quiet"` or `successLabel === "n/a"`):

| Keep | Hide |
|------|------|
| Header, QUIET/role, RTT | Success Rate + Stability grid |
| Compact latency sparkline | Heavy boxed detail |
| One-line detail under sparkline | — |

Full Healthy cards (success % available) keep the stats grid.

Offline compact (U6) unchanged.

## Settings search

Add index entry `relay-performance` → Relays tab, element `#relay-performance-metrics` (optional prepare: no Advanced expand required).

## Claim

- Metrics on main Relays surface = **implemented** after L1 + panel change
- Desktop soft check optional for verified
