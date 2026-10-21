## Cumulative vs pinned baseline

- Pinned baseline: `d9c378d2-eedf-0746-a87a-09126679a7a1` (pinned 2026-08-24T06:17:06.054459700+00:00)
- Current explore: `ac57e93a-50d8-e155-ddd4-99c999d5fd45` (25 findings)
- Summary: d9c378d2 → ac57e93a: +17 findings · +0 red · nav blockers 4 → 9
- Fix-queue buckets: nav blockers 4 → 9, action items 2 → 1, info 2 → 15
- Previous explore: `d9c378d2-eedf-0746-a87a-09126679a7a1` (8 findings)
- Current explore: `ac57e93a-50d8-e155-ddd4-99c999d5fd45` (25 findings)
- Resolved: **1** · New: **18** · Unchanged: **7**
- Severity delta: red +0, yellow +4, info +13, total +17

### Resolved

- `perf:dev:tauri-vite-shell:apps/desktop`

### New findings

| Finding | Reason |
| --- | --- |
| `perf:import:barrel-penalty:packages/dweb-auth/src/index.ts` | scopeExpanded |
| `perf:import:barrel-penalty:packages/obscur-conduit-mesh-contracts/src/index.ts` | scopeExpanded |
| `perf:import:barrel-penalty:packages/obscur-conduit-mesh/src/index.ts` | scopeExpanded |
| `perf:import:barrel-penalty:packages/obscur-engine-host/src/index.ts` | scopeExpanded |
| `perf:import:barrel-penalty:packages/ui-kit/src/index.ts` | scopeExpanded |
| `perf:topology:architecture-layout:apps:pwa` | scopeExpanded |
| `perf:topology:critical-path-scope:apps:pwa` | scopeExpanded |
| `perf:topology:shared-fanout:apps:desktop:src-tauri` | scopeExpanded |
| `perf:topology:shared-fanout:packages:db` | scopeExpanded |
| `perf:topology:shared-fanout:packages:dweb-auth` | scopeExpanded |
| `perf:topology:shared-fanout:packages:dweb-coordination-contracts` | scopeExpanded |
| `perf:topology:shared-fanout:packages:dweb-core` | scopeExpanded |

### New obligations

- `perf:import:barrel-penalty:packages/dweb-auth/src/index.ts` — scopeExpanded
- `perf:import:barrel-penalty:packages/obscur-conduit-mesh-contracts/src/index.ts` — scopeExpanded
- `perf:import:barrel-penalty:packages/obscur-conduit-mesh/src/index.ts` — scopeExpanded
- `perf:import:barrel-penalty:packages/obscur-engine-host/src/index.ts` — scopeExpanded
- `perf:import:barrel-penalty:packages/ui-kit/src/index.ts` — scopeExpanded
- `perf:topology:architecture-layout:apps:pwa` — scopeExpanded
- `perf:topology:critical-path-scope:apps:pwa` — scopeExpanded
- `perf:topology:shared-fanout:apps:desktop:src-tauri` — scopeExpanded
- `perf:topology:shared-fanout:packages:db` — scopeExpanded
- `perf:topology:shared-fanout:packages:dweb-auth` — scopeExpanded
- `perf:topology:shared-fanout:packages:dweb-coordination-contracts` — scopeExpanded
- `perf:topology:shared-fanout:packages:dweb-core` — scopeExpanded

_+6 more in explore-diff.json_

## Step delta vs previous explore

- Previous explore: `d9c378d2-eedf-0746-a87a-09126679a7a1` (8 findings)
- Current explore: `ac57e93a-50d8-e155-ddd4-99c999d5fd45` (25 findings)
- Resolved: **1** · New: **18** · Unchanged: **7**
- Severity delta: red +0, yellow +4, info +13, total +17

## Verification

- Status: **mixed**
- Resolved findings: **1**
- Severity improvements: **0**

### Metric improvements (same finding id)

- `perf:dev:tauri-vite-shell:apps/desktop` — finding cleared (resolved)
- `perf:import:barrel-penalty:apps/pwa/app/features/security/index.ts` — barrelExportCount 8 → 7 (stale anchor)

### Resolved

- `perf:dev:tauri-vite-shell:apps/desktop`

### New findings

| Finding | Reason |
| --- | --- |
| `perf:import:barrel-penalty:packages/dweb-auth/src/index.ts` | scopeExpanded |
| `perf:import:barrel-penalty:packages/obscur-conduit-mesh-contracts/src/index.ts` | scopeExpanded |
| `perf:import:barrel-penalty:packages/obscur-conduit-mesh/src/index.ts` | scopeExpanded |
| `perf:import:barrel-penalty:packages/obscur-engine-host/src/index.ts` | scopeExpanded |
| `perf:import:barrel-penalty:packages/ui-kit/src/index.ts` | scopeExpanded |
| `perf:topology:architecture-layout:apps:pwa` | scopeExpanded |
| `perf:topology:critical-path-scope:apps:pwa` | scopeExpanded |
| `perf:topology:shared-fanout:apps:desktop:src-tauri` | scopeExpanded |
| `perf:topology:shared-fanout:packages:db` | scopeExpanded |
| `perf:topology:shared-fanout:packages:dweb-auth` | scopeExpanded |
| `perf:topology:shared-fanout:packages:dweb-coordination-contracts` | scopeExpanded |
| `perf:topology:shared-fanout:packages:dweb-core` | scopeExpanded |

### New obligations

- `perf:import:barrel-penalty:packages/dweb-auth/src/index.ts` — scopeExpanded
- `perf:import:barrel-penalty:packages/obscur-conduit-mesh-contracts/src/index.ts` — scopeExpanded
- `perf:import:barrel-penalty:packages/obscur-conduit-mesh/src/index.ts` — scopeExpanded
- `perf:import:barrel-penalty:packages/obscur-engine-host/src/index.ts` — scopeExpanded
- `perf:import:barrel-penalty:packages/ui-kit/src/index.ts` — scopeExpanded
- `perf:topology:architecture-layout:apps:pwa` — scopeExpanded
- `perf:topology:critical-path-scope:apps:pwa` — scopeExpanded
- `perf:topology:shared-fanout:apps:desktop:src-tauri` — scopeExpanded
- `perf:topology:shared-fanout:packages:db` — scopeExpanded
- `perf:topology:shared-fanout:packages:dweb-auth` — scopeExpanded
- `perf:topology:shared-fanout:packages:dweb-coordination-contracts` — scopeExpanded
- `perf:topology:shared-fanout:packages:dweb-core` — scopeExpanded

_+6 more in explore-diff.json_
