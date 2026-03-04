# Feature Change Maps (Deep References)

_Last reviewed: 2026-03-03 (baseline commit 7f57b32)._


This guide maps product features to concrete code entrypoints so contributors can modify behavior without broad codebase search.

## 1) Chat Core (DM)

### Primary entrypoints

- `apps/pwa/app/features/main-shell/main-shell.tsx`
- `apps/pwa/app/features/main-shell/hooks/use-chat-actions.ts`
- `apps/pwa/app/features/main-shell/hooks/use-chat-view-props.ts`
- `apps/pwa/app/features/messaging/controllers/enhanced-dm-controller.ts`
- `apps/pwa/app/features/messaging/hooks/use-conversation-messages.ts`
- `apps/pwa/app/features/messaging/services/message-persistence-service.ts`
- `apps/pwa/app/features/messaging/components/message-list.tsx`
- `apps/pwa/app/features/messaging/components/composer.tsx`

### If you need to change...

- Send flow/queue/publish behavior:
  - `controllers/outgoing-dm-orchestrator.ts`
  - `controllers/outgoing-dm-send-preparer.ts`
  - `controllers/outgoing-dm-publisher.ts`
  - `controllers/relay-ok-message-handler.ts`
- Incoming event normalization:
  - `controllers/incoming-dm-event-handler.ts`
- Message derivation/parsing helpers:
  - `utils/logic.ts`
  - `utils/persistence.ts`

### Tests to run

- `app/features/messaging/hooks/use-conversation-messages.test.ts`
- `app/features/messaging/hooks/use-conversation-messages.integration.test.ts`
- `app/features/messaging/services/message-persistence-service.test.ts`
- `app/features/messaging/controllers/incoming-dm-event-handler.test.ts`

## 2) Group/Community Messaging

### Primary entrypoints

- `apps/pwa/app/features/groups/hooks/use-sealed-community.ts`
- `apps/pwa/app/features/groups/services/group-service.ts`
- `apps/pwa/app/features/groups/services/community-ledger-reducer.ts`
- `apps/pwa/app/features/groups/providers/group-provider.tsx`
- `apps/pwa/app/features/groups/components/group-management-dialog.tsx`
- `apps/pwa/app/features/groups/components/community-invite-card.tsx`
- `apps/pwa/app/features/groups/components/community-invite-response-card.tsx`

### If you need to change...

- Membership lifecycle/consensus moderation:
  - `services/community-ledger-reducer.ts`
  - `hooks/use-sealed-community.ts`
- Conversation identity/ID behavior:
  - `utils/group-conversation-id.ts`
  - `utils/community-identity.ts`

### Tests to run

- `app/features/groups/hooks/use-sealed-community.merge.test.ts`
- `app/features/groups/hooks/use-sealed-community.integration.test.ts`
- `app/features/groups/hooks/use-sealed-community.security.test.ts`
- `app/features/groups/services/community-ledger-reducer.test.ts`

## 3) Media Upload, Playback, and Vault

### Primary entrypoints

- `apps/pwa/app/features/messaging/lib/upload-service.ts`
- `apps/pwa/app/features/messaging/lib/nip96-upload-service.ts`
- `apps/pwa/app/features/messaging/lib/media-upload-policy.ts`
- `apps/pwa/app/features/messaging/lib/media-processor.ts`
- `apps/pwa/app/features/messaging/components/audio-player.tsx`
- `apps/pwa/app/features/messaging/components/video-player.tsx`
- `apps/pwa/app/features/vault/services/local-media-store.ts`
- `apps/pwa/app/features/vault/hooks/use-vault-media.ts`

### If you need to change...

- Provider strategy/fallback:
  - `lib/storage-providers.ts`
  - `lib/upload-service.ts`
- Attachment detection/layout in chat rows:
  - `components/message-list.tsx`
  - `utils/logic.ts`
- Local cache/index behavior:
  - `features/vault/services/local-media-store.ts`

## 4) Settings, Flags, and User Preferences

### Primary entrypoints

- `apps/pwa/app/settings/page.tsx`
- `apps/pwa/app/features/settings/services/privacy-settings-service.ts`
- `apps/pwa/app/features/settings/hooks/use-auto-lock.ts`
- `apps/pwa/app/features/settings/hooks/use-theme.ts`

### Performance flag (`chatPerformanceV2`) consumers

