# 14 Module Owner Index

_Last reviewed: 2026-06-25 (AUTH-K-AUTHORITY — auth-kernel runtime owner)._

## Purpose

This file maps monorepo modules to their primary owner files so work can start with the right boundary.

For critical lifecycle invariants, still treat:
- `docs/encyclopedia/12-core-architecture-truth-map.md`

as the canonical contract.

For relay foundation execution order and phase gates:
- `docs/encyclopedia/15-relay-foundation-hardening-spec.md`

## App Surfaces

| Surface | Primary runtime entry | Notes |
| --- | --- | --- |
| `apps/pwa` | `apps/pwa/app/layout.tsx` | Main product/runtime composition surface |
| `apps/desktop` | `apps/desktop/src-tauri/src/lib.rs` | Native host boundary for relay/session/protocol |
| `apps/coordination` | `apps/coordination/src/index.ts` | Invite coordination + upload/auth utility endpoints |
| `apps/relay-gateway` | `apps/relay-gateway/src/index.ts` | Optional relay proxy in some dev/local topologies |
| `apps/website` | `apps/website/src/app/page.tsx` | Website surface |

## Core Runtime Owners (PWA)

| Domain | Canonical owner |
| --- | --- |
| **Client mutations / local read gates (R0)** | `getResolvedClientGateway()` — `packages/dweb-client-gateway`, `apps/pwa/app/features/runtime/services/client-gateway-adapter.ts`, `apps/pwa/app/features/profiles/services/resolve-client-gateway.ts`; installed by `ProfileRuntimeProvider` |
| **Auth kernel (planes A–D, runtime authority)** | `packages/dweb-auth` (port contracts) + `apps/pwa/app/features/auth-kernel/` — policy: `auth-kernel-policy.ts`; ports: `auth-kernel-ports.ts`; boot restore: `auth-kernel-boot-owner.ts`; UI surface routing: `hooks/use-auth-kernel-surface-actions.ts`; bound-profile orchestration: `auth-kernel-bound-profile-auth.ts`; legacy bridge (single scatter import): `apps/pwa/app/features/auth/services/auth-kernel-legacy-delegates.ts`. Charter: `docs/program/obscur-auth-kernel-charter-2026-06.md`. Verify: `pnpm verify:auth-kernel-contracts`. |
| Window lifecycle | `apps/pwa/app/features/runtime/services/window-runtime-supervisor.ts` |
| Startup profile binding lifecycle | `apps/pwa/app/features/profiles/components/desktop-profile-bootstrap.tsx` |
| Startup auth-shell recovery lifecycle | `apps/pwa/app/features/runtime/components/profile-bound-auth-shell.tsx` |
| Runtime activation/degraded transition | `apps/pwa/app/features/runtime/components/runtime-activation-manager.tsx` |
| Relay runtime and recovery projection | `apps/pwa/app/features/relays/services/relay-runtime-supervisor.ts` |
| Relay transport | `apps/pwa/app/features/relays/hooks/enhanced-relay-pool.ts` |
| Messaging transport ownership invariant | `apps/pwa/app/features/messaging/services/messaging-transport-runtime.ts` |
| Account sync orchestration | `apps/pwa/app/features/account-sync/hooks/use-account-sync.ts` |
| Account backup publish/restore | `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.ts` |
| **Community member snapshot policy (relay thinner guard)** | `apps/pwa/app/features/groups/services/community-member-snapshot-policy.ts` — **`resolveEnhancedSnapshotApplication`**; **`protectRemovalPubkeys`** at the **`group-provider`** boundary should match **`mergeKnownParticipantSeedPubkeys`** (directory ∪ persisted **`memberPubkeys`**). |
| **Community visible member pubkeys (UI seed helpers)** | `apps/pwa/app/features/groups/services/community-visible-members.ts` — **`resolveCommunitySeedMemberPubkeysFromDirectory`** composes **`mergeKnownParticipantSeedPubkeys`** + **`resolveCommunitySeedMemberPubkeys`** for **`group-home-page-client`** and **`group-management-dialog`** sealed-community seeds; **`resolveAuthorEvidencePubkeysFromCommunityMessages`** dedupes timeline pubkeys for **`resolveVisibleCommunityMemberPubkeys`**, **`group-provider`** hydrate, and **`collectGroupMessageAuthorPubkeys`** (`community-message-author-evidence.ts`); **`resolveActiveCommunityMemberPubkeysFromConversation`** batches author + active roster for those two UIs. React stabilization: **`use-stable-community-participant-pubkeys.ts`**. |
| Group membership durability | `apps/pwa/app/features/groups/providers/group-provider.tsx` — known-participant **localStorage** upserts only when built directory widens beyond stored ∪ `group.memberPubkeys` ∪ local (no parallel **`createdGroups`** path); relay roster snapshots use **`resolveEnhancedSnapshotApplication`** with aligned **`protectRemovalPubkeys`**. |
| **DM hydrate authority + legacy gates (interim choke)** | `apps/pwa/app/features/messaging/services/dm-read-authority-contract.ts` — `resolveHydrationDmReadMessages` / `resolveLegacyHydrationAuthority`; not the full thread read-model. |
| **DM hydrate indexed window I/O** | `apps/pwa/app/features/messaging/services/dm-conversation-hydrate-indexed-scan.ts` — `loadConversationWindow`, `loadConversationWindowAcrossAliases`, `scanDisplayableHistoryWindow`, `loadInitialDmHydrationIndexedWindow`. |
| **DM message retention + identity dedupe** | `apps/pwa/app/features/messaging/services/dm-conversation-message-retention-dedupe.ts` — `normalizeLocalRetentionDays`, `filterMessagesByLocalRetention`, `dedupeMessagesByIdentity` (hydrate scan + hook realtime / persisted paths). |
| **DM hydrate indexed scan row→displayable mapping** | `apps/pwa/app/features/messaging/services/dm-conversation-hydrate-indexed-map-rows.ts` — `mapIndexedConversationRowsForDisplayableScan` (`initial_hydrate` vs `load_earlier`); hook supplies **`normalizeDmConversationMessageRow`** + **`isDisplayableDmConversationMessage`**; uses **`dm-conversation-message-retention-dedupe.ts`**. |
| **DM projection evidence messages (interim)** | `apps/pwa/app/features/messaging/services/dm-conversation-projection-evidence-messages.ts` — `buildProjectionEvidenceMessagesForConversation` (selector + suppressed + retention; hook supplies **`normalizeDmConversationMessageRow`**). |
| **DM row → Message normalize (interim)** | `apps/pwa/app/features/messaging/services/dm-conversation-normalize-message.ts` — **`normalizeDmConversationMessageRow`** (persisted / bus / IndexedDB / projection evidence paths call from **`use-conversation-messages`** + **`applyBufferedEvents`**). |
| **DM displayable line predicate (interim)** | `apps/pwa/app/features/messaging/services/dm-conversation-displayable-message.ts` — **`isVoiceCallSignalPayload`**, **`isDisplayableDmConversationMessage`** (hook hydrate / merge / persisted fallback; **`assembleDmHydrateThreadReadModel`** group-scope filter). |
| **DM projection ↔ live merge (interim)** | `apps/pwa/app/features/messaging/services/dm-conversation-projection-live-merge.ts` — `mergeProjectionFirstWithLiveOverlayForDisplay`, `areMessageListsEquivalentById` (hook projection merge **`useEffect`**). |
| **DM hydrate sibling id-split diagnostics** | `apps/pwa/app/features/messaging/services/dm-conversation-hydrate-sibling-diagnostics.ts` — `runDmHydrateSiblingIdSplitDiagnosticsIfNeeded` (IndexedDB window per sibling id + `messaging.conversation_hydration_id_split_detected`). |
| **DM conversation sibling id set (pure)** | `apps/pwa/app/features/messaging/utils/dm-conversation-sibling-ids.ts` — `inferPeerFromConversationId`, `buildDmSiblingConversationIds` (used by hook alias union + sibling diagnostics). |
| **DM hydrate thread assembly (pure, post-IDB scan)** | `apps/pwa/app/features/messaging/services/dm-conversation-hydrate-read-model.ts` — **`assembleDmHydrateThreadReadModel`** (authority + caps + group scope + overlay merge + log contexts). |
| **DM hydrate pipeline (orchestration, pre–full R1 exit)** | `apps/pwa/app/features/messaging/services/dm-conversation-hydrate-pipeline.ts` — **`runDmConversationHydrateReadModelPipeline`** (tombstone prep → **`loadInitialDmHydrationIndexedWindow`** → persisted **`chat-state-store`** fallback → **`assembleDmHydrateThreadReadModel`** → **`runDmHydrateSiblingIdSplitDiagnosticsIfNeeded`**) + **`logDmHydrateReadModelTelemetry`**; **`use-conversation-messages`** **`hydrateHistory`** delegates here. |
| **DM / thread message list (interim — multiple hydrators)** | **Hook assembler until R1 exit:** `apps/pwa/app/features/messaging/hooks/use-conversation-messages.ts` (refs, realtime **`applyBufferedEvents`**, projection merge **`useEffect`**, **`hydrateHistory`** → pipeline) + **`conversation-message-materialization.ts`** merges + projection selectors/reducer + `chat-state-store` + tombstones — converge per **`docs/program/v1.5.0-architecture-refactor-queue.md`**; do not add a third ad-hoc filter path. |

