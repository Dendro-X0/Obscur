## Step delta vs previous explore

- Previous explore: `da6b7c53-35b7-07bd-fed2-4c230889f614` (28 findings)
- Current explore: `6b557dff-bbe9-3ec3-8185-163db1c38819` (22 findings)
- Resolved: **6** · New: **0** · Unchanged: **22**
- Severity delta: red +0, yellow -6, info +0, total -6

**Net improvement** vs previous explore.

## Verification

- Status: **improved**
- Resolved findings: **6**
- Severity improvements: **0**

### Metric improvements (same finding id)

- `perf:import:barrel-penalty:apps/pwa/app/features/messaging/services/thread-history/index.ts` — barrelExportCount 8 → 7 (stale anchor)
- `perf:import:barrel-penalty:packages/dweb-crdt/src/index.ts` — finding cleared (resolved)
- `perf:import:barrel-penalty:packages/ui-kit/src/index.ts` — barrelExportCount 22 → 24 (regressed)
- `perf:topology:duplicate-dependency:@dweb/db` — finding cleared (resolved)
- `perf:topology:duplicate-dependency:@types/react` — finding cleared (resolved)
- `perf:topology:duplicate-dependency:@types/react-dom` — finding cleared (resolved)
- `perf:topology:duplicate-dependency:typescript` — finding cleared (resolved)
- `perf:topology:duplicate-dependency:vitest` — finding cleared (resolved)

### Resolved

- `perf:import:barrel-penalty:packages/dweb-crdt/src/index.ts`
- `perf:topology:duplicate-dependency:@dweb/db`
- `perf:topology:duplicate-dependency:@types/react`
- `perf:topology:duplicate-dependency:@types/react-dom`
- `perf:topology:duplicate-dependency:typescript`
- `perf:topology:duplicate-dependency:vitest`
