## Step delta vs previous explore

- Previous explore: `12df4088-3055-4359-3ee2-40dfe1128f00` (1 findings)
- Current explore: `be7b3fc2-0f9b-3e00-d610-756976ffce4a` (20 findings)
- Resolved: **1** · New: **20** · Unchanged: **0**
- Severity delta: red +0, yellow +4, info +15, total +19

## Verification

- Status: **mixed**
- Resolved findings: **1**
- Severity improvements: **0**

### Metric improvements (same finding id)

- `perf:dev:tauri-vite-shell:apps/desktop` — finding cleared (resolved)

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
| `perf:stack:next:apps/pwa` | scopeExpanded |
| `perf:stack:next:apps/website` | scopeExpanded |
| `perf:topology:architecture-layout:apps:desktop` | scopeExpanded |
| `perf:topology:critical-path-scope:apps:desktop` | scopeExpanded |
| `perf:topology:shared-fanout:apps:desktop:src-tauri` | scopeExpanded |
| `perf:topology:shared-fanout:packages:db` | scopeExpanded |
| `perf:topology:shared-fanout:packages:dweb-auth` | scopeExpanded |

### New obligations

- `perf:import:barrel-penalty:packages/dweb-auth/src/index.ts` — scopeExpanded
- `perf:import:barrel-penalty:packages/obscur-conduit-mesh-contracts/src/index.ts` — scopeExpanded
- `perf:import:barrel-penalty:packages/obscur-conduit-mesh/src/index.ts` — scopeExpanded
- `perf:import:barrel-penalty:packages/obscur-engine-host/src/index.ts` — scopeExpanded
- `perf:import:barrel-penalty:packages/ui-kit/src/index.ts` — scopeExpanded
- `perf:stack:next:apps/pwa` — scopeExpanded
- `perf:stack:next:apps/website` — scopeExpanded
- `perf:topology:architecture-layout:apps:desktop` — scopeExpanded
- `perf:topology:critical-path-scope:apps:desktop` — scopeExpanded
- `perf:topology:shared-fanout:apps:desktop:src-tauri` — scopeExpanded
- `perf:topology:shared-fanout:packages:db` — scopeExpanded
- `perf:topology:shared-fanout:packages:dweb-auth` — scopeExpanded

_+8 more in explore-diff.json_