## PWA Feature Modules

| Feature root | Primary owner/entry files |
| --- | --- |
| `auth` | **Runtime authority:** `apps/pwa/app/features/auth-kernel/` (`auth-kernel-boot-owner.ts`, `use-auth-kernel-surface-actions.ts`). **Legacy scatter (delegate only):** `auth-gateway.tsx`, `use-identity.ts` via `auth-kernel-legacy-delegates.ts`. **Auth screen / title-bar:** kernel ports via `useAuthKernelSurfaceActions`. |
| `auth-kernel` | `apps/pwa/app/features/auth-kernel/auth-kernel-policy.ts`, `auth-kernel-ports.ts`, `auth-kernel-boot-owner.ts`, `auth-kernel-bound-profile-auth.ts`, `hooks/use-auth-kernel-surface-actions.ts` |
| `runtime` | `apps/pwa/app/features/runtime/services/window-runtime-supervisor.ts`, `apps/pwa/app/features/runtime/components/unlocked-app-runtime-shell.tsx` |
| `relays` | `apps/pwa/app/features/relays/providers/relay-provider.tsx`, `apps/pwa/app/features/relays/services/relay-recovery-policy.ts` |
| `account-sync` | `apps/pwa/app/features/account-sync/hooks/use-account-sync.ts`, `apps/pwa/app/features/account-sync/services/account-rehydrate-service.ts` |
| `messaging` | `apps/pwa/app/features/messaging/providers/messaging-provider.tsx`, `apps/pwa/app/features/messaging/controllers/v2/dm-controller.ts` (v2 transport path); legacy `enhanced-dm-controller` exists — prefer v2 for new work |
| `groups` | `apps/pwa/app/features/groups/providers/group-provider.tsx`, `apps/pwa/app/features/groups/services/community-membership-recovery.ts` |
| `network` | `apps/pwa/app/features/network/providers/network-provider.tsx` |
| `search` | `apps/pwa/app/features/search/hooks/use-global-search.ts`, `apps/pwa/app/features/search/services/discovery-engine.ts` |
| `invites` | `apps/pwa/app/features/invites/utils/invite-manager.ts`, `apps/pwa/app/features/invites/hooks/use-invites.ts` |
| `main-shell` | `apps/pwa/app/features/main-shell/main-shell.tsx`, `apps/pwa/app/features/main-shell/hooks/use-main-shell-state.ts` |
| `profiles`/`profile` | `apps/pwa/app/features/profiles/services/profile-scope.ts`, `apps/pwa/app/features/profile/hooks/use-profile.ts` |
| `settings` | `apps/pwa/app/features/settings/services/privacy-settings-service.ts` |
| `vault` | `apps/pwa/app/features/vault/services/local-media-store.ts` |
| `query` | `apps/pwa/app/features/query/providers/tanstack-query-runtime-provider.tsx` |
| `desktop` | `apps/pwa/app/features/desktop/hooks/use-tauri.ts`, `apps/pwa/app/features/desktop/utils/tauri-api.ts` |
| `native` | `apps/pwa/app/features/native/lib/native-error-store.ts` |
| `notifications` | `apps/pwa/app/features/notifications/hooks/use-notification-preference.ts` |
| `onboarding` | `apps/pwa/app/features/onboarding/utils/fetch-bootstrap-config.ts` |
| `navigation` | `apps/pwa/app/features/navigation/public-routes.ts` |
| `social-graph` | `apps/pwa/app/features/social-graph/services/social-graph-service.ts` |
| `crypto` | `apps/pwa/app/features/crypto/crypto-service.ts` |
| `dev-tools` | `apps/pwa/app/features/dev-tools/hooks/use-dev-mode.ts` |

