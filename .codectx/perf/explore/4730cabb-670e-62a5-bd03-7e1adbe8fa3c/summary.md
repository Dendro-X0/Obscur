# Perf explore summary

## Analysis mode

- Mode: **static** (runtime measured: false)
- Findings describe code shape — not measured dev fluidity. Tauri+Vite shells can white-screen while CPU is idle; use studio-dev-probe (attachMode=dev, baseUrl=http://127.0.0.1:5173). Web apps: interaction-probe for route transitions.
- Confirm tier: serve-oracle, http-health, route-probe, interaction-probe, studio-dev-probe
- Recommended attach mode: **dev** — Studio/Tauri: studio-dev-probe while pnpm dev:studio is running. SaaS web: interaction-probe attachMode=dev. Production TTFB: route-probe attachMode=production.

- Explore id: `4730cabb-670e-62a5-bd03-7e1adbe8fa3c`
- Graph hash: `sha256:36c344b013d19dfad9d5a14b84360d0c850e457cf54a5f463b9c5fcd1f7932fa`
- Scan snapshot: `sha256:a35453de5f9a9cb91c4110da5973438bfa3d317bb53bc37f72b443f435a2ca48`
- Explore scope: `monorepo-critical-path`
- Target: `apps/coordination`
- Findings: 65

## Auth route profile

- Public prefixes: /, /about, /auth, /blog, /docs, /login, /marketing, /pricing, /register, /signup
- Auth-gated prefixes: /account, /admin, /billing, /dashboard, /org, /settings, /user

## Monorepo critical path

- Primary app: `apps/coordination`
- Inferred backends: apps/pwa, apps/relay-gateway, apps/website
- Exploration roots: apps/coordination, apps/pwa, apps/relay-gateway, apps/website
- Scoped packages (30): apps/coordination, apps/desktop/src-tauri, apps/pwa, apps/relay-gateway, apps/website, packages/db, packages/dweb-auth, packages/dweb-client-gateway, packages/dweb-coordination-contracts, packages/dweb-core, packages/dweb-crdt, packages/dweb-crypto, packages/dweb-nostr, packages/dweb-storage, packages/dweb-storage-contracts, packages/dweb-transport-contracts, packages/dweb-transport-coordination, packages/dweb-transport-nostr, packages/dweb-transport-team-relay, packages/libobscur, packages/obscur-auth-engine, packages/obscur-conduit-mesh, packages/obscur-conduit-mesh-contracts, packages/obscur-dm-engine, packages/obscur-engine-contracts, packages/obscur-engine-host, packages/obscur-persistence-engine, packages/obscur-transport-engine, packages/obscur-workspace-engine, packages/ui-kit

## Fix queue — navigation blockers

_Red/yellow route, middleware, layout import, and barrel findings — highest user-impact._

- **Yellow** `perf:import:barrel-penalty:packages/obscur-conduit-mesh/src/index.ts` — Reduce barrel re-exports (25 wildcard re-exports, 17 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:packages/ui-kit/src/index.ts` — Reduce barrel re-exports (24 wildcard re-exports, 171 hot-path importers in app/src tree) — top affected routes include `/download` (+5 more)
- **Yellow** `perf:import:barrel-penalty:packages/dweb-auth/src/index.ts` — Reduce barrel re-exports (13 wildcard re-exports, 22 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:packages/obscur-conduit-mesh-contracts/src/index.ts` — Reduce barrel re-exports (8 wildcard re-exports, 12 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:packages/obscur-engine-host/src/index.ts` — Reduce barrel re-exports (7 wildcard re-exports, 25 hot-path importers in app/src tree) or lazy-load heavy subtree

## Fix queue — other action items

_Red/yellow serve, API, topology boundary, and runtime findings — fix after nav blockers._

- **Yellow** `perf:api:fanout:apps/coordination/.wrangler/tmp/dev-1SOLVK/index.js` — 7 API-shaped call sites with no Promise.all batch — coalesce endpoints or parallelize with an explicit batch
- **Yellow** `perf:api:fanout:apps/coordination/.wrangler/tmp/dev-9ZLhKy/index.js` — 7 API-shaped call sites with no Promise.all batch — coalesce endpoints or parallelize with an explicit batch
- **Yellow** `perf:api:fanout:apps/coordination/.wrangler/tmp/dev-FfriwI/index.js` — 7 API-shaped call sites with no Promise.all batch — coalesce endpoints or parallelize with an explicit batch
- **Yellow** `perf:api:fanout:apps/coordination/.wrangler/tmp/dev-UCr4Ft/index.js` — 7 API-shaped call sites with no Promise.all batch — coalesce endpoints or parallelize with an explicit batch
- **Yellow** `perf:api:fanout:apps/coordination/.wrangler/tmp/dev-WFdrXK/index.js` — 7 API-shaped call sites with no Promise.all batch — coalesce endpoints or parallelize with an explicit batch
- **Yellow** `perf:api:fanout:apps/coordination/.wrangler/tmp/dev-bluPof/index.js` — 7 API-shaped call sites with no Promise.all batch — coalesce endpoints or parallelize with an explicit batch
- **Yellow** `perf:api:fanout:apps/coordination/.wrangler/tmp/dev-c4AWNC/index.js` — 7 API-shaped call sites with no Promise.all batch — coalesce endpoints or parallelize with an explicit batch
- **Yellow** `perf:api:fanout:apps/coordination/.wrangler/tmp/dev-gT35ln/index.js` — 7 API-shaped call sites with no Promise.all batch — coalesce endpoints or parallelize with an explicit batch
- **Yellow** `perf:api:fanout:apps/coordination/.wrangler/tmp/dev-ljm4cZ/index.js` — 7 API-shaped call sites with no Promise.all batch — coalesce endpoints or parallelize with an explicit batch
- **Yellow** `perf:api:fanout:apps/coordination/.wrangler/tmp/dev-nCQa6l/index.js` — 7 API-shaped call sites with no Promise.all batch — coalesce endpoints or parallelize with an explicit batch
- **Yellow** `perf:api:fanout:apps/coordination/.wrangler/tmp/dev-uJ5anc/index.js` — 7 API-shaped call sites with no Promise.all batch — coalesce endpoints or parallelize with an explicit batch
- **Yellow** `perf:api:fanout:apps/coordination/.wrangler/tmp/dev-vknbKa/index.js` — 7 API-shaped call sites with no Promise.all batch — coalesce endpoints or parallelize with an explicit batch
- **Yellow** `perf:api:fanout:apps/coordination/.wrangler/tmp/dev-wOXYBG/index.js` — 7 API-shaped call sites with no Promise.all batch — coalesce endpoints or parallelize with an explicit batch
- **Yellow** `perf:api:fanout:apps/coordination/.wrangler/tmp/dev-wnS8gC/index.js` — 7 API-shaped call sites with no Promise.all batch — coalesce endpoints or parallelize with an explicit batch
- **Yellow** `perf:api:fanout:apps/coordination/.wrangler/tmp/dev-yAfBC0/index.js` — 7 API-shaped call sites with no Promise.all batch — coalesce endpoints or parallelize with an explicit batch
- **Yellow** `perf:api:fanout:apps/coordination/.wrangler/tmp/bundle-1TpgWa/middleware-loader.entry.ts` — 6 API-shaped call sites with no Promise.all batch — coalesce endpoints or parallelize with an explicit batch
- **Yellow** `perf:api:fanout:apps/coordination/.wrangler/tmp/bundle-Eieqhs/middleware-loader.entry.ts` — 6 API-shaped call sites with no Promise.all batch — coalesce endpoints or parallelize with an explicit batch
- **Yellow** `perf:api:fanout:apps/coordination/.wrangler/tmp/bundle-ID3RGs/middleware-loader.entry.ts` — 6 API-shaped call sites with no Promise.all batch — coalesce endpoints or parallelize with an explicit batch
- **Yellow** `perf:api:fanout:apps/coordination/.wrangler/tmp/bundle-OwBnye/middleware-loader.entry.ts` — 6 API-shaped call sites with no Promise.all batch — coalesce endpoints or parallelize with an explicit batch
- **Yellow** `perf:api:fanout:apps/coordination/.wrangler/tmp/bundle-VGm2Zh/middleware-loader.entry.ts` — 6 API-shaped call sites with no Promise.all batch — coalesce endpoints or parallelize with an explicit batch
- **Yellow** `perf:api:fanout:apps/coordination/.wrangler/tmp/bundle-ggptvL/middleware-loader.entry.ts` — 6 API-shaped call sites with no Promise.all batch — coalesce endpoints or parallelize with an explicit batch
- **Yellow** `perf:api:fanout:apps/coordination/.wrangler/tmp/bundle-k14D7g/middleware-loader.entry.ts` — 6 API-shaped call sites with no Promise.all batch — coalesce endpoints or parallelize with an explicit batch
- **Yellow** `perf:api:fanout:apps/coordination/.wrangler/tmp/bundle-mh8ZuS/middleware-loader.entry.ts` — 6 API-shaped call sites with no Promise.all batch — coalesce endpoints or parallelize with an explicit batch
- **Yellow** `perf:api:fanout:apps/coordination/.wrangler/tmp/bundle-nDUx17/middleware-loader.entry.ts` — 6 API-shaped call sites with no Promise.all batch — coalesce endpoints or parallelize with an explicit batch
- **Yellow** `perf:api:fanout:apps/coordination/.wrangler/tmp/bundle-nwMfDJ/middleware-loader.entry.ts` — 6 API-shaped call sites with no Promise.all batch — coalesce endpoints or parallelize with an explicit batch
- **Yellow** `perf:api:fanout:apps/coordination/.wrangler/tmp/bundle-rs35ef/middleware-loader.entry.ts` — 6 API-shaped call sites with no Promise.all batch — coalesce endpoints or parallelize with an explicit batch
- **Yellow** `perf:api:fanout:apps/coordination/.wrangler/tmp/bundle-rsex38/middleware-loader.entry.ts` — 6 API-shaped call sites with no Promise.all batch — coalesce endpoints or parallelize with an explicit batch
- **Yellow** `perf:api:fanout:apps/coordination/.wrangler/tmp/bundle-s68emw/middleware-loader.entry.ts` — 6 API-shaped call sites with no Promise.all batch — coalesce endpoints or parallelize with an explicit batch
- **Yellow** `perf:api:fanout:apps/coordination/.wrangler/tmp/bundle-sAJRo1/middleware-loader.entry.ts` — 6 API-shaped call sites with no Promise.all batch — coalesce endpoints or parallelize with an explicit batch
- **Yellow** `perf:api:fanout:apps/coordination/.wrangler/tmp/bundle-xjUkub/middleware-loader.entry.ts` — 6 API-shaped call sites with no Promise.all batch — coalesce endpoints or parallelize with an explicit batch

## Info inventory (collapsed)

_30 informational findings — full list in `findings.json`; not ranked in the fix queue._

| Category | Count |
| --- | ---: |
| api | 15 |
| stack | 2 |
| topology | 13 |

## Deferred confirm

Optional runtime validation: `perf.confirm.run` with `route-probe` or `serve-oracle` after static fixes.
