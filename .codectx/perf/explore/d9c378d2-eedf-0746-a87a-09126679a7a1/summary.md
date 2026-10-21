> **Progress:** Nav blockers cleared since `ac689369-9677-5571-ac6b-0430f959c1fe` (6 items). 2 action item(s) remain.

# Perf explore summary

## Analysis mode

- Mode: **static** (runtime measured: false)
- Findings describe code shape — not measured dev fluidity. Tauri+Vite shells can white-screen while CPU is idle; use studio-dev-probe (attachMode=dev, baseUrl=http://127.0.0.1:5173). Web apps: interaction-probe for route transitions.
- Confirm tier: serve-oracle, http-health, route-probe, interaction-probe, studio-dev-probe
- Recommended attach mode: **dev** — Studio/Tauri: studio-dev-probe while pnpm dev:studio is running. SaaS web: interaction-probe attachMode=dev. Production TTFB: route-probe attachMode=production.

- Explore id: `d9c378d2-eedf-0746-a87a-09126679a7a1`
- Graph hash: `sha256:d36049039c1d34cc9bffbf46f2cb94ea70970ddc67982768483f14626dd45b8b`
- Scan snapshot: `sha256:d14929064137593c9abf54d322dd691959c101c1cf7ff6908a68c7da5254236f`
- Explore scope: `single-app`
- Target: `apps/pwa`
- Findings: 8

## Auth route profile

- Public prefixes: /, /about, /auth, /blog, /docs, /login, /marketing, /pricing, /register, /signup
- Auth-gated prefixes: /account, /admin, /billing, /dashboard, /org, /settings, /user

## Fix queue — navigation blockers

_Red/yellow route, middleware, layout import, and barrel findings — highest user-impact._

- **Yellow** `perf:import:barrel-penalty:apps/pwa/app/features/desktop/utils/index.ts` — Reduce barrel re-exports (10 wildcard re-exports, 2 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:apps/pwa/app/features/workspace-kernel/index.ts` — Reduce barrel re-exports (9 wildcard re-exports, 1 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:apps/pwa/app/features/security/index.ts` — Reduce barrel re-exports (8 wildcard re-exports, 0 hot-path importers in app/src tree) or lazy-load heavy subtree
- **Yellow** `perf:import:barrel-penalty:apps/pwa/app/features/messaging/services/thread-history/index.ts` — Reduce barrel re-exports (6 wildcard re-exports, 0 hot-path importers in app/src tree) or lazy-load heavy subtree

## Fix queue — other action items

_Red/yellow serve, API, topology boundary, and runtime findings — fix after nav blockers._

- **Yellow** `perf:api:waterfall:apps/pwa/app/features/messaging/lib/nip96-upload-service.ts` — 3 sequential awaited API-shaped calls (Promise.all batches=0) — batch independent network work or reduce critical path
- **Yellow** `perf:dev:tauri-vite-shell:apps/desktop` — Tauri + Vite dev shell depends on localhost dev server — white window if Vite is down, IPv6/127.0.0.1 mismatch, or secondary window races daemon boot

## Info inventory (collapsed)

_2 informational findings — full list in `findings.json`; not ranked in the fix queue._

| Category | Count |
| --- | ---: |
| api | 1 |
| stack | 1 |

## Deferred confirm

Optional runtime validation: `perf.confirm.run` with `route-probe` or `serve-oracle` after static fixes.