- `features/messaging/hooks/use-conversation-messages.ts`
- `features/messaging/components/message-list.tsx`
- `features/messaging/services/message-persistence-service.ts`
- `features/groups/hooks/use-sealed-community.ts`

## 5) Auth and Identity

### Primary entrypoints

- `apps/pwa/app/features/auth/hooks/use-identity.ts`
- `apps/pwa/app/features/auth/components/auth-screen.tsx`
- `apps/pwa/app/features/auth/components/auth-gateway.tsx`
- `apps/pwa/app/features/auth/services/pin-lock-service.ts`
- `apps/pwa/app/features/auth/services/session-api.ts`

### Persistence utilities

- `features/auth/utils/open-identity-db.ts`
- `features/auth/utils/get-stored-identity.ts`
- `features/auth/utils/save-stored-identity.ts`
- `features/auth/utils/clear-stored-identity.ts`

## 6) Relays and Network Trust

### Relay system

- `apps/pwa/app/features/relays/providers/relay-provider.tsx`
- `apps/pwa/app/features/relays/hooks/use-relay-pool.ts`
- `apps/pwa/app/features/relays/hooks/enhanced-relay-pool.ts`
- `apps/pwa/app/features/relays/hooks/subscription-manager.ts`
- `apps/pwa/app/features/relays/hooks/relay-health-monitor.ts`

### Trust/block/request model

- `apps/pwa/app/features/network/providers/network-provider.tsx`
- `apps/pwa/app/features/network/hooks/use-peer-trust.ts`
- `apps/pwa/app/features/network/hooks/use-blocklist.ts`
- `apps/pwa/app/features/network/services/connection-request-service.ts`

## 7) Invite/Connection System

### Primary entrypoints

- `apps/pwa/app/features/invites/utils/invite-manager.ts`
- `apps/pwa/app/features/invites/utils/connection-store.ts`
- `apps/pwa/app/features/invites/utils/deep-link-handler.ts`
- `apps/pwa/app/features/invites/utils/url-scheme-handler.ts`
- `apps/pwa/app/features/invites/utils/qr-generator.ts`
- `apps/pwa/app/features/invites/components/qr-scanner.tsx`

### Tests to run

- `app/features/invites/utils/__tests__/*.test.ts`

## 8) Desktop Bridge and Native Integration

### PWA-side bridge

- `apps/pwa/app/features/desktop/utils/tauri-api.ts`
- `apps/pwa/app/features/desktop/utils/offline-manager.ts`
- `apps/pwa/app/features/desktop/utils/relay-persistence.ts`

### Native host

- `apps/desktop/src-tauri/tauri.conf.json`
- `apps/desktop/src-tauri/Cargo.toml`
- `apps/desktop/package.json`

## 9) Performance Tooling and Load Simulation

### Monitoring

- `apps/pwa/app/features/messaging/lib/performance-monitor.ts`

### Dev-only synthetic load generator

- `apps/pwa/app/features/messaging/dev/chat-performance-dev-tools.ts`
- Installed from: `apps/pwa/app/features/main-shell/main-shell.tsx`

Console usage in development:

```js
await window.obscurChatPerf.clearConversationMessages("demo:perf");
await window.obscurChatPerf.seedConversationMessages({ conversationId: "demo:perf", count: 10000 });
window.obscurChatPerf.emitBurstEvents({ conversationId: "demo:perf", count: 200 });
```

## 10) Shared Packages (Cross-cutting)

- `packages/dweb-storage/src/indexed-db.ts` (IndexedDB service used by PWA)
- `packages/dweb-crypto/*` (crypto primitives)
- `packages/dweb-nostr/*` (Nostr types/protocol helpers)
- `packages/ui-kit/*` (shared UI components)
- `packages/libobscur/*` (native core/library)

## Fast Triage Matrix

- UI render lag in chat: `components/message-list.tsx`, `hooks/use-conversation-messages.ts`, `lib/performance-monitor.ts`
- Missing/duplicated messages: `services/message-bus.ts`, `hooks/use-conversation-messages.ts`, `services/message-persistence-service.ts`
- Group realtime mismatch: `groups/hooks/use-sealed-community.ts`, relay provider hooks
- Upload failures: `lib/nip96-upload-service.ts`, `lib/upload-service.ts`, `lib/media-upload-policy.ts`
- Settings flag not propagating: `settings/services/privacy-settings-service.ts` + consumers listed above
