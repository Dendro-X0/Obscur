# 03 Runtime Architecture

_Last reviewed: 2026-03-29 (baseline commit cad5779e)._

Cross-reference:
- Core contract and anti-drift checklist live in `docs/12-core-architecture-truth-map.md`.
- Startup/relay failure classes and capture order live in `docs/13-relay-and-startup-failure-atlas.md`.

## Canonical Ownership Model

Obscur runtime correctness depends on explicit owners:

1. Startup composition owner
: `apps/pwa/app/components/providers.tsx`

2. Window runtime owner
: `apps/pwa/app/features/runtime/services/window-runtime-supervisor.ts`

3. Account sync owner
: `apps/pwa/app/features/account-sync/hooks/use-account-sync.ts`

4. Relay transport owner
: `apps/pwa/app/features/relays/services/relay-runtime-supervisor.ts`

5. Messaging transport owner
: `apps/pwa/app/features/messaging/services/messaging-transport-runtime.ts`

No feature should create a parallel owner for these lifecycles.

Runtime composition roots:
- `apps/pwa/app/components/providers.tsx`
- `apps/pwa/app/features/runtime/components/unlocked-app-runtime-shell.tsx`

## Activation Sequence (PWA)

1. Auth shell resolves identity/profile binding.
: `apps/pwa/app/features/auth/hooks/use-identity.ts`

2. Runtime supervisor establishes window scope and capabilities.
: `apps/pwa/app/features/runtime/runtime-capabilities.ts`

3. Profile/account scope is resolved before account-scoped storage access.
: `apps/pwa/app/features/profiles/services/profile-scope.ts`

4. Relay and messaging owners mount only when identity is available.

5. Account sync and projection hydrate deterministic local state.

## Degraded/Fatal Emission Truth

Window runtime degraded reasons are defined in:
- `apps/pwa/app/features/runtime/services/window-runtime-contracts.ts`

Current runtime activation degraded emit paths are concentrated in:
- `apps/pwa/app/features/runtime/components/runtime-activation-manager.tsx`
- reconnect/sync performance gate diagnostics are concentrated in:
  - `apps/pwa/app/features/relays/services/relay-runtime-supervisor.ts`
  - `apps/pwa/app/features/relays/services/relay-resilience-observability.ts`

Observed behavior in code:
- `activation_timeout` is emitted by fail-open timer during activation.
- `account_sync_degraded` is emitted when account sync/projection fails drift or readiness gates.
- `relay_runtime_degraded` is emitted when account/projection gates converge but relay runtime remains degraded/offline/fatal.

Implication:
- runtime `ready` no longer masks relay-runtime degradation during activation convergence.
- relay runtime now has an explicit performance gate (`pass` / `warn` / `fail`) for reconnect/sync budgets rather than relying on ad-hoc metric reading.

## Native/Desktop Boundary

- JS invokes typed Tauri commands through adapters in `apps/pwa/app/features/runtime`.
- Tauri commands are implemented in Rust under `apps/desktop/src-tauri/src`.
- Protocol-related native behavior lives in `packages/libobscur/src/protocol`.

Phase 2 owner contract (publish/storage):
- `protocol_publish_with_quorum` uses native relay ACK evidence (`OK`) and Rust quorum evaluation.
- When `protocolCoreEnabled && hasNativeRuntime()` is true, messaging publish orchestration uses protocol owner path.
- Pure web runtime stays deterministic:
  - protocol command path remains unsupported,
  - legacy relay/storage owner path remains explicit.

Phase 3 owner contract (mobile native adapters):
- Android/iOS adapter files under `apps/desktop/src-tauri/gen` are thin shells only.
- Rust (`packages/libobscur/src/ffi.rs`) owns:
  - key-scoped push decrypt (`decrypt_push_payload_for_key`),
  - key-scoped background sync (`background_sync_for_key`),
  - secure-key load/store contracts.
- Mobile runtime fail-closed rule:
  - no secure key => locked path,
  - no local secret fallback in adapter files.

## Required Runtime Invariants

- Signed-out windows do not run heavy sync/transport flows.
- Storage keys are scope-derived at access time, not module-load time.
- Incoming transport routes include diagnostics (subscription owner, recipient match, decrypt outcome, routing outcome).
- Sync/checkpoint progress is evidence-backed; timeout-only advancement is disallowed.
- Startup must fail open into explicit runtime phase truth (`ready` / `degraded`) without a second overlay owner.
- Relay runtime and window runtime are separate truth surfaces; do not collapse them into one inferred UI state.
- Duplicate active-session detection for the same identity is fail-closed:
  - local session is locked on conflict signal instead of continuing in fail-open telemetry mode.
  - owner path: `apps/pwa/app/features/network/providers/network-provider.tsx`

## Failure Patterns to Avoid

- Duplicated subscription/sync owners.
- Implicit "current active profile" fallbacks in shared services.
- Optimistic success states without relay/recipient evidence.
- Declaring relay recovery healthy from banner state alone without relay runtime evidence.
