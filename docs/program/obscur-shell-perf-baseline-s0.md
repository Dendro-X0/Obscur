# S0 — Shell perf baseline (prod vs dev)

**Goal:** Separate **webpack dev compile** from **in-app architecture** before more React gates.

Investigation context: [obscur-startup-navigation-investigation-2026-05.md](./obscur-startup-navigation-investigation-2026-05.md) (lanes S0 / S6).

## What this measures

| Signal | Meaning |
|--------|---------|
| `coldStart.domContentLoadedMs` | Document ready on `/` (not full unlock) |
| `checks.shellPhase` | `unlocked` required for nav matrix |
| `checks.experimentShell` | Desktop experiment badge visible |
| `navigations[].elapsedMs` | Sidebar click → URL + route-ready probe |
| Settings visit 1 vs 2 | Cold vs warm settings (dev compile hint) |
| `routeMountWorstMs` | From `window.obscurRouteMountDiagnostics` when AppShell mounted |

**Not measured:** Tauri WebView cold start, native profile IPC, or true “time-to-sidebar” unless the harness reaches `shellPhase: unlocked`.

## Prerequisites

1. **Experiment shell** — desktop build or `NEXT_PUBLIC_OBSCUR_EXPERIMENT_SHELL=1`; badge `data-testid="experiment-shell-indicator"`.
2. **Dev run** — app reachable at `http://127.0.0.1:3340` (`pnpm dev:desktop` or `pnpm -C apps/pwa dev`).
3. **Unlocked session (recommended)** — complete unlock once in the desktop app, or accept a report with `shellPhase` ≠ `unlocked` and skipped navigations.

## Commands

```bash
# Prod-like static export (builds apps/pwa/out, serves on 3350)
pnpm perf:shell:s0:prod

# Re-run without rebuild
pnpm perf:shell:s0:prod -- --skip-build

# Dev webpack server (must already be running)
pnpm perf:shell:s0:dev

# Compare JSON artifacts
pnpm perf:shell:s0:compare
```

Artifacts default to:

- `docs/assets/perf/s0-prod.json`
- `docs/assets/perf/s0-dev.json`
- `docs/assets/perf/s0-comparison.json`

## Interpretation

| `s0-comparison.json` verdict | Action |
|------------------------------|--------|
| `toolchain` | Dev ≫ prod → **S6** (turbopack / prebuilt dev bundle); stop tuning React for dev-only lag |
| `architecture` | Both slow → **S1 / S5** staged boot + profile fail-open; N1–N5 may not be enough |
| `acceptable` | Harness medians low → validate in real Tauri; subjective lag may be boot/auth |
| `inconclusive` | Unlock failed or missing samples → fix harness preconditions and re-run |

**Settings cold→warm on dev only** (`settingsCompileSignal: true`): first `/settings` slow, second fast → route **compile/cache** (investigation §3), not persistent chrome alone.

## Manual cross-check

1. During dev startup, open `http://127.0.0.1:3340` in Chrome — if blank until “compiled”, bottleneck is **build**, not hydration.
2. Prod desktop: Tauri `frontendDist` from `pnpm run build:pwa-shell` — no on-demand compilation.
3. DevTools: `window.obscurRouteMountDiagnostics?.getSnapshot()` after a slow nav.

## Library tests

```bash
pnpm perf:shell:s0:test
```

Pure compare/summarize logic lives in `scripts/obscur-shell-perf-baseline-lib.mjs`.
