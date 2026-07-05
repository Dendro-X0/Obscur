# Perf explore summary

## Analysis mode

- Mode: **static** (runtime measured: false)
- Findings describe code shape — not measured navigation latency. Next.js/Vite dev adds compile/HMR overhead; use interaction-probe (dev attach) for route transition + long-task evidence.
- Confirm tier: serve-oracle, http-health, route-probe, interaction-probe
- Recommended attach mode: **dev** — Use interaction-probe attachMode=dev against running dev server to measure sluggish page switches. Use route-probe attachMode=production for TTFB on prod-shaped builds.

- Explore id: `19dad515-ea67-f586-ba17-b899ee4789fe`
- Graph hash: `sha256:6e8fd02943f597ba474b3a8dcffe89f7c6d70294b735eb591b7d0eeb97f2d4e2`
- Scan snapshot: `sha256:b153e6b78f7cac264362b5615c47ac20e482c6cc6341c97e27dd4fca84c37000`
- Explore scope: `monorepo-critical-path`
- Target: `apps/coordination`
- Findings: 28

## Auth route profile

- Public prefixes: /, /about, /auth, /blog, /docs, /login, /marketing, /pricing, /register, /signup
- Auth-gated prefixes: /account, /admin, /billing, /dashboard, /org, /settings, /user

## Monorepo critical path

- Primary app: `apps/coordination`
- Inferred backends: apps/pwa, apps/website
- Exploration roots: apps/coordination, apps/pwa, apps/website
- Scoped packages (26): apps/coordination, apps/pwa, apps/website, packages/db, packages/dweb-auth, packages/dweb-client-gateway, packages/dweb-coordination-contracts, packages/dweb-core, packages/dweb-crdt, packages/dweb-crypto, packages/dweb-nostr, packages/dweb-storage, packages/dweb-storage-contracts, packages/dweb-transport-contracts, packages/dweb-transport-coordination, packages/dweb-transport-nostr, packages/dweb-transport-team-relay, packages/obscur-auth-engine, packages/obscur-conduit-mesh, packages/obscur-conduit-mesh-contracts, packages/obscur-dm-engine, packages/obscur-engine-contracts, packages/obscur-engine-host, packages/obscur-transport-engine, packages/obscur-workspace-engine, packages/ui-kit

## Fix queue — navigation blockers

_Red/yellow route, middleware, layout import, and barrel findings — highest user-impact._

- **Yellow** `perf:import:barrel-penalty:packages/obscur-conduit-mesh/src/index.ts` — Reduce barrel re-exports (27 wildcard re-exports, 1 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:packages/ui-kit/src/index.ts` — Reduce barrel re-exports (22 wildcard re-exports, 147 hot-path importers in app/src tree) — top affected routes include `/download` (+5 more)
- **Yellow** `perf:import:barrel-penalty:packages/dweb-auth/src/index.ts` — Reduce barrel re-exports (13 wildcard re-exports, 22 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:packages/dweb-crdt/src/index.ts` — Root barrel unused on hot paths; 6 subpath import(s) remain (7 wildcard re-exports on index) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:packages/obscur-engine-host/src/index.ts` — Reduce barrel re-exports (6 wildcard re-exports, 9 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:packages/obscur-conduit-mesh-contracts/src/index.ts` — Reduce barrel re-exports (5 wildcard re-exports, 1 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:packages/obscur-conduit-mesh-contracts/src/index.ts` — Reduce barrel re-exports (5 wildcard re-exports, 1 hot-path importers in app/src tree) or lazy-load heavy subtree

## Fix queue — other action items

_Red/yellow serve, API, topology boundary, and runtime findings — fix after nav blockers._

- **Yellow** `perf:topology:duplicate-dependency:@dweb/db` — Align @dweb/db version across workspace packages
- **Yellow** `perf:topology:duplicate-dependency:@tauri-apps/api` — Align @tauri-apps/api version across workspace packages
- **Yellow** `perf:topology:duplicate-dependency:@types/node` — Align @types/node version across workspace packages
- **Yellow** `perf:topology:duplicate-dependency:@types/react` — Align @types/react version across workspace packages
- **Yellow** `perf:topology:duplicate-dependency:@types/react-dom` — Align @types/react-dom version across workspace packages
- **Yellow** `perf:topology:duplicate-dependency:lucide-react` — Align lucide-react version across workspace packages
- **Yellow** `perf:topology:duplicate-dependency:typescript` — Align typescript version across workspace packages
- **Yellow** `perf:topology:duplicate-dependency:vitest` — Align vitest version across workspace packages

## Info inventory (collapsed)

_13 informational findings — full list in `findings.json`; not ranked in the fix queue._

| Category | Count |
| --- | ---: |
| stack | 2 |
| topology | 11 |

## Deferred confirm

Optional runtime validation: `perf.confirm.run` with `route-probe` or `serve-oracle` after static fixes.
