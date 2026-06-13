# Dev Lab — in-app testing module

**Status:** Phase 1 — scenario catalog + benchmark runner  
**Parent:** [testing-and-issue-tracking-spec.md](./testing-and-issue-tracking-spec.md)  
**API surface:** `window.obscurDevLab` (dev / `NEXT_PUBLIC_OBSCUR_DEV_LAB=1` only)

---

## Purpose

Dev Lab is Obscur's **continuous benchmark module** — an integrated dev-only layer that verifies core functionality across auth, navigation, settings, runtime digests, and fatal error boundaries. It is designed to **grow scenario-by-scenario** until it covers the app's critical paths and serves as the default “is the desktop app OK?” check.

---

## Quick start

### Fast lane (default during development)

| When | Command |
|------|---------|
| Terminal A (leave running) | `pnpm dev:desktop:online` |
| After every meaningful slice | `pnpm dev:lab:smoke` (~30s) |
| Before handoff / merge claim | `pnpm verify:handoff` |
| Pre-tag / milestone | `pnpm dev:lab:full` + [unified-verification-matrix.md](./unified-verification-matrix.md) |

**Do not** run the full manual matrix during iteration — L4 matrix is milestone truth only.

Issue promotion map: [dev-lab-issue-backlog.md](./dev-lab-issue-backlog.md)

```bash
# Terminal A
pnpm dev:desktop:online

# Terminal B — handoff gate (~3–8 min)
pnpm verify:handoff

# Fast smoke (~30s) after each slice
pnpm dev:lab:smoke

# Single scenario
pnpm dev:lab:run -- --scenario settings-tab-sweep
```

**In DevTools:**

```javascript
await window.obscurDevLab.runBenchmark({ suite: 'core' })
window.obscurDevLab.listScenarios()
await window.obscurDevLab.runScenario('settings-tab-sweep')
```

**Artifacts:** `test-results/dev-lab/dev-lab-benchmark-latest.json` (failed scenarios include `failureArtifacts` with screenshot + digest snapshot when run via CLI)

---

## Benchmark suites

| Suite | Scenarios | Use when |
|-------|-----------|----------|
| `smoke` | auth-unlock, shell-health | **Every slice** (~30s) |
| `core` | auth, nav, settings sweep, relay stress, DM synthetic/history, digest | **`pnpm verify:handoff`** / before merge |
| `full` | core + runtime-issues + extended nav + CLI scenarios | Pre-tag / milestone only |

### Scenario catalog (v1)

| ID | Category | Covers |
|----|----------|--------|
| `auth-unlock` | auth | Programmatic Tester1 unlock + shell health |
| `shell-health` | shell | Fatal boundary + sidebar chrome |
| `nav-matrix` | navigation | Network → Settings → Search → Chats |
| `settings-tab-sweep` | settings | All 10 settings tabs (`?tab=`) |
| `relay-toggle-stress` | settings | Relay category tabs, toggle, tab ping stress |
| `dm-send-synthetic` | messaging | Outgoing DM to Tester2 + digest gates |
| `dm-history-monotonic` | messaging | DM count must not shrink after route change |
| `dm-reload-history` | messaging | Send DM → reload → history count must not shrink + DM continuity digest |
| `chats-chrome` | messaging | Chats route health |
| `network-chrome` | network | Network route health |
| `runtime-m0-apis` | runtime | `obscurM0Triage` required APIs |
| `runtime-digest-gates` | runtime | No high digest risks / recent errors |
| `digest-membership-gates` | runtime | `membershipSendability` + `communityLifecycleConvergence` ≤ watch |
| `runtime-issues-clean` | runtime | No `obscurDevRuntimeIssues` errors (full suite) |
| `two-actor-dm` | messaging | Tester2 → Tester1 dual-browser (CLI, full suite) |
| `membership-join-leave` | network | Dual-browser coordination + M8 membership probes (CLI, full suite) |
| `dm-native-persist` | messaging | Tauri CDP: DM history after WebView reload (full suite, requires `--cdp`) |
| `cold-reload` | shell | Post-reload shell (CLI `--cold-reload` only) |
| `search-profile-jump` | navigation | Search → profile view (full suite) |
| `group-stub-send` | messaging | Group send stub toast, no crash (full suite) |
| `vault-unlock` | auth | Vault route health (full suite) |
| `membership-leave-rejoin-zombie` | network | E-REL leave zombie repair gates (full suite) |
| `sec-bot-keyword-flood` | security | BOT-1 rate limit + BOT-2 allowlist (full suite) |
| `trust-fixtures` | security | TRUST-1..3 assessment fixtures (full suite) |
| `auth4-scope-probe` | auth | AUTH-4 scope fingerprint (full suite) |
| `auth4-scope-probe-live` | auth | AUTH-4 dual browser (CLI full suite) |
| `membership-leave-rejoin-live` | network | E-REL reload stability (CLI full suite) |

