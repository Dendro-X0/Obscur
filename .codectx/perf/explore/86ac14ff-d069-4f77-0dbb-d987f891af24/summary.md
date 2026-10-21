> **Progress:** Nav blockers cleared since `2876d18a-d1e8-0109-fc96-fcee6b2546f4` (6 items). 1 action item(s) remain.

# Perf explore summary

## Analysis mode

- Mode: **static** (runtime measured: false)
- Findings describe code shape — not measured dev fluidity. Tauri+Vite shells can white-screen while CPU is idle; use studio-dev-probe (attachMode=dev, baseUrl=http://127.0.0.1:5173). Web apps: interaction-probe for route transitions.
- Confirm tier: serve-oracle, http-health, route-probe, interaction-probe, studio-dev-probe
- Recommended attach mode: **dev** — Studio/Tauri: studio-dev-probe while pnpm dev:studio is running. SaaS web: interaction-probe attachMode=dev. Production TTFB: route-probe attachMode=production.

- Explore id: `86ac14ff-d069-4f77-0dbb-d987f891af24`
- Graph hash: `sha256:acbeec53135489200dea469acb93f88a6966eb2b3cbb263891127c157b8e5aeb`
- Scan snapshot: `sha256:68da9e3a5009fe8d08168abe5b4154d6610a71432bf864a99c734a8155e59f94`
- Explore scope: `single-app`
- Target: `apps/relay-gateway`
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
