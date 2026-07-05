# Perf explore summary

## Analysis mode

- Mode: **static** (runtime measured: false)
- Findings describe code shape — not measured navigation latency. Next.js/Vite dev adds compile/HMR overhead; use interaction-probe (dev attach) for route transition + long-task evidence.
- Confirm tier: serve-oracle, http-health, route-probe, interaction-probe
- Recommended attach mode: **dev** — Use interaction-probe attachMode=dev against running dev server to measure sluggish page switches. Use route-probe attachMode=production for TTFB on prod-shaped builds.

- Explore id: `1c00357a-2dc6-e8d4-de60-fe39ae952afe`
- Graph hash: `sha256:3a2d1dabc4fa6144f776aced6fa9040663d1d2098fc5a567175bc9295b8846df`
- Scan snapshot: `sha256:b153e6b78f7cac264362b5615c47ac20e482c6cc6341c97e27dd4fca84c37000`
- Explore scope: `monorepo-critical-path`
- Target: `apps/pwa`
- Findings: 51

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
- **Yellow** `perf:route:layout-client-fanout:apps/pwa/app/layout.tsx` — Layout imports 17 client components — client JS hydrates on every child route; lazy-load shells or move chrome below route segments
- **Yellow** `perf:import:barrel-penalty:apps/pwa/app/features/desktop/utils/index.ts` — Reduce barrel re-exports (17 wildcard re-exports, 2 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:packages/dweb-auth/src/index.ts` — Reduce barrel re-exports (13 wildcard re-exports, 22 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:apps/pwa/app/features/invites/utils/index.ts` — Reduce barrel re-exports (9 wildcard re-exports, 0 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:apps/pwa/app/features/workspace-kernel/index.ts` — Reduce barrel re-exports (9 wildcard re-exports, 1 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:apps/pwa/app/features/messaging/services/thread-history/index.ts` — Reduce barrel re-exports (8 wildcard re-exports, 0 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:route:missing-loading-rollup:apps/pwa/app/groups` — Add loading.tsx at apps/pwa/app/groups/loading.tsx to cover 5 routes under /groups (e.g. /groups/[...id]/page.tsx, /groups/block/page.tsx, /groups/leave/page.tsx)
- **Yellow** `perf:import:barrel-penalty:packages/dweb-crdt/src/index.ts` — Root barrel unused on hot paths; 6 subpath import(s) remain (7 wildcard re-exports on index) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:packages/obscur-engine-host/src/index.ts` — Reduce barrel re-exports (6 wildcard re-exports, 9 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:packages/obscur-conduit-mesh-contracts/src/index.ts` — Reduce barrel re-exports (5 wildcard re-exports, 1 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:packages/obscur-conduit-mesh-contracts/src/index.ts` — Reduce barrel re-exports (5 wildcard re-exports, 1 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:route:missing-loading:apps/pwa/app/network/[pubkey]/page.tsx` — Add loading.tsx for this route segment to avoid blank navigations
- **Yellow** `perf:route:missing-loading:apps/pwa/app/network/profile/page.tsx` — Add loading.tsx for this route segment to avoid blank navigations

## Fix queue — other action items

_Red/yellow serve, API, topology boundary, and runtime findings — fix after nav blockers._

- **Yellow** `perf:asset:oversized:apps/pwa/public/uploads/file-1b23a6e3-2d92-4c5b-aeaf-634a713d40c3.bin` — Compress, resize, or serve large static asset from CDN (696 KB)
- **Yellow** `perf:asset:oversized:apps/pwa/public/uploads/file-33ee6526-a9dc-4080-bfec-10e3460b0ab3.bin` — Compress, resize, or serve large static asset from CDN (696 KB)
- **Yellow** `perf:asset:oversized:apps/pwa/public/uploads/file-c724392e-86c4-4b53-a5e1-329e1aa06b76.bin` — Compress, resize, or serve large static asset from CDN (696 KB)
- **Yellow** `perf:asset:oversized:apps/pwa/public/uploads/file-14c6d501-094a-4d6f-b6c3-e4db267f2c83.bin` — Compress, resize, or serve large static asset from CDN (335 KB)
- **Yellow** `perf:asset:oversized:apps/pwa/public/uploads/file-60a16582-2f54-4348-bf2f-f57e6e78c39e.bin` — Compress, resize, or serve large static asset from CDN (335 KB)
- **Yellow** `perf:asset:oversized:apps/pwa/public/uploads/file-715bcbd9-3c5e-4cc0-bd00-b8f0a992c026.bin` — Compress, resize, or serve large static asset from CDN (335 KB)
- **Yellow** `perf:asset:oversized:apps/pwa/public/uploads/file-6d3e2398-929c-478b-8181-eea08d71ede2.bin` — Compress, resize, or serve large static asset from CDN (332 KB)
- **Yellow** `perf:asset:oversized:apps/pwa/public/uploads/file-6e956cf3-3663-47f8-a507-a1c0195cbdfd.bin` — Compress, resize, or serve large static asset from CDN (332 KB)
- **Yellow** `perf:asset:oversized:apps/pwa/public/uploads/file-9a74e736-ef66-4cea-a722-98c03b2c2a78.bin` — Compress, resize, or serve large static asset from CDN (332 KB)
- **Yellow** `perf:asset:oversized:apps/pwa/public/uploads/file-cebf6532-686e-4e59-a83f-640166fc961e.bin` — Compress, resize, or serve large static asset from CDN (332 KB)
- **Yellow** `perf:asset:raw-img:apps/pwa/app/components/avatar-upload.tsx` — Prefer next/image for responsive loading and priority hints
- **Yellow** `perf:asset:raw-img:apps/pwa/app/components/desktop/title-bar.tsx` — Prefer next/image for responsive loading and priority hints
- **Yellow** `perf:asset:raw-img:apps/pwa/app/features/network/components/group-card.tsx` — Prefer next/image for responsive loading and priority hints
- **Yellow** `perf:asset:raw-img:apps/pwa/app/features/security/components/identicon.tsx` — Prefer next/image for responsive loading and priority hints
- **Yellow** `perf:asset:raw-img:apps/pwa/app/features/vault/components/vault-media-grid.tsx` — Prefer next/image for responsive loading and priority hints
- **Yellow** `perf:asset:raw-img:apps/pwa/app/search/search-page-client.tsx` — Prefer next/image for responsive loading and priority hints
- **Yellow** `perf:topology:duplicate-dependency:@dweb/db` — Align @dweb/db version across workspace packages
- **Yellow** `perf:topology:duplicate-dependency:@tauri-apps/api` — Align @tauri-apps/api version across workspace packages
- **Yellow** `perf:topology:duplicate-dependency:@types/node` — Align @types/node version across workspace packages
- **Yellow** `perf:topology:duplicate-dependency:@types/react` — Align @types/react version across workspace packages
- **Yellow** `perf:topology:duplicate-dependency:@types/react-dom` — Align @types/react-dom version across workspace packages
- **Yellow** `perf:topology:duplicate-dependency:lucide-react` — Align lucide-react version across workspace packages
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