---

## Adding scenarios (continuous development)

**Rule:** one scenario = one user-visible core path, owned in `features/dev-lab/`.

1. **Step logic** — add reusable steps in `dev-lab-scenario-steps.ts`
2. **Scenario def** — register in `dev-lab-scenario-catalog.ts` with `id`, `category`, `tags`
3. **Suite membership** — add id to `dev-lab-suite-manifest.json` (`suites.core` or `suites.full`)
4. **Unit test** — extend `dev-lab-scenario-runner.test.ts` for pure/DOM steps; manifest drift is guarded by `dev-lab-suite-manifest.test.ts`
5. **Docs** — update scenario table in this file

When a production bug escapes, **add a scenario before closing the issue** — that is how the benchmark stays honest.

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│  CLI: pnpm dev:lab:benchmark  →  scripts/dev-lab-run.mjs    │
├─────────────────────────────────────────────────────────────┤
│  window.obscurDevLab.runBenchmark / runScenario             │
├─────────────────────────────────────────────────────────────┤
│  dev-lab-scenario-runner  ←  dev-lab-scenario-catalog     │
│  dev-lab-scenario-steps   ←  dev-lab-shell-health          │
├─────────────────────────────────────────────────────────────┤
│  DevPanel · BotEngine · obscurChatPerf · M0 triage (existing)│
└─────────────────────────────────────────────────────────────┘
```

| Concern | Owner |
|---------|-------|
| Scenario catalog | `dev-lab-scenario-catalog.ts` |
| Suite membership manifest | `dev-lab-suite-manifest.json` (loaded by catalog + CLI) |
| Step primitives | `dev-lab-scenario-steps.ts` |
| Runner + report | `dev-lab-scenario-runner.ts` |
| Window API | `dev-lab-install.ts` |
| Auth bypass | `DevLabAuthBridge` in `AuthGateway` |
| CLI | `scripts/dev-lab-run.mjs` |
| Gate evaluation | `scripts/lib/dev-lab-benchmark-lib.mjs` |

---

## Proof layer (L5)

| Layer | Command |
|-------|---------|
| L5 smoke (slice) | `pnpm dev:lab:smoke` |
| L5 handoff gate | `pnpm verify:handoff` (= stability + dev-lab unit + benchmark) |
| L5 benchmark only | `pnpm dev:lab:benchmark` |
| L5 unit | `pnpm verify:dev-lab` |
| L3a capture | `pnpm capture:runtime` (complements L5) |
| L1/L2 | `pnpm verify:stability`, domain gates |

**Shipping claim:** “Core desktop OK” requires **L5 core benchmark pass** + relevant L1/L2 gates, not CI alone.

---

## API reference

| Method | Purpose |
|--------|---------|
| `listScenarios()` | Catalog metadata |
| `runBenchmark({ suite })` | Run suite, return `obscur.dev-lab.benchmark.v1` report |
| `runScenario(id)` | Single scenario |
| `probeShellHealth()` | Fatal boundary + chrome |
| `unlock('tester1')` | Programmatic auth |
| `createZombiePersona({ label })` | Ephemeral reversible persona |
| `teardownAllZombiePersonas()` | Clear persona registry |
| `captureBundle()` | Health + M0 + digest |

---

## Security

Dev Lab is **disabled in production** unless `NEXT_PUBLIC_OBSCUR_DEV_LAB=1`. Disposable credentials in `dev-lab-accounts.ts` — dev only.

---

## Related

- [runtime-capture-e2e.md](./runtime-capture-e2e.md)  
- [dev-lab-phase-2-charter.md](./dev-lab-phase-2-charter.md)  
- [ui-render-loop-systemic-program.md](./ui-render-loop-systemic-program.md)  
- Implementation: `apps/pwa/app/features/dev-lab/`
