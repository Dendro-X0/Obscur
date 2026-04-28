# Session and Startup Ownership Extraction Contract

_Last reviewed: 2026-04-22 (baseline commit a3f16b10)._

Status: active rewrite workstream

## Purpose

This workstream defines how to extract session and startup ownership from the
current black-box runtime into one explicit, durable owner path.

It exists because startup currently recomposes truth from multiple overlapping
inputs:

1. stored identity,
2. native session state,
3. remember-me persistence,
4. profile binding,
5. runtime auth phases.

The goal is not to remove features.

The goal is to make startup deterministic and diagnosable without changing the
product promise.

## Current Owner Set

Current primary owners and participating modules:

1. `apps/pwa/app/features/auth/hooks/use-identity.ts`
2. `apps/pwa/app/features/auth/services/session-api.ts`
3. `apps/pwa/app/features/auth/components/auth-gateway.tsx`
4. `apps/pwa/app/features/profiles/components/desktop-profile-bootstrap.tsx`
5. `apps/pwa/app/features/runtime/components/profile-bound-auth-shell.tsx`
6. `apps/pwa/app/features/runtime/services/window-runtime-supervisor.ts`

Supporting modules:

1. `apps/pwa/app/features/auth/utils/auth-storage-keys.ts`
2. `apps/pwa/app/features/auth/utils/identity-profile-binding.ts`
3. `apps/pwa/app/features/profiles/services/profile-scope.ts`
4. `apps/desktop/src-tauri/src/session.rs`
5. `apps/desktop/src-tauri/src/lib.rs`

## Current Failure Classes

This workstream is responsible for eliminating:

1. relaunches that forget valid remembered sessions,
2. native session mismatch drift,
3. profile-binding ambiguity during startup,
4. lock/unlock decisions that depend on multiple partial truths,
5. startup regressions caused by auth logic leaking into UI adapters.

## Future Owner Set

The future architecture should converge on one session/startup owner stack:

1. `session bootstrap contract`
2. `session restore coordinator`
3. `profile binding coordinator`
4. `startup auth decision state machine`
5. `UI adapter for startup status only`

Those do not need to map one-to-one to current files, but the ownership should
be explicit and singular.

## Required Future Contracts

This workstream should ultimately produce:

1. `session-bootstrap-contracts`
2. `session-restore-contracts`
3. `profile-binding-contracts`
4. `startup-auth-state-contracts`

Minimum contract fields should cover:

1. active profile id,
2. stored public key,
3. native session public key,
4. remember-me state,
5. mismatch reason,
6. startup decision,
7. degraded state,
8. recovery actions available.

## Extraction Sequence

### Phase 1. Contract Lock

Define explicit startup/session state shapes for:

1. `no_identity`,
2. `stored_locked`,
3. `native_restorable`,
4. `restored`,
5. `mismatch`,
6. `fatal_storage_error`.

Outputs:

1. contract doc,
2. typed contract module,
3. diagnostics key map.

### Phase 2. Restore Scan Consolidation

Move remember-me, native session lookup, and profile-scope checks into one
coordinator path.

Outputs:

1. session scan reducer or coordinator,
2. one remember-me candidate lookup contract,
3. one native restore path,
4. one mismatch fallback path.

### Phase 3. UI Adapter Simplification

Reduce `AuthGateway`, startup shell, and bootstrap components to UI adapters
that consume the session/startup owner result instead of recomputing startup
truth locally.

Outputs:

1. thin UI adapters,
2. no duplicate startup truth branching.

### Phase 4. Native Boundary Clarification

Define the native session host as capability provider, not policy owner.

Outputs:

1. typed native session boundary contract,
2. explicit mismatch and unavailable semantics,
3. replay-safe session diagnostics.

## Compatibility Retirement Sequence

Retire in this order:

1. duplicate remember-me scan logic,
2. profile-local fallback auth branching,
3. any UI-owned startup truth,
4. silent native mismatch fallback.

Do not retire compatibility until:

1. relaunch continuity replay is stable,
2. mismatch states are visible and recoverable,
3. profile switch behavior is deterministic.

## Test Ladder

Minimum test set:

1. unit tests for remember-me candidate resolution,
2. unit tests for session bootstrap decisions,
3. integration tests for profile rebinding,
4. integration tests for native mismatch handling,
5. desktop relaunch/manual replay.

Current tests to preserve and extend:

1. `apps/pwa/app/features/auth/services/session-api.test.ts`
2. `apps/pwa/app/features/auth/hooks/use-identity.test.ts`
3. `apps/pwa/app/features/auth/components/auth-gateway.test.tsx`

## Minimum Runtime Acceptance Packet

This workstream is only complete when runtime replay proves:

1. remember-me survives desktop relaunch,
2. profile-bound session restore does not prompt unnecessarily,
3. native mismatch never shows stale authenticated state,
4. switching profile/account does not bleed old session truth,
5. startup failure degrades into actionable locked or mismatch state.

Primary evidence probes:

1. `window.obscurAppEvents.findByName("auth.auto_unlock_scan", 30)`
2. `window.obscurWindowRuntime?.getSnapshot?.()`
3. any `auth` or `runtime` mismatch diagnostics emitted during replay.

## Definition Of Done

This workstream is done only when:

1. one startup owner path exists,
2. session restore and remember-me use one contract,
3. UI no longer decides startup truth,
4. relaunch continuity is runtime-verified,
5. future contributors can continue from docs alone.
