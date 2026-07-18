# Local CI fast loop

**Status:** Active (2026-07-17)  
**Audience:** Maintainers debugging release/CI without waiting on GitHub Actions  
**Pairs with:** global **ci-rigor** skill · [obscur-v2-install-build-guide.md](./obscur-v2-install-build-guide.md)

## Why

Full Release (`.github/workflows/release.yml`) is **40m+** and multi-OS. Using GitHub as the first compiler turns a one-day fix into a week of wait loops.

**Rule:** run the **lowest sufficient local tier** before any push or Full Release dispatch. Never start with the native matrix when T0–T2 would catch the failure.

## Commands

```bash
pnpm ci:local                 # help
pnpm ci:local:t0              # version:check
pnpm ci:local:t1              # docs:check
pnpm ci:local:t2              # PWA tsc + release-relevant vitest
pnpm ci:local:t3              # verify:engine-lab
pnpm ci:local:t4              # release:test-pack --skip-preflight
pnpm ci:local:all-cheap       # t0 → t1 → t2 (default push gate)
pnpm ci:local:preflight       # integrity + version + docs + artifact matrix (+ relay smoke)
pnpm ci:local:preflight -- --skip-relay
pnpm ci:local:desktop-win     # Windows: desktop:ensure-nsis + desktop:package
```

Implementation: [`scripts/ci-local.mjs`](../../scripts/ci-local.mjs).

**Legacy:** `pnpm ci:local:ps1` runs the older PowerShell all-in-one gate ([`scripts/local-ci.ps1`](../../scripts/local-ci.ps1)) — prefer tiers.

## Tier map

| Tier | Time | Catches | When |
|------|------|---------|------|
| **T0** | ~30s | Version drift | `version.json` / package / tauri.conf |
| **T1** | ~1–2m | Docs links / stamps | `docs/**` |
| **T2** | ~2–5m | Type + shell/engine contracts | TS/TSX/Rust app changes |
| **T3** | ~5–15m | Engine-lab owner contracts | Kernel / engine-lab / transport |
| **T4** | ~20–45m | Full reliability pack | Before tag / reliability-gates risk |
| **preflight** | ~5–10m | Full Release preflight subset | Before dispatching Full Release |
| **desktop-win** | ~10–25m | Windows `tauri build` + NSIS collect | Tauri / desktop packaging (Windows host) |

## File → tier (minimum before push)

| Change in | Run |
|-----------|-----|
| Version files | T0 |
| Docs | T1 |
| `apps/pwa`, packages TS | T0 (if version) + T2 |
| Engine-lab / kernels | T2 + T3 |
| `scripts/run-release-test-pack.mjs`, lockfile, reliability workflows | T4 |
| `apps/desktop/**`, Tauri | `desktop-win` on Windows; then CI for mac/linux |

## What local tiers cannot replace

| Goal | Needs |
|------|--------|
| `.dmg` | macOS runner or Mac |
| `.AppImage` | Linux runner or Linux VM |
| Full Release green matrix | Authenticated CI logs + one OS failure class per iteration |

After local PASS, re-dispatch Full Release with a **narrow** platform filter once that input exists (Band 2) — until then, use Actions only after `all-cheap` (and `desktop-win` when packaging).

## Relay smoke note

`ci:local:preflight` (without `--skip-relay`) expects a relay on `ws://127.0.0.1:7000`:

```bash
pnpm dev:relay:docker   # other terminal
pnpm ci:local:preflight
```

Or skip: `pnpm ci:local:preflight -- --skip-relay`.

If T2 typecheck fails on known debt, contracts-only:

```bash
pnpm ci:local -- --tier t2 --skip-typecheck
```

## Proof this session

```bash
pnpm ci:local -- --list
pnpm ci:local:t0
pnpm ci:local:t1
```

**Note (2026-07-18):** Earlier preflight blockers (external Vectis path wording · missing v1.9.13 release notes stub · PWA Collapsible `id` / vault mock typings) were cleared in-tree so T0–T2 can go green before Full Release.