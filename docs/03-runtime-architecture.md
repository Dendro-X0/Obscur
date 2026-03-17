# 03 Runtime Architecture

_Last reviewed: 2026-03-17 (baseline commit 1f075aa)._

## Canonical Ownership Model

Obscur runtime correctness depends on explicit owners:

1. Window runtime owner
: `apps/pwa/app/features/runtime/services/window-runtime-supervisor.ts`

2. Account sync owner
: `apps/pwa/app/features/account-sync/hooks/use-account-sync.ts`

3. Relay transport owner
: `apps/pwa/app/features/relays/services/relay-runtime-supervisor.ts`

4. Messaging transport owner
: `apps/pwa/app/features/messaging/services/messaging-transport-runtime.ts`

No feature should create a parallel owner for these lifecycles.

## Activation Sequence (PWA)

1. Auth shell resolves identity/profile binding.
: `apps/pwa/app/features/auth/hooks/use-identity.ts`

2. Runtime supervisor establishes window scope and capabilities.
: `apps/pwa/app/features/runtime/runtime-capabilities.ts`

3. Profile/account scope is resolved before account-scoped storage access.
: `apps/pwa/app/features/profiles/services/profile-scope.ts`

4. Relay and messaging owners mount only when identity is available.

5. Account sync and projection hydrate deterministic local state.

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

## Failure Patterns to Avoid

- Duplicated subscription/sync owners.
- Implicit "current active profile" fallbacks in shared services.
- Optimistic success states without relay/recipient evidence.