## Rust/Native Owners

| Domain | Owner file |
| --- | --- |
| Native relay transport and ACK handling | `apps/desktop/src-tauri/src/relay.rs` |
| Native network runtime (Tor/proxy path) | `apps/desktop/src-tauri/src/net.rs` |
| Native protocol publish quorum command bridge | `apps/desktop/src-tauri/src/protocol.rs` |
| Native auth boot snapshot (Plane D Rust owner) | `apps/desktop/src-tauri/src/commands/auth_boot.rs`, `apps/desktop/src-tauri/src/commands/session.rs` |
| Shared Rust protocol runtime | `packages/libobscur/src/protocol/mod.rs` |
| Shared protocol data contracts | `packages/libobscur/src/protocol/types.rs` |

## Shared TS Package Owners

| Package | Anchor |
| --- | --- |
| `packages/dweb-core` | `packages/dweb-core/src/security-foundation-contracts.ts` |
| `packages/dweb-auth` | `packages/dweb-auth/src/ports/` (identity root, registration policy, device unlock, runtime session, auth assistant) |
| `packages/dweb-crypto` | `packages/dweb-crypto/src/derive-public-key-hex.ts` |
| `packages/dweb-nostr` | `packages/dweb-nostr/src/create-nostr-event.ts` |
| `packages/dweb-storage` | `packages/dweb-storage/src/indexed-db.ts` |
| `packages/ui-kit` | `packages/ui-kit/src/components` |

## Usage Rules

1. Start changes from the owner row for the failing behavior.
2. If more than one owner appears to mutate the same lifecycle, isolate non-canonical paths first.
3. Add diagnostics and focused tests at owner boundaries before broad refactors.
