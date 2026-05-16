# 12 Core Architecture Truth Map

_Last reviewed: 2026-05-14 (baseline commit 0406143c)._

**Note:** v1.5.0 refactor queue (R1/R2 multiplicity) — see `docs/program/v1.5.0-architecture-refactor-queue.md`.

This document is the architecture contract for current development and release work.

Companion docs:
1. `docs/encyclopedia/13-relay-and-startup-failure-atlas.md` (failure triage map)
2. `docs/encyclopedia/14-module-owner-index.md` (owner/module lookup)
3. `docs/history/version-context.md` (history and consolidation rules)

## Canonical Owner Table

0. **Client-side mutation / local read gate (R0)**
: `getResolvedClientGateway()` — installed by `apps/pwa/app/features/profiles/providers/profile-runtime-provider.tsx` via `apps/pwa/app/features/runtime/services/client-gateway-adapter.ts`
: Contracts: `packages/dweb-client-gateway`
: **Rule:** Web / desktop / mobile product code does not branch on `isTauri` or call tombstone/visibility owners directly; extend gateway ports instead.

1. Window lifecycle owner
: `apps/pwa/app/features/runtime/services/window-runtime-supervisor.ts`
2. Startup profile-binding owner
: `apps/pwa/app/features/profiles/components/desktop-profile-bootstrap.tsx`
3. Startup auth-shell recovery owner
: `apps/pwa/app/features/runtime/components/profile-bound-auth-shell.tsx`
4. Runtime activation/degradation owner
: `apps/pwa/app/features/runtime/components/runtime-activation-manager.tsx`
5. Relay recovery owner
: `apps/pwa/app/features/relays/services/relay-runtime-supervisor.ts`
6. Relay transport owner
: `apps/pwa/app/features/relays/hooks/enhanced-relay-pool.ts`
7. Account backup publish/restore owner
: `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.ts`
8. Account sync orchestration owner
: `apps/pwa/app/features/account-sync/hooks/use-account-sync.ts`
9. Chat state persistence owner
: `apps/pwa/app/features/messaging/services/chat-state-store.ts`
10. Group/community membership durability owner
: `apps/pwa/app/features/groups/providers/group-provider.tsx`
: `apps/pwa/app/features/groups/services/community-membership-recovery.ts`

Hard rule:
1. do not add a second owner for any row above,
2. remove or isolate parallel mutation paths before behavior fixes.

## Interim multiplicity (v1.5.0 — collapse targets, not new owners)

User smoke (A/B) exposed defects that map to **multiple read/write surfaces** before a single owner exists. Work is ordered in **`docs/program/v1.5.0-architecture-refactor-queue.md`**.

1. **DM / thread message visibility (R1)** — Today split across `use-conversation-messages` (tombstone ref prep, **`normalizeMessage`**, live overlay), account projection (`account-event-reducer` / `account-projection-selectors`), `chat-state-store` persisted fallback, durable delete tombstones (incl. native SQLite), and relay replay. **Target:** one materialization read-model per `(profileId, conversationId)`; suppressions and identity aliases applied in one place before UI. **Hydrate authority (interim choke, not full read-model):** `use-conversation-messages` `hydrateHistory` calls **`resolveHydrationDmReadMessages`** in **`dm-read-authority-contract.ts`** (legacy count gates + repair predicates + types in that module; persisted short-circuit when legacy picks persisted so indexed does not win first); then **`logDmReadHydrationDiagnostics`** for `messaging.dm_read_authority_bridge_used`. **`legacyAuthorityDecision`** is always returned for granular `conversation_history_authority` logs. **Post-scan assembly (interim):** **`assembleDmHydrateThreadReadModel`** in **`dm-conversation-hydrate-read-model.ts`** composes authority resolution, soft cap, group scope filter, live-overlay merge, and structured log payloads. **Hydrate orchestration (interim):** **`dm-conversation-hydrate-pipeline.ts`** — **`runDmConversationHydrateReadModelPipeline`** chains tombstone prep → **`loadInitialDmHydrationIndexedWindow`** → persisted **`chat-state-store`** fallback → **`assembleDmHydrateThreadReadModel`** → **`runDmHydrateSiblingIdSplitDiagnosticsIfNeeded`**; **`logDmHydrateReadModelTelemetry`** centralizes **`logAppEvent`** for **`messaging.conversation_history_authority_selected`** + **`messaging.conversation_hydration_diagnostics`** (hook `hydrateHistory` delegates). **Indexed window I/O:** **`dm-conversation-hydrate-indexed-scan.ts`**. **Indexed scan row→displayable mapping (single contract, not full read-model):** **`mapIndexedConversationRowsForDisplayableScan`** in **`dm-conversation-hydrate-indexed-map-rows.ts`** (uses **`dm-conversation-message-retention-dedupe.ts`**). **Sibling id-split diagnostics (interim):** **`runDmHydrateSiblingIdSplitDiagnosticsIfNeeded`** in **`dm-conversation-hydrate-sibling-diagnostics.ts`**; pure alias set in **`utils/dm-conversation-sibling-ids.ts`**. **Projection evidence row prep (interim):** **`buildProjectionEvidenceMessagesForConversation`** in **`dm-conversation-projection-evidence-messages.ts`**. **Merge/cap primitives:** **`conversation-message-materialization.ts`**. **R1 exit:** hook must stop being the sole owner of overlay + diagnostics assembly, **or** a single service subsumes that pipeline with the hook as thin I/O — truth-map owner row + quarantine/delete of parallel assemblers still outstanding.
2. **Community visible participants (R2)** — Today merged from roster projection, known-participant directory, sealed-community / relay snapshots, and stabilization in group home UI. **Target:** one durable OR-set + ledger-backed terminal removals; relay snapshots only narrow under high confidence. **Interim:** `stabilizeCommunityMemberPubkeys` logic exists only in `community-member-roster-projection.ts`; `community-visible-members.ts` is a thin `previous`/`next` adapter for React call sites (removed duplicate implementation). **Known-participant seed read path:** `mergeKnownParticipantSeedPubkeys` in `community-known-participant-directory.ts` (deduped union of directory + persisted `group.memberPubkeys`); `group-home-page-client.tsx` and `group-management-dialog.tsx` use it for sealed-community / visible-member seeds (no manual double-spread). **`community-visible-members.ts`:** **`resolveCommunitySeedMemberPubkeysFromDirectory`** centralizes directory + persisted **`memberPubkeys`** + roster projection + local for sealed-community seeds (**`group-home-page-client`**, **`group-management-dialog`**). **`resolveAuthorEvidencePubkeysFromCommunityMessages`** dedupes message-author pubkeys for **`resolveVisibleCommunityMemberPubkeys`**, for **`group-provider`** persisted hydrate (`groupMessageAuthorsByConversationId` + merged **`memberPubkeys`**), and via **`collectGroupMessageAuthorPubkeys`**. **`resolveActiveCommunityMemberPubkeysFromConversation`** runs author dedupe + visible merge in one pass for **`group-home-page-client`** and **`group-management-dialog`**. **`useStableCommunityParticipantPubkeys`** shares ref-sync + stabilization between **`group-home-page-client`** and **`group-management-dialog`**. **`group-home-page-client.tsx`:** one `seededMemberEvidence` memo feeds both `useSealedCommunity({ initialMembers })` and downstream visible-member resolution (no duplicate `resolveCommunitySeedMemberPubkeys` inline at the hook boundary). **`group-provider`** relay snapshot **`protectRemovalPubkeys`** uses **`mergeKnownParticipantSeedPubkeys`** so thinner-snapshot relax matches UI seed OR-set. **localStorage:** `group-provider` defers bulk directory→`upsertCommunityKnownParticipantsEntry` when the directory equals stored ∪ `group.memberPubkeys` ∪ local only (roster- or evidence-widening still persists). **No second persist path:** the prior `createdGroups` multi-member `useEffect` that upserted from `group.memberPubkeys` alone was removed so optimistic group descriptors cannot widen durable storage without the directory diff gate.

