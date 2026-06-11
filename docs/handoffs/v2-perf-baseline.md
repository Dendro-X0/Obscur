# v2 Performance Baseline (P0)

**Plan:** [obscur-v2-performance-optimization-plan.md](../program/obscur-v2-performance-optimization-plan.md) · **S0 protocol:** [obscur-shell-perf-baseline-s0.md](../program/obscur-shell-perf-baseline-s0.md)

Numbers before perf PRs. Append a row after each capture run.

## Commands

| Surface | Command | Artifact |
|---------|---------|----------|
| Static export (prod-like) | `pnpm perf:v2:baseline:static -- --skip-build --unlock --rapid` | `docs/assets/perf/v2-static-prod.json` |
| Dev webpack (`:3340` must be up) | Terminal A: `pnpm dev:desktop:live` · Terminal B: `pnpm perf:v2:baseline:dev-webpack` | `docs/assets/perf/v2-dev-webpack.json` |
| Compare dev vs static | `pnpm perf:v2:baseline:compare` | `docs/assets/perf/v2-comparison.json` |
| Record capture row | `pnpm perf:v2:baseline:record docs/assets/perf/v2-static-prod.json` | capture table below |
| Record compare row | `pnpm perf:v2:baseline:record-compare` | compare table below |

**Dev server:** `pnpm dev:desktop:live` or `pnpm dev:desktop:online` (integration). Harness hits `http://127.0.0.1:3340` only — no Tauri required for S0.

**Dev webpack interpretation:** First capture after Next cold start skews **toolchain** (median ≫1500ms, settings cold≫warm). Re-run `perf:v2:baseline:dev-webpack` once `:3340` is warm — canonical compare is warm dev vs static (`acceptable` when ratio &lt;2 and medians &lt;1500ms).

**Native Tauri (not headless Playwright):** unlock Tester1, then DevTools Performance or `pnpm capture:runtime:dm-kernel` for DM path evidence. WebView cold start is outside S0.

**DM open (manual until harness):** thread click → last message painted; record in Notes column.

## Thresholds (P2 gate — programmatic)

From navigation contract: rapid sidebar switching without route-mount probes >200ms.

| Signal | Pass (initial budget) |
|--------|------------------------|
| `summary.medianNavMs` | ≤ 1500ms (static unlocked) |
| `summary.maxRouteMountWorstMs` | ≤ 200ms when navigations ran |
| `checks.shellPhase` | `unlocked` |
| Rapid nav (`rapidNav` in JSON) | `gate.pass === true` when `--rapid` used |

## Capture log

| Recorded (UTC) | Surface | Cold DOM (ms) | Shell | Median nav (ms) | Max nav (ms) | Max route mount (ms) | Rapid gate | Artifact | Notes |
|----------------|---------|---------------|-------|-----------------|--------------|----------------------|------------|----------|-------|
| 2026-06-09 14:10:23 | static export | 74 | unlocked | 81 | 243 | 0 | fail | docs/assets/perf/v2-static-prod.json | Search probe stale; rapid gate fail until probe fix |
| 2026-06-09 14:19:43 | static export | 49 | unlocked | 108 | 411 | 0 | pass | docs/assets/perf/v2-static-prod.json | unlocked+rapid; v2PerfGate PASS |
| 2026-06-09 14:43:54 | static export | 58 | unlocked | 106 | 931 | 0 | pass | docs/assets/perf/v2-static-prod.json | post-P2 MainShell unmount; v2PerfGate PASS |
| 2026-06-09 15:03:42 | dev webpack | 446 | unlocked | 1796 | 6148 | 0 | pass | docs/assets/perf/v2-dev-webpack.json | dev webpack; settings cold/warm 36x; v2PerfGate FAIL expected |
| 2026-06-09 15:09:43 | dev webpack | 84 | unlocked | 152 | 991 | 0 | pass | docs/assets/perf/v2-dev-webpack.json | warm dev server; v2PerfGate PASS; compare acceptable 1.43x |
| _pending first run_ | — | — | — | — | — | — | — | — | Run `pnpm perf:v2:baseline:static -- --skip-build --unlock --rapid` |

## Compare log

| Recorded (UTC) | Verdict | Dev median (ms) | Static median (ms) | Ratio | Settings compile signal | Artifact | Notes |
|----------------|---------|-----------------|--------------------|-------|-------------------------|----------|-------|
| 2026-06-09 15:05:36 | toolchain | 1796 | 106 | 16.94 | yes | docs/assets/perf/v2-comparison.json | toolchain verdict expected for dev webpack |
| 2026-06-09 15:11:18 | acceptable | 152 | 106 | 1.43 | no | docs/assets/perf/v2-comparison.json | Both modes show sub-threshold sidebar navigation medians in this harness — re-check subjective UX on real Tauri WebView. |
| _pending compare_ | — | — | — | — | — | — | Run `pnpm perf:v2:baseline:compare` after dev capture |
