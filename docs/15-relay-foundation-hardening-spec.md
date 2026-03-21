# 15 Relay Foundation Hardening Spec

_Last reviewed: 2026-03-19 (baseline commit 0a799f5)._

Status note (2026-03-19):
- This spec contains historical warm-up references from earlier v0.9.2 rollout experiments.
- `warm-up-supervisor` is not part of the active startup owner chain in the current workspace.
- Treat warm-up sections as archived design context only, and use active owner truth from:
  - `docs/12-core-architecture-truth-map.md`
  - `docs/13-relay-and-startup-failure-atlas.md`
  - `docs/17-v0.9.2-expansion-context.md`

Status: Active (Phase 1 through Phase 4 landed)
Scope: web/PWA + desktop relay runtime reliability foundation

## Goal

Establish a stable relay foundation for startup, reconnect, and sync behavior without introducing owner drift.

This effort covers:
- relay connection/recovery behavior under real failure classes,
- warm-up and relay-readiness convergence behavior,
- diagnostics and evidence surfaces needed for safe iteration,
- documentation contracts that prevent accidental architecture rebuilds.

## Constraints

1. One canonical lifecycle owner per runtime domain.
2. No parallel relay lifecycle path introduced in feature components.
3. Local optimistic state is not delivery/sync proof.
4. Degraded/fatal transitions require explicit evidence and reason codes.
5. Runtime and docs must be updated together for architecture-level changes.

## Canonical Owner Chain (Locked)

1. `apps/pwa/app/features/relays/providers/relay-provider.tsx`
2. `apps/pwa/app/features/relays/services/relay-runtime-supervisor.ts`
3. `apps/pwa/app/features/relays/services/relay-recovery-policy.ts`
4. `apps/pwa/app/features/relays/hooks/enhanced-relay-pool.ts`

Startup and activation cross-owners:
- `removed: apps/pwa/app/features/runtime/services/warm-up-supervisor.ts`
- `apps/pwa/app/features/runtime/services/window-runtime-supervisor.ts`
- `apps/pwa/app/features/runtime/components/runtime-activation-manager.tsx`

Desktop native boundary:
- `apps/desktop/src-tauri/src/relay.rs`
- `apps/desktop/src-tauri/src/net.rs`
- `apps/desktop/src-tauri/src/protocol.rs`

## Phase Plan

## Phase 1: Scope Lock and Safety Baseline (Landed 2026-03-19)

Objective:
- Lock owner boundaries and create a repeatable baseline capture protocol before relay behavior changes.

Landed outputs:
- canonical owner lookup:
  - `docs/14-module-owner-index.md`
- relay/startup failure map:
  - `docs/13-relay-and-startup-failure-atlas.md`
- runtime architecture and repository context refresh:
  - `docs/02-repository-map.md`
  - `docs/03-runtime-architecture.md`
  - `docs/04-messaging-and-groups.md`

Exit criteria:
- [x] owner chain is documented and linked from docs index
- [x] failure classes are mapped to concrete owner files
- [x] minimal runtime capture bundle is documented for long-log cases

## Phase 2: Relay Runtime Contract Hardening (Landed 2026-03-19)

Objective:
- make relay-readiness and window-runtime degraded mapping explicit and test-backed.

Landed outcomes:
- explicit relay-driven degraded transition policy in runtime activation path:
  - `apps/pwa/app/features/runtime/components/runtime-activation-manager.tsx`
- runtime activation now emits `relay_runtime_degraded` when account/projection gates converge but relay runtime remains degraded/offline/fatal.
- deterministic exhausted-recovery progression coverage at supervisor level:
  - `apps/pwa/app/features/relays/services/relay-runtime-supervisor.test.ts`
- no additional lifecycle owner path introduced.

## Phase 3: Reconnect and Warm-Up Convergence (Landed 2026-03-19)

Objective:
- ensure startup and post-disconnect recovery converge predictably with bounded delay.

Landed outcomes:
- relay recovery now normalizes `manual` recovery intent into cyclic disconnect reasons when runtime evidence shows zero writable relays, preventing non-cyclic escalation drift during reconnect churn:
  - `apps/pwa/app/features/relays/services/relay-recovery-policy.ts`
