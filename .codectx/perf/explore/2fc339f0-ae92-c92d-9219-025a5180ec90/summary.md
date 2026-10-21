# Perf explore summary

## Analysis mode

- Mode: **static** (runtime measured: false)
- Findings describe code shape — not measured dev fluidity. Tauri+Vite shells can white-screen while CPU is idle; use studio-dev-probe (attachMode=dev, baseUrl=http://127.0.0.1:5173). Web apps: interaction-probe for route transitions.
- Confirm tier: serve-oracle, http-health, route-probe, interaction-probe, studio-dev-probe
- Recommended attach mode: **dev** — Studio/Tauri: studio-dev-probe while pnpm dev:studio is running. SaaS web: interaction-probe attachMode=dev. Production TTFB: route-probe attachMode=production.

- Explore id: `2fc339f0-ae92-c92d-9219-025a5180ec90`
- Graph hash: `sha256:609caca0916f16ec971e9f36b2da1aabaa16dbcfe4d0f363bf84af2fca449604`
- Scan snapshot: `sha256:a35453de5f9a9cb91c4110da5973438bfa3d317bb53bc37f72b443f435a2ca48`
- Explore scope: `monorepo-critical-path`
- Target: `apps/website`
- Findings: 42

## Auth route profile

- Public prefixes: /, /about, /auth, /blog, /docs, /login, /marketing, /pricing, /register, /signup
- Auth-gated prefixes: /account, /admin, /billing, /dashboard, /org, /settings, /user

## Monorepo critical path

- Primary app: `apps/website`
- Inferred backends: apps/coordination, apps/pwa, apps/relay-gateway
- Exploration roots: apps/coordination, apps/pwa, apps/relay-gateway, apps/website
- Scoped packages (30): apps/coordination, apps/desktop/src-tauri, apps/pwa, apps/relay-gateway, apps/website, packages/db, packages/dweb-auth, packages/dweb-client-gateway, packages/dweb-coordination-contracts, packages/dweb-core, packages/dweb-crdt, packages/dweb-crypto, packages/dweb-nostr, packages/dweb-storage, packages/dweb-storage-contracts, packages/dweb-transport-contracts, packages/dweb-transport-coordination, packages/dweb-transport-nostr, packages/dweb-transport-team-relay, packages/libobscur, packages/obscur-auth-engine, packages/obscur-conduit-mesh, packages/obscur-conduit-mesh-contracts, packages/obscur-dm-engine, packages/obscur-engine-contracts, packages/obscur-engine-host, packages/obscur-persistence-engine, packages/obscur-transport-engine, packages/obscur-workspace-engine, packages/ui-kit

## Fix queue — navigation blockers

_Red/yellow route, middleware, layout import, and barrel findings — highest user-impact._

- **Yellow** `perf:import:barrel-penalty:packages/obscur-conduit-mesh/src/index.ts` — Reduce barrel re-exports (25 wildcard re-exports, 17 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:packages/ui-kit/src/index.ts` — Reduce barrel re-exports (24 wildcard re-exports, 171 hot-path importers in app/src tree) — top affected routes include `/download` (+5 more)
- **Yellow** `perf:import:barrel-penalty:packages/dweb-auth/src/index.ts` — Reduce barrel re-exports (13 wildcard re-exports, 22 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:packages/obscur-conduit-mesh-contracts/src/index.ts` — Reduce barrel re-exports (8 wildcard re-exports, 12 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:packages/obscur-engine-host/src/index.ts` — Reduce barrel re-exports (7 wildcard re-exports, 25 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:route:missing-loading:apps/website/src/app/changelog/page.tsx` — Add loading.tsx for this route segment to avoid blank navigations
- **Yellow** `perf:route:missing-loading:apps/website/src/app/download/page.tsx` — Add loading.tsx for this route segment to avoid blank navigations
- **Yellow** `perf:route:missing-loading:apps/website/src/app/features/[slug]/page.tsx` — Add loading.tsx for this route segment to avoid blank navigations
- **Yellow** `perf:route:missing-loading:apps/website/src/app/guide/[slug]/page.tsx` — Add loading.tsx for this route segment to avoid blank navigations
- **Yellow** `perf:route:missing-loading:apps/website/src/app/guide/page.tsx` — Add loading.tsx for this route segment to avoid blank navigations
- **Yellow** `perf:route:missing-loading:apps/website/src/app/limitations/page.tsx` — Add loading.tsx for this route segment to avoid blank navigations
- **Yellow** `perf:route:missing-loading:apps/website/src/app/page.tsx` — Add loading.tsx for this route segment to avoid blank navigations

## Fix queue — other action items

_Red/yellow serve, API, topology boundary, and runtime findings — fix after nav blockers._

- **Yellow** `perf:asset:oversized:apps/website/public/guide-media/settings_panel_1.mp4` — Compress, resize, or serve large static asset from CDN (1024 KB)
- **Yellow** `perf:asset:oversized:apps/website/public/guide-media/preview_files_1.mp4` — Compress, resize, or serve large static asset from CDN (862 KB)
- **Yellow** `perf:asset:oversized:apps/website/public/guide-media/multimedia_files_upload_and_transfer_1.mp4` — Compress, resize, or serve large static asset from CDN (704 KB)
- **Yellow** `perf:asset:oversized:apps/website/public/guide-media/relay_enable_disable_1.mp4` — Compress, resize, or serve large static asset from CDN (696 KB)
- **Yellow** `perf:asset:oversized:apps/website/public/guide-media/auth_create_1.mp4` — Compress, resize, or serve large static asset from CDN (627 KB)
- **Yellow** `perf:asset:oversized:apps/website/public/guide-media/Import_local_profile_and_sync_account_data_1.mp4` — Compress, resize, or serve large static asset from CDN (617 KB)
- **Yellow** `perf:asset:oversized:apps/website/public/guide-media/relay_overview_1.mp4` — Compress, resize, or serve large static asset from CDN (606 KB)
- **Yellow** `perf:asset:oversized:apps/website/public/guide-media/export_local_profile_1.mp4` — Compress, resize, or serve large static asset from CDN (590 KB)
- **Yellow** `perf:asset:oversized:apps/website/public/guide-media/delete_profile_window_isolation_1.mp4` — Compress, resize, or serve large static asset from CDN (348 KB)
- **Yellow** `perf:asset:oversized:apps/website/public/guide-media/group_invite_member_1.mp4` — Compress, resize, or serve large static asset from CDN (315 KB)
- **Yellow** `perf:asset:raw-img:apps/website/src/app/page.tsx` — Prefer next/image for responsive loading and priority hints
- **Yellow** `perf:asset:raw-img:apps/website/src/app/ambient-demo-video.tsx` — Prefer next/image for responsive loading and priority hints
- **Yellow** `perf:asset:raw-img:apps/website/src/app/guide/guide-docs-shell.tsx` — Prefer next/image for responsive loading and priority hints
- **Yellow** `perf:asset:raw-img:apps/website/src/app/hero-stage.tsx` — Prefer next/image for responsive loading and priority hints

## Info inventory (collapsed)

_16 informational findings — full list in `findings.json`; not ranked in the fix queue._

| Category | Count |
| --- | ---: |
| bundle | 1 |
| stack | 2 |
| topology | 13 |

## Deferred confirm

Optional runtime validation: `perf.confirm.run` with `route-probe` or `serve-oracle` after static fixes.
