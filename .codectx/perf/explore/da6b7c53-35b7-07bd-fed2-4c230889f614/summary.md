> **Progress:** Nav blockers cleared since `1c00357a-2dc6-e8d4-de60-fe39ae952afe` (4 items). 5 action item(s) remain.

# Perf explore summary

## Analysis mode

- Mode: **static** (runtime measured: false)
- Findings describe code shape — not measured navigation latency. Next.js/Vite dev adds compile/HMR overhead; use interaction-probe (dev attach) for route transition + long-task evidence.
- Confirm tier: serve-oracle, http-health, route-probe, interaction-probe
- Recommended attach mode: **dev** — Use interaction-probe attachMode=dev against running dev server to measure sluggish page switches. Use route-probe attachMode=production for TTFB on prod-shaped builds.

- Explore id: `da6b7c53-35b7-07bd-fed2-4c230889f614`
- Graph hash: `sha256:f469b27c07b7b238c60da9d3f07ac29f178089d43559de1fb231a99e968b35ac`
- Scan snapshot: `sha256:0557ab065b3d4898dc7cb4086f51ac1e23ce24591b44fb444467ed57133b2af8`
- Explore scope: `monorepo-critical-path`
- Target: `apps/pwa`
- Findings: 28

## Auth route profile

- Public prefixes: /, /about, /auth, /blog, /docs, /login, /marketing, /pricing, /register, /signup
- Auth-gated prefixes: /account, /admin, /billing, /dashboard, /org, /settings, /user

## Monorepo critical path

- Primary app: `apps/pwa`
- Exploration roots: apps/pwa
- Scoped packages (24): apps/pwa, packages/db, packages/dweb-auth, packages/dweb-client-gateway, packages/dweb-coordination-contracts, packages/dweb-core, packages/dweb-crdt, packages/dweb-crypto, packages/dweb-nostr, packages/dweb-storage, packages/dweb-storage-contracts, packages/dweb-transport-contracts, packages/dweb-transport-coordination, packages/dweb-transport-nostr, packages/dweb-transport-team-relay, packages/obscur-auth-engine, packages/obscur-conduit-mesh, packages/obscur-conduit-mesh-contracts, packages/obscur-dm-engine, packages/obscur-engine-contracts, packages/obscur-engine-host, packages/obscur-transport-engine, packages/obscur-workspace-engine, packages/ui-kit

## Fix queue — navigation blockers

_Red/yellow route, middleware, layout import, and barrel findings — highest user-impact._

- **Yellow** `perf:import:barrel-penalty:packages/obscur-conduit-mesh/src/index.ts` — Reduce barrel re-exports (27 wildcard re-exports, 1 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:packages/ui-kit/src/index.ts` — Reduce barrel re-exports (22 wildcard re-exports, 147 hot-path importers in app/src tree) — top affected routes include `/download` (+5 more)
- **Yellow** `perf:import:barrel-penalty:apps/pwa/app/features/desktop/utils/index.ts` — Reduce barrel re-exports (17 wildcard re-exports, 2 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:packages/dweb-auth/src/index.ts` — Reduce barrel re-exports (13 wildcard re-exports, 22 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:apps/pwa/app/features/invites/utils/index.ts` — Reduce barrel re-exports (9 wildcard re-exports, 0 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:apps/pwa/app/features/workspace-kernel/index.ts` — Reduce barrel re-exports (9 wildcard re-exports, 1 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:apps/pwa/app/features/messaging/services/thread-history/index.ts` — Reduce barrel re-exports (8 wildcard re-exports, 0 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:packages/dweb-crdt/src/index.ts` — Root barrel unused on hot paths; 6 subpath import(s) remain (7 wildcard re-exports on index) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:packages/obscur-engine-host/src/index.ts` — Reduce barrel re-exports (6 wildcard re-exports, 9 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:packages/obscur-conduit-mesh-contracts/src/index.ts` — Reduce barrel re-exports (5 wildcard re-exports, 1 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:packages/obscur-conduit-mesh-contracts/src/index.ts` — Reduce barrel re-exports (5 wildcard re-exports, 1 hot-path importers in app/src tree) or lazy-load heavy subtree

## Fix queue — other action items

_Red/yellow serve, API, topology boundary, and runtime findings — fix after nav blockers._

- **Yellow** `perf:topology:duplicate-dependency:@dweb/db` — Align @dweb/db version across workspace packages
- **Yellow** `perf:topology:duplicate-dependency:@types/react` — Align @types/react version across workspace packages
- **Yellow** `perf:topology:duplicate-dependency:@types/react-dom` — Align @types/react-dom version across workspace packages
- **Yellow** `perf:topology:duplicate-dependency:typescript` — Align typescript version across workspace packages
- **Yellow** `perf:topology:duplicate-dependency:vitest` — Align vitest version across workspace packages

## Info inventory (collapsed)

_12 informational findings — full list in `findings.json`; not ranked in the fix queue._

| Category | Count |
| --- | ---: |
| stack | 1 |
| topology | 11 |

## Deferred confirm

Optional runtime validation: `perf.confirm.run` with `route-probe` or `serve-oracle` after static fixes.
