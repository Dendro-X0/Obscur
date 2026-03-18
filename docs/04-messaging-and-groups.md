# 04 Feature Modules

_Last reviewed: 2026-03-17 (baseline commit 1f075aa)._

This document is the short module map for day-to-day implementation and triage.

## Auth and Identity

- Gateway/UI: `apps/pwa/app/features/auth/components/auth-gateway.tsx`
- Session API bridge: `apps/pwa/app/features/auth/services/session-api.ts`
- Identity storage and binding:
  - `apps/pwa/app/features/auth/utils/auth-storage-keys.ts`
  - `apps/pwa/app/features/auth/utils/identity-profile-binding.ts`

## Runtime and Profile Scope

- Runtime supervisor: `apps/pwa/app/features/runtime/services/window-runtime-supervisor.ts`
- Runtime capability detection: `apps/pwa/app/features/runtime/runtime-capabilities.ts`
- Native host/event adapters:
  - `apps/pwa/app/features/runtime/native-host-adapter.ts`
  - `apps/pwa/app/features/runtime/native-event-adapter.ts`

## Account Sync and Projection

- Sync hook: `apps/pwa/app/features/account-sync/hooks/use-account-sync.ts`
- Projection runtime: `apps/pwa/app/features/account-sync/services/account-projection-runtime.ts`
- Encrypted backup path: `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.ts`
- Event ingest bridge: `apps/pwa/app/features/account-sync/services/account-event-ingest-bridge.ts`

## Relays and Transport

- Relay pool/runtime: `apps/pwa/app/features/relays/hooks/enhanced-relay-pool.ts`
- Recovery policy: `apps/pwa/app/features/relays/services/relay-recovery-policy.ts`
- Resilience diagnostics:
  - `apps/pwa/app/features/relays/services/relay-resilience-observability.ts`
  - `apps/pwa/app/features/relays/services/relay-transport-journal.ts`
- NIP-65 helpers: `apps/pwa/app/features/relays/utils/nip65-service.ts`

## Messaging

- Controller: `apps/pwa/app/features/messaging/controllers/enhanced-dm-controller.ts`
- Outgoing orchestration/publish:
  - `apps/pwa/app/features/messaging/controllers/outgoing-dm-orchestrator.ts`
  - `apps/pwa/app/features/messaging/controllers/outgoing-dm-publisher.ts`
- Incoming handler: `apps/pwa/app/features/messaging/controllers/incoming-dm-event-handler.ts`
- Delivery/request evidence services:
  - `apps/pwa/app/features/messaging/services/delivery-diagnostics-store.ts`
  - `apps/pwa/app/features/messaging/services/request-flow-evidence-store.ts`
  - `apps/pwa/app/features/messaging/services/request-status-projection.ts`

## Network and Communities (Groups)

- Network provider (identity + trust + requests + blocklist):
  - `apps/pwa/app/features/network/providers/network-provider.tsx`
- Group lifecycle/persistence owner:
  - `apps/pwa/app/features/groups/providers/group-provider.tsx`
- Sealed community runtime owner:
  - `apps/pwa/app/features/groups/hooks/use-sealed-community.ts`
- Membership truth reducer:
  - `apps/pwa/app/features/groups/services/community-ledger-reducer.ts`
- Event constructor/signing service:
  - `apps/pwa/app/features/groups/services/group-service.ts`

Known active gap (v0.9.1 planning target):
- Several governance handlers in `use-sealed-community.ts` are still placeholders (`noop`) and should be completed before claiming mature community operations.

## Community Governance Contract (Decentralized)

- There are no administrators in communities. Every participant is a member in the same governance domain.
- Member-level local safety control is supported: each user can mute any other member in their own client.
- Forced member removal is vote-driven: a member is removed only after quorum is reached.
- Community avatar changes are vote-driven and should not be treated as single-user authority actions.
- Durable governance state should come from signed community events reduced by `community-ledger-reducer.ts`, not from local optimistic UI state.

## Community Technical Flow (Condensed)

1. Community creation and metadata entry are initiated in UI surfaces (Network/Group management).
2. `group-service.ts` constructs and signs community events (create, invite/key distribution, governance actions).
3. Events are published through relay transport and ingested by sealed community runtime (`use-sealed-community.ts`).
4. `community-ledger-reducer.ts` computes membership and governance truth from ingestable event history.
5. Group provider persistence (`group-provider.tsx`) stores local projections for fast restore, while reducer truth remains canonical.

## Community Navigation and Unread Guardrails (Phase A)

- Group route resolution is canonicalized via:
  - `apps/pwa/app/features/groups/utils/group-route-token.ts`
  - `apps/pwa/app/features/messaging/utils/conversation-target.ts`
- Explicit group tokens (`community:*`, `group:*`, encoded canonical ids) resolve group-only; unresolved group tokens do not fallback to DM.
- Projection unread merging is scoped to avoid DM unread reassert churn while the active conversation is a group:
  - `apps/pwa/app/features/messaging/providers/projection-unread.ts`
- Sidebar chat surfaces should always expose both categories (`Direct Messages` and `Communities`) so group navigation does not depend on an additional mode toggle:
  - `apps/pwa/app/features/messaging/components/sidebar.tsx`

## Search and Discovery

- Search orchestration: `apps/pwa/app/features/search/hooks/use-global-search.ts`
- Discovery engine/cache:
  - `apps/pwa/app/features/search/services/discovery-engine.ts`
  - `apps/pwa/app/features/search/services/discovery-cache.ts`
- Friend code logic: `apps/pwa/app/features/search/services/friend-code-v2.ts`

## Settings, Vault, and UI Foundations

- Privacy/reliability flags:
  - `apps/pwa/app/features/settings/services/privacy-settings-service.ts`
  - `apps/pwa/app/features/settings/services/v090-rollout-policy.ts`
- Local vault/media: `apps/pwa/app/features/vault/services/local-media-store.ts`
- Shared UI components: `packages/ui-kit/src/components`

## Shared Contracts and Native Core

- Core contracts: `packages/dweb-core/src/security-foundation-contracts.ts`
- Nostr primitives: `packages/dweb-nostr/src`
- Crypto primitives: `packages/dweb-crypto/src`
- Rust protocol core: `packages/libobscur/src/protocol`
