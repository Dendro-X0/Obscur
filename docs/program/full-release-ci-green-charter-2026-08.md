# Full Release CI green charter — 2026-08

**Status:** Active  
**Scope lock:** Green the **existing** [`.github/workflows/release.yml`](../../.github/workflows/release.yml) — no website-channel redesign.  
**Owner:** `reliability-gates` (`release:test-pack`) → Full Release preflight + matrix  
**Pairs with:** [ci-local-fast-loop.md](./ci-local-fast-loop.md) · global ci-rigor

## Goal

1. `pnpm release:test-pack -- --skip-preflight` **Pass** (unblocks [reliability-gates.yml](../../.github/workflows/reliability-gates.yml) on `main`).
2. Local preflight Pass (`ci:local:all-cheap` · `ci:local:preflight`).
3. Full Release **build** run green (`publish_release=false` first).
4. Optional: `publish_release=true` for a GitHub Release page (not product download primary — website `/download` remains primary).

## Prerequisites (ordered)

| Tier | Command | Required before |
|------|---------|-----------------|
| T0–T2 | `pnpm ci:local:all-cheap` | Any push |
| T4 | `pnpm release:test-pack -- --skip-preflight` | Treat `main` / Full Release as ready |
| Preflight | `pnpm ci:local:preflight` (+ `--skip-relay` if no local `:7000`) | Full Release dispatch |
| Desktop (Win) | `pnpm ci:local:desktop-win` | Optional confidence before matrix |

## Non-goals

- Redesigning Full Release around website update channel
- Retiring softprops / changing publish job contract
- License decision
- Dialect / Tor Verified / free `groups/**` / AUTH-SESSION

## One failure class per iteration

| Class | Surface | Fix owner |
|-------|---------|-----------|
| Pack vitest | `apps/pwa` tests in release pack | Product test/mock alignment |
| Version / docs | T0 / T1 | Sync scripts + docs links |
| Desktop matrix OS | Full Release `build-desktop` | Investigation spec + one OS |
| Android secrets / signing | `build-android` | Signing policy (unsigned accepted) |

Do **not** batch-fix pack + workflow + Android in one push.

## Note

Full Release preflight **skips** `release:test-pack` (runs on every reliability-scope `main` push via reliability-gates). A green Full Release on a red pack still leaves `main` unhealthy — pack-first is mandatory for this charter.
