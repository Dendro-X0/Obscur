## Step delta vs previous explore

- Previous explore: `ac689369-9677-5571-ac6b-0430f959c1fe` (22 findings)
- Current explore: `d9c378d2-eedf-0746-a87a-09126679a7a1` (8 findings)
- Resolved: **18** · New: **4** · Unchanged: **4**
- Severity delta: red +0, yellow -4, info -10, total -14

**Net improvement** vs previous explore.

## Verification

- Status: **improved**
- Resolved findings: **18**
- Severity improvements: **0**

### Metric improvements (same finding id)

- `perf:import:barrel-penalty:apps/pwa/app/features/desktop/utils/index.ts` — barrelExportCount 17 → 10 (stale anchor)
- `perf:import:barrel-penalty:apps/pwa/app/features/invites/utils/index.ts` — finding cleared (resolved)
- `perf:import:barrel-penalty:packages/dweb-auth/src/index.ts` — finding cleared (resolved)
- `perf:import:barrel-penalty:packages/obscur-conduit-mesh-contracts/src/index.ts` — finding cleared (resolved)
- `perf:import:barrel-penalty:packages/obscur-conduit-mesh-contracts/src/index.ts` — finding cleared (resolved)
- `perf:import:barrel-penalty:packages/obscur-conduit-mesh/src/index.ts` — finding cleared (resolved)
- `perf:import:barrel-penalty:packages/obscur-engine-host/src/index.ts` — finding cleared (resolved)
- `perf:import:barrel-penalty:packages/ui-kit/src/index.ts` — finding cleared (resolved)
- `perf:topology:architecture-layout:apps:pwa` — finding cleared (resolved)
- `perf:topology:critical-path-scope:apps:pwa` — finding cleared (resolved)

### Resolved

- `perf:import:barrel-penalty:apps/pwa/app/features/invites/utils/index.ts`
- `perf:import:barrel-penalty:packages/dweb-auth/src/index.ts`
- `perf:import:barrel-penalty:packages/obscur-conduit-mesh-contracts/src/index.ts`
- `perf:import:barrel-penalty:packages/obscur-conduit-mesh-contracts/src/index.ts`
- `perf:import:barrel-penalty:packages/obscur-conduit-mesh/src/index.ts`
- `perf:import:barrel-penalty:packages/obscur-engine-host/src/index.ts`
- `perf:import:barrel-penalty:packages/ui-kit/src/index.ts`
- `perf:topology:architecture-layout:apps:pwa`
- `perf:topology:critical-path-scope:apps:pwa`
- `perf:topology:shared-fanout:packages:db`
- `perf:topology:shared-fanout:packages:dweb-auth`
- `perf:topology:shared-fanout:packages:dweb-coordination-contracts`

_+6 more in explore-diff.json_

### New findings

| Finding | Reason |
| --- | --- |
| `perf:api:client-payload-suspect:apps/pwa/app/features/messaging/lib/nip96-upload-service.ts` | scopeExpanded |
| `perf:api:waterfall:apps/pwa/app/features/messaging/lib/nip96-upload-service.ts` | scopeExpanded |
| `perf:dev:tauri-vite-shell:apps/desktop` | scopeExpanded |
| `perf:import:barrel-penalty:apps/pwa/app/features/security/index.ts` | scopeExpanded |

### New obligations

- `perf:api:client-payload-suspect:apps/pwa/app/features/messaging/lib/nip96-upload-service.ts` — scopeExpanded
- `perf:api:waterfall:apps/pwa/app/features/messaging/lib/nip96-upload-service.ts` — scopeExpanded
- `perf:dev:tauri-vite-shell:apps/desktop` — scopeExpanded
- `perf:import:barrel-penalty:apps/pwa/app/features/security/index.ts` — scopeExpanded
