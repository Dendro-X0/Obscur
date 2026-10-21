# Perf explore summary

## Analysis mode

- Mode: **static** (runtime measured: false)
- Findings describe code shape — not measured dev fluidity. Tauri+Vite shells can white-screen while CPU is idle; use studio-dev-probe (attachMode=dev, baseUrl=http://127.0.0.1:5173). Web apps: interaction-probe for route transitions.
- Confirm tier: serve-oracle, http-health, route-probe, interaction-probe, studio-dev-probe
- Recommended attach mode: **dev** — Studio/Tauri: studio-dev-probe while pnpm dev:studio is running. SaaS web: interaction-probe attachMode=dev. Production TTFB: route-probe attachMode=production.

- Explore id: `ac57e93a-50d8-e155-ddd4-99c999d5fd45`
- Graph hash: `sha256:4fb63623f57c53bcdf64db07b5863b55bb6c81caf4c7283909e835dfc6dc9d1c`
- Scan snapshot: `sha256:a35453de5f9a9cb91c4110da5973438bfa3d317bb53bc37f72b443f435a2ca48`
- Explore scope: `monorepo-critical-path`
- Target: `apps/pwa`
- Findings: 25

## Auth route profile

- Public prefixes: /, /about, /auth, /blog, /docs, /login, /marketing, /pricing, /register, /signup
- Auth-gated prefixes: /account, /admin, /billing, /dashboard, /org, /settings, /user

## Monorepo critical path

- Primary app: `apps/pwa`
- Exploration roots: apps/pwa
- Scoped packages (27): apps/desktop/src-tauri, apps/pwa, packages/db, packages/dweb-auth, packages/dweb-client-gateway, packages/dweb-coordination-contracts, packages/dweb-core, packages/dweb-crdt, packages/dweb-crypto, packages/dweb-nostr, packages/dweb-storage, packages/dweb-storage-contracts, packages/dweb-transport-contracts, packages/dweb-transport-coordination, packages/dweb-transport-nostr, packages/dweb-transport-team-relay, packages/libobscur, packages/obscur-auth-engine, packages/obscur-conduit-mesh, packages/obscur-conduit-mesh-contracts, packages/obscur-dm-engine, packages/obscur-engine-contracts, packages/obscur-engine-host, packages/obscur-persistence-engine, packages/obscur-transport-engine, packages/obscur-workspace-engine, packages/ui-kit

## Fix queue — navigation blockers

_Red/yellow route, middleware, layout import, and barrel findings — highest user-impact._

- **Yellow** `perf:import:barrel-penalty:packages/obscur-conduit-mesh/src/index.ts` — Reduce barrel re-exports (25 wildcard re-exports, 17 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:packages/ui-kit/src/index.ts` — Reduce barrel re-exports (24 wildcard re-exports, 171 hot-path importers in app/src tree) — top affected routes include `/download` (+5 more)
- **Yellow** `perf:import:barrel-penalty:packages/dweb-auth/src/index.ts` — Reduce barrel re-exports (13 wildcard re-exports, 22 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:apps/pwa/app/features/desktop/utils/index.ts` — Reduce barrel re-exports (10 wildcard re-exports, 2 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:apps/pwa/app/features/workspace-kernel/index.ts` — Reduce barrel re-exports (9 wildcard re-exports, 1 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:apps/pwa/app/features/security/index.ts` — Reduce barrel re-exports (7 wildcard re-exports, 0 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:packages/obscur-conduit-mesh-contracts/src/index.ts` — Reduce barrel re-exports (8 wildcard re-exports, 12 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:apps/pwa/app/features/messaging/services/thread-history/index.ts` — Reduce barrel re-exports (6 wildcard re-exports, 0 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:packages/obscur-engine-host/src/index.ts` — Reduce barrel re-exports (7 wildcard re-exports, 25 hot-path importers in app/src tree) or lazy-load heavy subtree

## Fix queue — other action items

_Red/yellow serve, API, topology boundary, and runtime findings — fix after nav blockers._

- **Yellow** `perf:api:waterfall:apps/pwa/app/features/messaging/lib/nip96-upload-service.ts` — 3 sequential awaited API-shaped calls (Promise.all batches=0) — batch independent network work or reduce critical path

## Info inventory (collapsed)

_15 informational findings — full list in `findings.json`; not ranked in the fix queue._

| Category | Count |
| --- | ---: |
| api | 1 |
| stack | 1 |
| topology | 13 |

## Deferred confirm

Optional runtime validation: `perf.confirm.run` with `route-probe` or `serve-oracle` after static fixes.