- recovery attempt baseline now resets when switching recovery reason families so disconnect recovery re-enters deterministic reconnect-first sequencing.
- warm-up activation now degrades early on relay-runtime evidence (`degraded`/`offline`/`fatal`/`recovering` with zero writable relays) instead of waiting for soft timeout-only gating:
  - `removed: apps/pwa/app/features/runtime/services/warm-up-supervisor.ts`
- warm-up no longer re-enters blocking `starting_transport` after a degraded soft-timeout terminal while runtime remains `activating_runtime` (prevents degraded->blocking oscillation loops).
- warm-up runtime-sync updates now short-circuit no-op state emissions to reduce startup churn and UI thrash.
- focused regression coverage added:
  - `apps/pwa/app/features/relays/services/relay-recovery-policy.test.ts`
  - `removed: apps/pwa/app/features/runtime/services/warm-up-supervisor.test.ts`

## Phase 4: Performance and Regression Guardrails (Landed 2026-03-19)

Objective:
- enforce relay/runtime performance envelopes and prevent regressions.

Landed outcomes:
- explicit reconnect/sync performance budget gate added to relay resilience owner:
  - `apps/pwa/app/features/relays/services/relay-resilience-observability.ts`
- gate evaluates target vs budget thresholds for:
  - recovery latency p95,
  - replay success ratio,
  - scoped publish blocked ratio,
  - relay flap rate per minute,
  - minimum observation/sample windows.
- runtime supervisor now emits structured runtime performance gate diagnostics:
  - event name: `relay.runtime_performance_gate`
  - owner: `apps/pwa/app/features/relays/services/relay-runtime-supervisor.ts`
- calibration-only low-sample states are classified as informational diagnostics (not warn/error alerts) to reduce startup-noise drift.
- reliability counters extended for performance gate regressions:
  - `relay_runtime_performance_warn`
  - `relay_runtime_performance_fail`
  - owner: `apps/pwa/app/shared/reliability-observability.ts`
- settings reliability panel now exposes runtime performance gate status and new counters:
  - `apps/pwa/app/settings/page.tsx`
- focused relay churn regression coverage added:
  - `apps/pwa/app/features/relays/services/relay-resilience-observability.test.ts`
- fallback recovery convergence follow-up landed:
  - relay transport activity now emits `fallbackWritableRelayCount` evidence,
  - relay recovery now suppresses cyclic `no_writable` watchdog/auto-recovery churn when fallback writable coverage exists,
  - fallback-only writable runtime remains degraded (not healthy) to preserve configured-relay truth contracts.

## Baseline Scenario Matrix (Use Before and After Each Relay Change)

1. Clean startup with healthy relays
2. Startup with mixed healthy/dead relays
3. Startup with zero writable relays (degraded expected)
4. Runtime disconnect after ready
5. Recovery after reconnect with subscription replay
6. New-device restore with relay lag

Capture for each scenario:
- `window.obscurWarmup.getSnapshot()`
- `window.obscurWindowRuntime.getSnapshot()`
- `window.obscurRelayRuntime.getSnapshot()`
- `window.obscurRelayTransportJournal.getSnapshot()`
- `window.obscurAppEvents.getDigest(300)`
- `window.obscurRelayResilience.getSnapshot()`
- `window.obscurRelayResilience.evaluateRuntimePerformanceGate()`

## Validation Gate (Per Increment)

```bash
pnpm.cmd -C apps/pwa exec tsc --noEmit
pnpm.cmd -C apps/pwa exec vitest run app/features/relays/services/relay-recovery-policy.test.ts app/features/relays/services/relay-runtime-supervisor.test.ts app/features/relays/services/relay-resilience-observability.test.ts app/features/runtime/components/runtime-activation-manager.test.tsx app/features/runtime/services/warm-up-supervisor.test.ts
pnpm.cmd docs:check
```

## Anti-Drift Merge Questions

1. Which canonical relay/runtime owner changed?
2. Which parallel mutation path was removed or isolated?
3. Which degraded/fatal reason-code path was added or changed?
4. Which diagnostics prove startup/reconnect outcome?
5. Which tests cover sender/receiver or two-device behavior?