Until R1/R2 close, treat symptom fixes that add another filter layer in React as **last resort**; prefer shrinking the multiplicity list above.

## Critical Runtime Invariants

1. Identity/profile scope resolves before account-scoped stores mount.
2. Signed-out windows stay light (no heavy sync/transport ownership).
3. Recovery completion is never inferred from timeout-only signals.
4. Restore/replay cannot silently shrink self-authored history.
5. Startup must fail-open to actionable state (`locked`, `degraded`, `fatal`).
6. Relay runtime truth and window runtime truth are separate; UI state is not transport truth.
7. Derived `messages`/Vault caches must never outlive the active account/profile scope.
8. Deterministic add-contact tokens (`OBSCUR-*`, contact card, `npub`, hex pubkey) must converge on one canonical resolver path.
9. Discovery person-entry navigation must converge on the public profile route, not a chat-shell shortcut.

## Startup and Runtime Flow (Current)

1. `AppProviders` composes startup path.
2. `DesktopProfileBootstrap` resolves and bounds profile refresh.
3. `AuthGateway` + `useIdentity` resolve identity lock/unlock.
4. `ProfileBoundAuthShell` handles startup stall/fatal recovery actions.
5. `UnlockedAppRuntimeShell` mounts relay/groups/network/messaging owners.
6. `RuntimeActivationManager` emits ready/degraded transitions.

## Required Diagnostics (Do Not Remove)

1. Runtime snapshots:
: `window.obscurWindowRuntime.getSnapshot()`
: `window.obscurRelayRuntime.getSnapshot()`
2. Transport journal:
: `window.obscurRelayTransportJournal.getSnapshot()`
3. App event digest:
: `window.obscurAppEvents.getDigest(300)`
4. Sync/restore convergence:
: `account_sync.backup_restore_merge_diagnostics`
: `account_sync.backup_restore_apply_diagnostics`

## Architecture Change Gate (Before Merge)

1. Which canonical owner changed?
2. Which overlapping mutation paths were removed or isolated?
3. Which invariant is protected?
4. Which diagnostics verify runtime convergence?
5. Which focused tests cover sender/receiver or two-device behavior?

During **v1.5.0 architecture refactors** (`docs/program/v1.5.0-architecture-refactor-queue.md`), if tests are intentionally deferred for a slice, answer instead: **which refactor-queue exit criterion was met** and **which runtime smoke** (e.g. new window, A/B) was run.

If these are not explicitly answered, the change is not architecture-safe.

## Minimal Verification Set

```bash
pnpm -C apps/pwa exec tsc --noEmit
pnpm -C apps/pwa exec vitest run app/features/runtime/components/runtime-activation-manager.test.tsx app/features/runtime/components/profile-bound-auth-shell.test.tsx app/features/auth/hooks/use-identity.test.ts app/features/account-sync/hooks/use-account-sync.test.ts app/features/account-sync/services/encrypted-account-backup-service.test.ts app/features/groups/providers/group-provider.cross-device-membership.integration.test.tsx
pnpm docs:check
```

## Anti-Drift Policy

1. Prefer subtraction over compatibility layering.
2. Do not claim fixes from tests alone; include runtime evidence.
3. Update this file, `docs/encyclopedia/03-runtime-architecture.md`, and `CHANGELOG.md` together when owner boundaries change.
