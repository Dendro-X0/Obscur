# UI render-loop systemic program (STAB-R)

**Status:** Active — **blocks feature verification** until Band R1–R2 exit  
**Audience:** Maintainers, agents, future handoff  
**Mechanism detail:** [ui-effect-stability-policy.md](./ui-effect-stability-policy.md)  
**Architecture owners:** [12-core-architecture-truth-map.md](../encyclopedia/12-core-architecture-truth-map.md)

---

## What you are seeing (not random)

The error boundary (“fatal render loop”, `Maximum update depth exceeded`) is **one failure class**, not unrelated bugs.

| Symptom | Mechanism |
|---------|-----------|
| Crash on launch | High-frequency store tick → `useEffect` → `setState` → re-render → same effect, same tick |
| Crash after opening settings / search / groups | Same mechanism on **`relayPool` object identity** or **window snapshot churn** |
| “Fixed on desktop, breaks on mobile” | **Same React kernel** (`apps/pwa`) in Tauri desktop, Android WebView, and dev browser — different shell, identical hooks |
| Returns every few iterations | Patch fixes **one call site**; the **bridge** (relay → window → effects) stays |

This is **not** poor manual QA. Manual passes cannot prove absence of loops when the architecture allows unbounded effect re-entry.

---

## Root cause (post-migration)

After the greenfield restart, Obscur accumulated **parallel React surfaces** on one kernel:

1. **High-frequency external stores** — relay pool, relay health, relay runtime supervisor, window runtime supervisor (`useSyncExternalStore`).
2. **Mirrored into one window snapshot** — `RelayProvider` called `syncRelayRuntime` → every relay tick re-rendered **all** `useWindowRuntimeSnapshot()` subscribers (auth shell, activation, query runtime, overlays).
3. **Duplicated UI paths** — main shell, mobile compact layouts, group home, settings tab models, each adding `useEffect` chains on transport snapshots.
4. **Symptom patching** — guards, refs, and “once per open” fixes per screen without removing the bridge.

**Truth:** The crash is **architectural multiplicity** (R1-style) applied to **React subscription granularity**, not a missing null check.

---

## Comprehensive fix (three bands — not more manual matrix)

### Band R1 — Stop relay → window feedback (**subtraction**)

| Rule | Enforcement |
|------|-------------|
| `RelayProvider` / `ExperimentRelayShell` **must not** call `windowRuntimeSupervisor.syncRelayRuntime` | `pnpm verify:stability` → `relay-provider-sync-relay-runtime` |
| Relay metrics for UI → `useRelay()` / `relayRuntimeSupervisor` / `window.obscurRelayRuntime` | Code review |
| Window runtime for UI → **phase + session only** (`useShellTransportReady`, narrow hooks) | `relay-provider-window-runtime-subscription` gate |

**Diagnostics:** `window.obscurWindowRuntime.getSnapshot()` = startup/session phase.  
**Relay diagnostics:** `window.obscurRelayRuntime.getSnapshot()` (maintainer playbook).

### Band R2 — Effect discipline (**CI expansion**)

Forbidden in production `useEffect` dependency arrays:

- `relayPool` object identity (use `useRelayPoolRef` + connection signature)
- `runtime.snapshot.relayRuntime.*` (use `useRelay()` or phase gates)
- `hintsSignature` auto-reconcile in primary selection (supervisor-owned failover only)
- `profile.revert` in effect cleanup with `[profile]` deps (use unmount-only ref)

**Gate:** `scripts/verify-react-stability.mjs` (extend when a new loop class appears — **document the rule**, do not rely on maintainer memory).

**Canonical patterns:** [ui-effect-stability-policy.md](./ui-effect-stability-policy.md)

### Band R2b — Settings tab model composition (**STAB-SETTINGS-1**)

| Rule | Enforcement |
|------|-------------|
| Cross-tab fields (`relayRuntimeStatus`, `deriveRelayRuntimeStatus`, `deriveRelayNodeStatus`) owned by **`useSettingsSharedModel`** | Merged in `createSettingsTabPanelModelProvider` |
| Tab models return **tab-specific** fields only | Review |
| Settings tab crash → **tab error boundary**, not root fatal boundary | `SettingsTabPanelErrorBoundary` in loader |
| All 10 tab providers mount without throw | `settings-tab-panel-mount.stability.test.tsx` in `pnpm verify:stability` |

---

### Band R3 — Activation single-shot (**owner**)

| Owner | Rule |
|-------|------|
| `RuntimeActivationManager` | `markRuntimeReady` / `markRuntimeDegraded` at most **once per activation cycle**; never keyed on relay tick fields |
| `windowRuntimeSupervisor.transitionTo` | Skip duplicate `ready` when activation report unchanged |

**Regression tests:** `window-runtime-supervisor.test.ts`, `runtime-activation-manager.test.tsx`

---

## Subscription tiers (handoff rule of thumb)

| Tier | Subscribe to | Example hooks |
|------|----------------|---------------|
| **0 — User intent** | Identity, route, explicit clicks | `publicKeyHex`, `conversationId` |
| **1 — Phase gates** | Shell ready / auth phase | `useShellTransportReady`, `runtime.snapshot.phase` |
| **2 — Connection signal** | Deduped signature | `connections.map(u=>status).join("|")` |
| **3 — Diagnostics** | Full snapshots | Dev panel, `obscurRelayRuntime` only |

**Default for new UI:** Tier 0–1 only. Tier 2 requires comment. Tier 3 dev-only.

---

## What we stop doing

- **No** “unified verification matrix” until Band R1–R2 exit on `main` (automated gates only).
- **No** claiming desktop fix without `verify:stability` + activation tests green.
- **No** new `useEffect` on `useRelay().relayPool` identity — use ref pattern.

---

## Exit criteria (Band STAB-R)

| ID | Done when |
|----|-----------|
| R1 | `syncRelayRuntime` removed from relay providers; CI rule green |
| R2 | `verify-react-stability` covers pool + window-relay deps; audit P1 rows closed or waived in register |
| R3 | Activation tests green; no `markRuntimeReady` spam in transitionTo |
| R-smoke | Headless STAB-R1/R3 tests in `verify:stability` | **Done** |

Then — and only then — resume Phase B matrix for **product** rows (DM, communities), not loop hunting.

---

## Relation to persistence / SQLite work

SQLite convergence (P3) and render loops (STAB-R) are **orthogonal**. Fixing SQLite does not fix React loops. Both must exit before v2.0 promotion.

---

## Revision history

| Date | Change |
|------|--------|
| 2026-06-02 | Initial systemic program — post STAB-4; R1 subtract syncRelayRuntime bridge |
