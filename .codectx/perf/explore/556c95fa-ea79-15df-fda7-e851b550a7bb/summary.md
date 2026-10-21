> **Progress:** Nav blockers cleared since `d69aa988-5c0a-11d0-65f9-2f7a303336b9` (4 items). 15 action item(s) remain.

# Perf explore summary

## Analysis mode

- Mode: **static** (runtime measured: false)
- Findings describe code shape — not measured dev fluidity. Tauri+Vite shells can white-screen while CPU is idle; use studio-dev-probe (attachMode=dev, baseUrl=http://127.0.0.1:5173). Web apps: interaction-probe for route transitions.
- Confirm tier: serve-oracle, http-health, route-probe, interaction-probe, studio-dev-probe
- Recommended attach mode: **dev** — Studio/Tauri: studio-dev-probe while pnpm dev:studio is running. SaaS web: interaction-probe attachMode=dev. Production TTFB: route-probe attachMode=production.

- Explore id: `556c95fa-ea79-15df-fda7-e851b550a7bb`
- Graph hash: `sha256:b3b035534e95f0599828fe65b51ca9814ab43a3f8845259502dadba059a27bd4`
- Scan snapshot: `sha256:3b0bd0e70105bf2b95fef132f2404d12695d2f1d6c6940b8ab725460c04c2223`
- Explore scope: `single-app`
- Target: `apps/website`
- Findings: 24

## Auth route profile

- Public prefixes: /, /about, /auth, /blog, /docs, /login, /marketing, /pricing, /register, /signup
- Auth-gated prefixes: /account, /admin, /billing, /dashboard, /org, /settings, /user

## Fix queue — navigation blockers

_Red/yellow route, middleware, layout import, and barrel findings — highest user-impact._

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
- **Yellow** `perf:dev:tauri-vite-shell:apps/desktop` — Tauri + Vite dev shell depends on localhost dev server — white window if Vite is down, IPv6/127.0.0.1 mismatch, or secondary window races daemon boot

## Info inventory (collapsed)

_2 informational findings — full list in `findings.json`; not ranked in the fix queue._

| Category | Count |
| --- | ---: |
| bundle | 1 |
| stack | 1 |

## Deferred confirm

Optional runtime validation: `perf.confirm.run` with `route-probe` or `serve-oracle` after static fixes.
