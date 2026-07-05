> **Progress:** Nav blockers cleared since `ed7616a3-f1d4-708f-d236-3d142d9d6815` (1 items). 0 action item(s) remain.

# Perf explore summary

## Analysis mode

- Mode: **static** (runtime measured: false)
- Findings describe code shape — not measured navigation latency. Next.js/Vite dev adds compile/HMR overhead; use interaction-probe (dev attach) for route transition + long-task evidence.
- Confirm tier: serve-oracle, http-health, route-probe, interaction-probe
- Recommended attach mode: **dev** — Use interaction-probe attachMode=dev against running dev server to measure sluggish page switches. Use route-probe attachMode=production for TTFB on prod-shaped builds.

- Explore id: `ecd051b0-2db2-3ed9-1ea2-161159f7660f`
- Graph hash: `sha256:d31a96e6a2c933ae276604fb89d86117e9fc0001b759eb3cd50029afa2a799f1`
- Scan snapshot: `sha256:cfe9969aec7ff87086a6a14112c38cabb1db7b9b04a8cc55a2b60aec8cf7ca14`
- Explore scope: `monorepo-critical-path`
- Target: `apps/website`
- Findings: 24

## Auth route profile

- Public prefixes: /, /about, /auth, /blog, /docs, /login, /marketing, /pricing, /register, /signup
- Auth-gated prefixes: /account, /admin, /billing, /dashboard, /org, /settings, /user

## Monorepo critical path

- Primary app: `apps/website`
- Inferred backends: apps/coordination, apps/pwa
- Exploration roots: apps/coordination, apps/pwa, apps/website
- Scoped packages (26): apps/coordination, apps/pwa, apps/website, packages/db, packages/dweb-auth, packages/dweb-client-gateway, packages/dweb-coordination-contracts, packages/dweb-core, packages/dweb-crdt, packages/dweb-crypto, packages/dweb-nostr, packages/dweb-storage, packages/dweb-storage-contracts, packages/dweb-transport-contracts, packages/dweb-transport-coordination, packages/dweb-transport-nostr, packages/dweb-transport-team-relay, packages/obscur-auth-engine, packages/obscur-conduit-mesh, packages/obscur-conduit-mesh-contracts, packages/obscur-dm-engine, packages/obscur-engine-contracts, packages/obscur-engine-host, packages/obscur-transport-engine, packages/obscur-workspace-engine, packages/ui-kit

## Fix queue — navigation blockers

_Red/yellow route, middleware, layout import, and barrel findings — highest user-impact._

- **Yellow** `perf:import:barrel-penalty:packages/obscur-conduit-mesh/src/index.ts` — Reduce barrel re-exports (27 wildcard re-exports, 1 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:packages/ui-kit/src/index.ts` — Reduce barrel re-exports (24 wildcard re-exports, 147 hot-path importers in app/src tree) — top affected routes include `/download` (+5 more)
- **Yellow** `perf:import:barrel-penalty:packages/dweb-auth/src/index.ts` — Reduce barrel re-exports (13 wildcard re-exports, 22 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:packages/obscur-engine-host/src/index.ts` — Reduce barrel re-exports (6 wildcard re-exports, 9 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:packages/obscur-conduit-mesh-contracts/src/index.ts` — Reduce barrel re-exports (5 wildcard re-exports, 1 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:packages/obscur-conduit-mesh-contracts/src/index.ts` — Reduce barrel re-exports (5 wildcard re-exports, 1 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:route:missing-loading:apps/website/src/app/changelog/page.tsx` — Add loading.tsx for this route segment to avoid blank navigations
- **Yellow** `perf:route:missing-loading:apps/website/src/app/download/page.tsx` — Add loading.tsx for this route segment to avoid blank navigations
- **Yellow** `perf:route:missing-loading:apps/website/src/app/features/[slug]/page.tsx` — Add loading.tsx for this route segment to avoid blank navigations
- **Yellow** `perf:route:missing-loading:apps/website/src/app/page.tsx` — Add loading.tsx for this route segment to avoid blank navigations

## Fix queue — other action items

_Red/yellow serve, API, topology boundary, and runtime findings — fix after nav blockers._

_No other actionable findings._

## Info inventory (collapsed)

_14 informational findings — full list in `findings.json`; not ranked in the fix queue._

| Category | Count |
| --- | ---: |
| bundle | 1 |
| stack | 2 |
| topology | 11 |

## Deferred confirm

Optional runtime validation: `perf.confirm.run` with `route-probe` or `serve-oracle` after static fixes.
