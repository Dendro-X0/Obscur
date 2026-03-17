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
