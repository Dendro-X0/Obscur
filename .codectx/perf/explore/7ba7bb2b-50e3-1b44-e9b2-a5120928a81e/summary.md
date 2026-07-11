# Perf explore summary

## Analysis mode

- Mode: **static** (runtime measured: false)
- Findings describe code shape — not measured dev fluidity. Tauri+Vite shells can white-screen while CPU is idle; use studio-dev-probe (attachMode=dev, baseUrl=http://127.0.0.1:5173). Web apps: interaction-probe for route transitions.
- Confirm tier: serve-oracle, http-health, route-probe, interaction-probe, studio-dev-probe
- Recommended attach mode: **dev** — Studio/Tauri: studio-dev-probe while pnpm dev:studio is running. SaaS web: interaction-probe attachMode=dev. Production TTFB: route-probe attachMode=production.

- Explore id: `7ba7bb2b-50e3-1b44-e9b2-a5120928a81e`
- Graph hash: `sha256:45dd800b2548f284865f8334f6a4604932b7ff76abffd887642662a31c8c0f9e`
- Scan snapshot: `sha256:725512bbd7ca0efc648185ec9af934cf54ebdfda44a109843f148066ccead9b7`
- Explore scope: `single-app`
- Target: `apps/coordination`
- Findings: 1

## Auth route profile

- Public prefixes: /, /about, /auth, /blog, /docs, /login, /marketing, /pricing, /register, /signup
- Auth-gated prefixes: /account, /admin, /billing, /dashboard, /org, /settings, /user

## Fix queue — navigation blockers

_Red/yellow route, middleware, layout import, and barrel findings — highest user-impact._

_No navigation blockers._

## Fix queue — other action items

_Red/yellow serve, API, topology boundary, and runtime findings — fix after nav blockers._

- **Yellow** `perf:dev:tauri-vite-shell:apps/desktop` — Tauri + Vite dev shell depends on localhost dev server — white window if Vite is down, IPv6/127.0.0.1 mismatch, or secondary window races daemon boot

## Info inventory (collapsed)

_0 informational findings — full list in `findings.json`; not ranked in the fix queue._

_No informational findings._

## Deferred confirm

Optional runtime validation: `perf.confirm.run` with `route-probe` or `serve-oracle` after static fixes.
