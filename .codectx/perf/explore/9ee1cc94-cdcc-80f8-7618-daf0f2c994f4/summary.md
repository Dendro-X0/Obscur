# Perf explore summary

## Analysis mode

- Mode: **static** (runtime measured: false)
- Findings describe code shape — not measured dev fluidity. Tauri+Vite shells can white-screen while CPU is idle; use studio-dev-probe (attachMode=dev, baseUrl=http://127.0.0.1:5173). Web apps: interaction-probe for route transitions.
- Confirm tier: serve-oracle, http-health, route-probe, interaction-probe, studio-dev-probe
- Recommended attach mode: **dev** — Studio/Tauri: studio-dev-probe while pnpm dev:studio is running. SaaS web: interaction-probe attachMode=dev. Production TTFB: route-probe attachMode=production.

- Explore id: `9ee1cc94-cdcc-80f8-7618-daf0f2c994f4`
- Graph hash: `sha256:d9433e678347a86f186242f043529b32bd95e6918079b009055ce8030d3f81eb`
- Scan snapshot: `sha256:3b0bd0e70105bf2b95fef132f2404d12695d2f1d6c6940b8ab725460c04c2223`
- Explore scope: `single-app`
- Target: `apps/coordination`
- Findings: 4

## Auth route profile

- Public prefixes: /, /about, /auth, /blog, /docs, /login, /marketing, /pricing, /register, /signup
- Auth-gated prefixes: /account, /admin, /billing, /dashboard, /org, /settings, /user

## Fix queue — navigation blockers

_Red/yellow route, middleware, layout import, and barrel findings — highest user-impact._

_No navigation blockers._

## Fix queue — other action items

_Red/yellow serve, API, topology boundary, and runtime findings — fix after nav blockers._

- **Yellow** `perf:api:fanout:apps/coordination/.wrangler/tmp/dev-dieleV/index.js` — 7 API-shaped call sites with no Promise.all batch — coalesce endpoints or parallelize with an explicit batch
- **Yellow** `perf:api:fanout:apps/coordination/.wrangler/tmp/bundle-dD1a2j/middleware-loader.entry.ts` — 6 API-shaped call sites with no Promise.all batch — coalesce endpoints or parallelize with an explicit batch
- **Yellow** `perf:dev:tauri-vite-shell:apps/desktop` — Tauri + Vite dev shell depends on localhost dev server — white window if Vite is down, IPv6/127.0.0.1 mismatch, or secondary window races daemon boot

## Info inventory (collapsed)

_1 informational findings — full list in `findings.json`; not ranked in the fix queue._

| Category | Count |
| --- | ---: |
| api | 1 |

## Deferred confirm

Optional runtime validation: `perf.confirm.run` with `route-probe` or `serve-oracle` after static fixes.
