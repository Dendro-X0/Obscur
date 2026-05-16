# Current Session Handoff

- Last Updated (UTC): 2026-05-15T23:00:00Z
- Session Status: **v1.5.0 release candidate** — `/docs` restructured (root = `README.md` only); DM cooperative redaction **UI deferred**; **Phase 3 M5** (live A/B) and **P0 REL-*** may remain open per program scope
- Active Owner: **Membership ingress → coordinator** (`apply-community-membership-ingress.ts`); **ClientGateway** for DM/roster; see `docs/program/v1.5.0-phase3-scope.md`

## Active Objective

**Radical rewrite mandate (2026-05-14):** Unify all client behavioral pathways through **`ClientGateway`** (`@dweb/client-gateway` + `getResolvedClientGateway()`). Eliminate hybrid paths (`getResolvedStoragePorts`, direct `localDmVisibilityOwner`, feature-level `isTauri`). DM delete / sync / roster symptoms stay **documented limitations** until R1/R2 complete — no incremental debug loops.

## Current Snapshot

- What is true now:
  - `ProfileMessageBus` lives in `@dweb/core/profile-message-bus` with unit tests (`profile-message-bus.test.ts`).
  - `ProfileRuntimeProvider` mounts under `UnlockedAppRuntimeShell`, syncs with `PROFILE_CHANGED_EVENT`, exposes `useProfileRuntime` / `useProfileMessageBus`, and installs `setProfileRuntimeScope` for non-React services.
  - `ChatStateStore` resolves profile via `getResolvedProfileId()` (injected runtime → fallback `getActiveProfileIdSafe`), and emits `chat-state-replaced` on both the bus (when injected) **and** the legacy window event for incremental migration.
  - Choke-point module `profile-runtime-scope.ts` centralizes injected scope; ESLint blanket ban on `getActiveProfileIdSafe` is deferrable until call-site migration shrinks.
  - `dispatchGroupInviteResponseAccepted` dual-publishes `group-invite-accepted` on the bus plus legacy window (`profile-bus-dispatch.ts`); ingress uses this from `incoming-dm-event-handler`.
  - `MessagingProvider` listens to **`chat-state-replaced`** on the profile bus **and** window, with microtask coalescing to absorb duplicate dual-publishes; `activeProfileId` uses **`getResolvedProfileId()`**.
  - `group-provider` uses **`getResolvedProfileId()`**, **microtask-coalesced** chat-state hydrate from bus + window, **`useOptionalProfileMessageBus`** for subscriptions.
  - **`ProfileMessageBus`** also carries **`account-restore-materialization-started`**, **`account-restore-materialization-completed`**, **`community-membership-ledger-updated`**, **`community-operation-log-updated`**, **`community-state-updated`**, **`crdt-membership-gossip`**, **`crdt-anti-entropy-request`**, **`crdt-membership-received`**, **`peer-interaction-updated`**, **`messages-index-rebuilt`**; **`publish`** drops events whose **`detail.profileId`** (when present) does not match the bus owner (same isolation rule as **`chat-state-replaced`**).
  - **`dispatchAccountRestoreMaterializationEvent`** and **`saveCommunityMembershipLedger`** dual-publish to the bus + legacy window; **`GroupProvider`** listens via **`subscribe-account-restore-materialization-*-dual`** and **`subscribe-community-membership-ledger-updated-dual`**. Writers **`saveOperationLog`**, **`community-sync-service`**, **`community-membership-gossip`**, **`community-membership-relay-bridge`** dual-publish with **`profileId`** on **`detail`** where applicable.
  - **Invite terminal DM (Phase 3 M3, inviter path):** inbound `community-invite-response` with **`declined`** or **`canceled`** logs **`messaging.incoming.community_invite_response_terminal_observed`** and does **not** dispatch **`group-invite-accepted`** or mutate membership (inviter may remain relay-joined).
  - **Invite decline (Phase 3 M3):** after sending `community-invite-response` with `declined`, `CommunityInviteCard` calls **`GroupProvider.recordMembershipLedgerAfterInviteDecline`**, which applies **`resolveCommunityMembershipExplicitLeaveMutation`** (terminal **`left`**) so ambient **`runtime_invite_accepted` / `runtime_membership_confirmed`** cannot resurrect a joined state for that ledger key.
  - **`recordPeerLastActive`** / **`peer-interaction-store`** dual-publish **`peer-interaction-updated`** (bus + **`obscur:peer-interaction-updated`**); **`usePeerLastActiveByPeer`** uses **`subscribe-peer-interaction-updated-dual`** plus **`storage`** (cross-tab). **`dispatchMessagesIndexRebuiltEvent`** dual-publishes vault/migration index rebuilds; **`useVaultMedia`** uses **`subscribe-messages-index-rebuilt-dual`**.
  - Per-conversation notification toggles dispatch **`notification-target-preference-changed`** on the profile bus plus **`obscur:notification-target-preference-changed`**; **`ChatHeader`** uses **`subscribeNotificationTargetPreferenceChangedDual`**. **`notification-target-preference`** reads/writes **`getScopedStorageKey(..., profileId ?? getResolvedProfileId())`**; UI and **`DesktopNotificationHandler`** pass **`getResolvedProfileId()`**; cross-tab **`storage`** listeners filter keys ending in **`::${profileId}`** (legacy keys without `::` still notify all tabs).
  - **`subscribe-chat-state-replaced-dual`** unifies window + bus subscription with coalescing; used by **`use-peer-trust`**, **`use-conversation-messages`**, **`use-vault-media`**, **`MessagingProvider`**, **`GroupProvider`** (membership hydrate effect). **`subscribe-group-invite-accepted-dual`** does the same for **`group-invite-accepted`** / **`obscur:group-invite-response-accepted`** (used by **`GroupProvider`**) so dual-publish does not double-apply. **`subscribe-group-remove-dual`** coalesces **`group-removed`** (bus) + **`obscur:group-remove`** (window); **`dispatchGroupRemove`** in **`profile-bus-dispatch`** dual-publishes; **`use-sealed-community`** disband calls **`dispatchGroupRemove`**. **`MessagePersistenceService`** uses internal queue + **`bindProfileBusChatStateReplaced`** from **`MessagingProvider`** (migrate path uses **`getResolvedProfileId`**).
  - **`main-shell.tsx`** and **`settings-page-client.tsx`** use **`getResolvedProfileId()`** for active profile reads under the runtime shell.
  - ESLint **`no-restricted-imports` (error)** blocks **`getActiveProfileIdSafe`** imports from **`profile-scope`** in app code (exempt: **`profile-scope.ts`**, **`profile-runtime-scope.ts`**, tests).
  - **`single-process-profile-isolation.test.ts`** — Phase 1 same-process isolation (bus + scope + **`detail.profileId`** guards including peer-interaction; **`chat-state-replaced`** rejects **`event.profileId`** ≠ bus owner).
  - **Refactor governance (2026-05-14):** **`docs/program/v1.5.0-refactor-verification-and-docs-policy.md`** — client and manual A/B testing **deferred** until R1/R2 queue exits + **`docs/encyclopedia/12-core-architecture-truth-map.md`** owner update; each checkpoint must update **`docs/handoffs/current-session.md`**, append **`docs/program/v1.5.0-refactor-checkpoints.md`**, bump queue when slices move, run **`pnpm docs:check`**. **`docs/encyclopedia/08-maintainer-playbook.md`** cross-links this period.
  - **R1 (2026-05-13):** **`dm-conversation-displayable-message.ts`** + **`dm-conversation-displayable-message.test.ts`** (6) — **`isVoiceCallSignalPayload`**, **`isDisplayableDmConversationMessage`**; deduped from **`use-conversation-messages`** + **`dm-conversation-hydrate-read-model`**.
  - **R1 (2026-05-13):** **`dm-conversation-normalize-message.ts`** + **`dm-conversation-normalize-message.test.ts`** (5) — **`normalizeDmConversationMessageRow`**; **`use-conversation-messages`** hydrate / projection / **`applyBufferedEvents`** import service (removed inline **`normalizeMessage`**).
  - **R1 (2026-05-13):** **`dm-conversation-projection-live-merge.ts`** + **`dm-conversation-projection-live-merge.test.ts`** (6) — **`mergeProjectionFirstWithLiveOverlayForDisplay`**, **`areMessageListsEquivalentById`**; **`use-conversation-messages`** projection merge **`useEffect`** delegates; effect deps include **`conversationAliasIdSet`**.
  - **R1 (2026-05-14):** `conversation-message-visibility.ts` — suppression / identity; **`conversation-message-materialization.ts`** — merges, **`selectMessagesForConversationHistoryAuthority`**, **`capMessageListToSoftLiveWindow`** (`import type` **`ConversationHistoryAuthorityDecision`** from **`dm-read-authority-contract.ts`**). **`use-conversation-messages`** `hydrateHistory` delegates to **`runDmConversationHydrateReadModelPipeline`** (**`dm-conversation-hydrate-pipeline.ts`**) which uses **`loadInitialDmHydrationIndexedWindow`** from **`dm-conversation-hydrate-indexed-scan.ts`** then **`mapIndexedConversationRowsForDisplayableScan`** from **`dm-conversation-hydrate-indexed-map-rows.ts`** (hook supplies **`normalizeDmConversationMessageRow`** + **`isDisplayableDmConversationMessage`**; **`dm-conversation-message-retention-dedupe.ts`** supplies dedupe + retention), then **`assembleDmHydrateThreadReadModel`** (**`dm-conversation-hydrate-read-model.ts`**, which runs **`resolveHydrationDmReadMessages`** + **`logDmReadHydrationDiagnostics`**, group scope filter, live-overlay merge, and builds log contexts); **`projectionEvidenceMessages`** via **`buildProjectionEvidenceMessagesForConversation`** (**`dm-conversation-projection-evidence-messages.ts`**); **`loadEarlier`** uses **`loadConversationWindowAcrossAliases`** + **`scanDisplayableHistoryWindow`** + the same map-rows helper. Persisted short-circuit + **`legacyAuthorityDecision`** unchanged in contract. **`getMessageDirectionCounts`** / **`toConversationIdDiagnosticLabel`** live in read-model module. **`conversation-history-authority.ts`** / shared **removed / folded** into contract (2026-05-14); **`conversation-history-authority.test.ts`** + **`dm-conversation-hydrate-read-model.test.ts`** (2).
  - **R1 (2026-05-13):** **`dm-conversation-projection-evidence-messages.ts`** + **`dm-conversation-projection-evidence-messages.test.ts`** (3) — **`buildProjectionEvidenceMessagesForConversation`**; **`use-conversation-messages`** delegates **`projectionEvidenceMessages`** useMemo.
  - **R1 (2026-05-13):** **`dm-conversation-message-retention-dedupe.ts`** — **`filterMessagesByLocalRetention`**, **`dedupeMessagesByIdentity`**, **`normalizeLocalRetentionDays`**; **`dm-conversation-hydrate-indexed-map-rows`** imports them (hook no longer injects). **`dm-conversation-message-retention-dedupe.test.ts`** (3); **`use-conversation-messages.test.ts`** retention cases moved here.
  - **R1 (2026-05-13):** **`utils/dm-conversation-sibling-ids.ts`**, **`dm-conversation-hydrate-sibling-diagnostics.ts`**, **`dm-conversation-sibling-ids.test.ts`** (3) — sibling outgoing probe + telemetry moved out of **`use-conversation-messages`** hydrate path.
  - **R1 (2026-05-13):** **`dm-conversation-hydrate-indexed-map-rows.ts`** + **`dm-conversation-hydrate-indexed-map-rows.test.ts`** (3) — canonical hydrate vs load-earlier row mapping for IndexedDB scan passes.
  - **R2 (2026-05-14):** **`group-home-page-client`** + **`group-provider`** — removed **`[MemberStabilization]`** / **`[MemberFix]`** `console.log` diagnostics (structured **`logAppEvent`** on snapshot path unchanged).
  - **R2 (2026-05-14):** **`use-stable-community-participant-pubkeys.ts`** — shared hook for ref-sync + **`stabilizeCommunityMemberPubkeys`**; **`group-home-page-client`** and **`group-management-dialog`** use it (single stabilization owner at React boundary).
  - **R2 (2026-05-14):** **`group-management-dialog.tsx`** — uses **`useSealedCommunity`** from **`use-sealed-community.ts`** (same as **`group-home-page-client`**); removed unused **`use-sealed-community-fixed`** wrapper (second CRDT merge on returned **`members`** was not consumed by the dialog roster path). Participant list still seeds from **`resolveCommunitySeedMemberPubkeysFromDirectory`** + **`resolveVisibleCommunityMemberPubkeys`** + **`stabilizeCommunityMemberPubkeys`**.
  - **R2 (2026-05-14):** **`community-member-snapshot-policy.ts`** — **`policyReasonCode`** on non-relaxed paths is evidence-accurate (**`relay_evidence_relax_blocked_protected_member`**, **`relay_evidence_warming_up_strict`**, **`relay_evidence_partial_eose_strict`**, **`relay_evidence_confident`**); no longer emits **`relay_evidence_seed_only_allowing_thinner`** when the thinner guard did not relax.
  - **R2 (2026-05-14):** **`community-visible-members.ts`** — **`resolveCommunitySeedMemberPubkeysFromDirectory`** (sealed-community seeds); **`resolveAuthorEvidencePubkeysFromCommunityMessages`** + **`resolveActiveCommunityMemberPubkeysFromConversation`** (**`group-home-page-client`** + **`group-management-dialog`**: one **`useMemo`** for active roster + author evidence); hydrate reuse below.
  - **R2 (2026-05-14):** **`community-message-author-evidence.ts`** / **`group-provider.tsx`** — **`resolveAuthorEvidencePubkeysFromCommunityMessages`** for persisted group-message authors (**`hydrateGroupsForPublicKey`** coordinator map + **`memberPubkeys`** merge); **`collectGroupMessageAuthorPubkeys`** delegates.
  - **R2 (2026-05-14):** **`group-provider`** + **`community-member-snapshot-policy`** — relay snapshot **`protectRemovalPubkeys`** delegates to **`mergeKnownParticipantSeedPubkeys`** (same OR-set as UI seeds).
  - **R2 (2026-05-14):** **`group-home-page-client.tsx`** — one **`seededMemberEvidence`** memo supplies **`useSealedCommunity`** **`initialMembers`** and the visible-member pipeline (no duplicate seed compute at the sealed-community hook boundary).
  - **R2 (2026-05-13):** **`main-shell.tsx`** — **`useSealedCommunity`** **`initialMembers`** uses the same directory ∪ persisted ∪ projection ∪ local contract as group home / management (**`sealedCommunityInitialMembers`** + **`resolveCommunitySeedMemberPubkeysFromDirectory`**); **`main-shell.test.tsx`** **`useGroups`** mock includes **`communityKnownParticipantDirectoryByConversationId`**.
  - **R2 (2026-05-13):** **`groups/leave/page.tsx`** — **`useSealedCommunity`** **`initialMembers`** via **`resolveCommunitySeedMemberPubkeysFromDirectory`** (same directory / roster / persisted / local contract as **`main-shell`**); conversation key **`group.id`** or **`toGroupConversationId`** when resolving from query only.
  - **R2 (2026-05-14):** **`group-provider`** — removed **`createdGroups`** multi-member **`useEffect`** that **called** **`upsertCommunityKnownParticipantsEntry`** from **`group.memberPubkeys`** alone (bypassed directory minimal-baseline gate). Durable known-participant writes: directory build + widen-only persist effect only.
  - **R2 (2026-05-14):** **`mergeKnownParticipantSeedPubkeys`** (directory + persisted group seed); **`group-provider`** bulk known-participants localStorage sync skips pure stored∪descriptor∪local rebuilds; **`stabilizeCommunityMemberPubkeys`** single implementation in **`community-member-roster-projection.ts`**; **`community-visible-members`** adapter only. **R2-adjacent (prior):** `community-member-snapshot-policy` `[...raw]` for `protectRemovalPubkeys`.
  - **R1 (2026-05-13):** Prior hydrate unified through migration bridge; superseded by direct contract hydrate (2026-05-14).
  - **R1 (2026-05-14):** **`dm-conversation-hydrate-pipeline.ts`** — **`runDmConversationHydrateReadModelPipeline`** + **`logDmHydrateReadModelTelemetry`**; **`use-conversation-messages`** **`hydrateHistory`** delegates tombstone prep → **`loadInitialDmHydrationIndexedWindow`** → persisted **`chat-state-store`** fallback → **`assembleDmHydrateThreadReadModel`** → **`runDmHydrateSiblingIdSplitDiagnosticsIfNeeded`** (interim milestone **6** in **`docs/program/v1.5.0-architecture-refactor-queue.md`**). No new Vitest this slice; **`pnpm exec tsc --noEmit`** (apps/pwa) green.
  - **R1 docs triage (2026-05-14):** **`docs/program/v1.5.0-architecture-refactor-queue.md`** lists **interim milestones** (hydrate contract + **`dm-conversation-hydrate-read-model.ts`** + materialization merges) vs **full R1 exit** (single read-model assembler); **`docs/encyclopedia/14-module-owner-index.md`** — DM authority / pure assembly / hook assembler rows; **`docs/encyclopedia/12-core-architecture-truth-map.md`** R1 bullet updated.
  - **Phase 3 M5 diagnostics (2026-05-13):** `upsertCommunityMembershipLedgerEntry` logs **`groups.membership_ledger_mutation_applied`** when merge changes the row for the upsert ledger key (or adds/removes rows). Pairs with **`groups.membership_ingress_verdict`** for membership traces.
  - **DM v2 relay receive (2026-05-13):** `subscribeToIncomingDMs` uses a **7-day** `since` lookback, **lowercase** `#p` / `authors` filters, and **limit 200** (was 30s / mixed-case / 50). **`useDmController`** records **`peerRelayEvidenceStore.recordInboundRelay`** for each **incoming** processed message so hybrid outbound targeting can include relays the peer actually used.
  - **DM subscribe / publish symmetry (2026-05-13):** Incoming DM transport **`addTransientRelay`** for delivery fallbacks; **`SubscriptionManager`** case-insensitive **`authors` / `#p`** filter matching; overlap hook merges **NIP-65** + inbound evidence.
  - **Phase 3 M4 (2026-05-13):** Extended **`community-phase3-m4-membership-replay.test.ts`** — tombstone hides joined+persisted; terminal ledger hides stale persisted (offline divergence); **`user_explicit_rejoin`** after leave restores visibility; duplicate ledger keys resolve by **newer `updatedAtUnixMs`**. **`community-membership-ingress`** logs **`groups.membership_ingress_verdict`** on every classify outcome.
  - Architecture design docs landed: `docs/communities/membership-sync-architecture.md`, `docs/architecture/roadmap-v2-draft.md`, `docs/program/v1.5.0-implementation-plan.md`, `docs/program/v1.5.0-phase1-execution.md`, `docs/research/strategic-technology-analysis.md`.
  - **`getActiveProfileIdSafe` in PWA app source:** only **`profile-scope.ts`** (definition / default params) and **`profile-runtime-scope.ts`** (fallback); production call sites migrated to **`getResolvedProfileId()`** (batch: auth, account-sync, messaging v2, groups, vault, deletion coordinator). Tests still mock legacy symbol where needed; several suites updated to **`getResolvedProfileId`** mocks.
  - Broader baseline still applies for **`window.dispatchEvent` obscur** paths (dual-publish migration); 0 `globalThis[` usages.
  - `getActiveProfileIdSafe` in `profile-scope.ts` remains fallback for callers until explicit injection is complete (`profileScopeOverride`, registry active id, `"default"`).

## Evidence

- Baseline grep counts captured 2026-05-12.
- Phase 3 M4 coordinator replay: `pnpm test:run app/features/groups/services/community-phase3-m4-membership-replay.test.ts` (8 tests, 2026-05-13).
- Ledger mutation diagnostic: `pnpm test:run app/features/groups/services/community-membership-ledger.test.ts` (2026-05-13; emits `groups.membership_ledger_mutation_applied` on status transitions).
- `pnpm docs:check` (2026-05-13) — green after displayable predicate dedupe + handoff.
- `pnpm docs:check` (2026-05-13) — green after **`normalizeDmConversationMessageRow`** extraction + handoff/queue/index.
- `pnpm docs:check` (2026-05-13) — green after projection-live-merge handoff + queue + module index.
- `pnpm docs:check` (2026-05-14) — green after governance + rewrite path refs, **shared → contract** fold, and R1 doc triage (**`v1.5.0-architecture-refactor-queue`**, **`12-core-architecture-truth-map`**, **`14-module-owner-index`**, handoff).
- `pnpm exec vitest run app/features/groups/services/community-visible-members.test.ts` (2026-05-14) — **12** tests green after **`resolveActiveCommunityMemberPubkeysFromConversation`**.
- `pnpm exec vitest run app/features/groups/services/community-message-author-evidence.test.ts app/features/groups/providers/group-provider.test.tsx` (2026-05-14) — green after **`resolveAuthorEvidencePubkeysFromCommunityMessages`** reuse in **`group-provider`** + **`collectGroupMessageAuthorPubkeys`**.
- `pnpm exec vitest run app/features/groups/services/community-visible-members.test.ts` (2026-05-14) — **11** tests green after **`resolveAuthorEvidencePubkeysFromCommunityMessages`**.
- `pnpm exec tsc --noEmit` from **`apps/pwa`** (2026-05-13) — green after **`groups/leave/page.tsx`** sealed-community **`initialMembers`** parity.
- `pnpm exec vitest run app/features/main-shell/main-shell.test.tsx` (9 tests, 2026-05-13) — green after **`main-shell`** **`sealedCommunityInitialMembers`** + **`useGroups`** mock **`communityKnownParticipantDirectoryByConversationId`**.
- `pnpm exec tsc --noEmit` from **`apps/pwa`** (2026-05-13) — green after **`main-shell`** sealed-community **`initialMembers`** alignment.
- `pnpm exec vitest run app/features/groups/hooks/use-sealed-community.integration.test.ts app/features/groups/providers/group-provider.test.tsx app/features/groups/services/community-visible-members.test.ts` (2026-05-14) — green after **`useStableCommunityParticipantPubkeys`** extraction.
- `pnpm exec vitest run app/features/groups/hooks/use-sealed-community.integration.test.ts app/features/groups/providers/group-provider.test.tsx` (2026-05-14) — green after R2 management dialog **`useSealedCommunity`** canonicalization.
- `pnpm exec vitest run app/features/groups/services/community-member-snapshot-policy.test.ts app/features/groups/services/community-relay-evidence-policy.test.ts` (2026-05-14) — green after R2 snapshot **`policyReasonCode`** accuracy fix.
- `pnpm exec tsc --noEmit` from **`apps/pwa`** (2026-05-14) — green after R2 snapshot **`policyReasonCode`** accuracy fix.
- `pnpm exec tsc --noEmit` from **`apps/pwa`** (2026-05-14) — green after R2 console-noise removal (**`group-home-page-client`**, **`group-provider`**).
- `pnpm exec tsc --noEmit` from **`apps/pwa`** (2026-05-14) — green after **`resolveCommunitySeedMemberPubkeysFromDirectory`** (group home + management dialog).
- `pnpm exec tsc --noEmit` from **`apps/pwa`** (2026-05-14) — green after R2 **`protectRemovalPubkeys`** → **`mergeKnownParticipantSeedPubkeys`** alignment.
- `pnpm exec tsc --noEmit` from **`apps/pwa`** (2026-05-14) — green after **`group-home-page-client`** single **`seededMemberEvidence`** path.
- `pnpm exec tsc --noEmit` from **`apps/pwa`** (2026-05-14) — green after **R2** **`group-provider`** removal of optimistic **`createdGroups`**→known-participants upsert.
- `pnpm exec tsc --noEmit` from **`apps/pwa`** (2026-05-14) — green after **`dm-conversation-hydrate-pipeline.ts`** + hook delegation (no new Vitest this slice).
- `pnpm exec tsc --noEmit` from **`apps/pwa`** (2026-05-14) — green after R1 materialization slice + prior test harness fixes.
- `pnpm exec vitest run app/features/messaging/services/conversation-message-materialization.test.ts` (8 tests, 2026-05-14).
- `pnpm exec vitest run app/features/messaging/services/dm-read-authority-contract.test.ts` + `conversation-history-authority.test.ts` + `conversation-message-materialization.test.ts` + `use-conversation-messages.integration.test.ts` (**76** tests, 2026-05-14) — green after **shared → contract** fold.
- `pnpm exec vitest run app/features/groups/services/community-visible-members.test.ts` + `community-member-roster-projection.test.ts` (17 tests, 2026-05-14).
- `pnpm exec vitest run app/features/groups/services/community-known-participant-directory.test.ts` (3 tests, 2026-05-14).
- `pnpm exec tsc --noEmit` (apps/pwa) + **`vitest run`** `use-conversation-messages.test.ts` + `use-conversation-messages.integration.test.ts` + `dm-conversation-hydrate-read-model.test.ts` (2026-05-13) — green after indexed-scan extraction.
- `pnpm exec vitest run app/features/messaging/services/dm-conversation-hydrate-indexed-scan.test.ts` (3 tests, 2026-05-13).
- `pnpm exec vitest run app/features/messaging/services/dm-conversation-displayable-message.test.ts` + hydrate read-model + `use-conversation-messages` unit/integration (2026-05-13) — green after displayable predicate dedupe.
- `pnpm exec vitest run app/features/messaging/services/dm-conversation-normalize-message.test.ts` + `use-conversation-messages.test.ts` + integration + `dm-conversation-projection-evidence-messages.test.ts` (2026-05-13) — green after **`normalizeDmConversationMessageRow`** extraction.
- `pnpm exec vitest run app/features/messaging/services/dm-conversation-projection-live-merge.test.ts` + `use-conversation-messages.integration.test.ts` (2026-05-13) — green after projection-live-merge extraction.
- `pnpm exec vitest run app/features/messaging/services/dm-conversation-projection-evidence-messages.test.ts` + `use-conversation-messages.integration.test.ts` (2026-05-13).

## Changed Files

- Docs — **`12-core-architecture-truth-map.md`**, **`14-module-owner-index.md`**, **`v1.5.0-architecture-refactor-queue.md`**, **`handoffs/current-session.md`**, **`v1.5.0-refactor-checkpoints.md`**
- PWA — **`groups/leave/page.tsx`** (R2: **`leaveSealedCommunityInitialMembers`** + provider directory / roster lookup)
- PWA — **`community-visible-members.ts`**, **`community-visible-members.test.ts`**, **`group-home-page-client.tsx`**, **`group-management-dialog.tsx`** (R2: **`resolveActiveCommunityMemberPubkeysFromConversation`**, **`resolveAuthorEvidencePubkeysFromCommunityMessages`**)
- PWA — **`community-message-author-evidence.ts`**, **`group-provider.tsx`** (R2: **`resolveAuthorEvidencePubkeysFromCommunityMessages`** hydrate)
- PWA — **`use-stable-community-participant-pubkeys.ts`** (new), **`group-home-page-client.tsx`**, **`group-management-dialog.tsx`**, **`community-visible-members.ts`** (R2: single React stabilization owner)
- PWA — **`group-management-dialog.tsx`** (R2: **`useSealedCommunity`** canonical import; drop redundant **`knownParticipantRegistry`** memo)
- PWA — **`use-sealed-community-fixed.ts`** **deleted** (only consumer was management dialog; roster never used wrapper **`members`**)
- PWA — **`community-member-snapshot-policy.ts`**, **`community-member-snapshot-policy.test.ts`** (R2: accurate **`policyReasonCode`** on non-relaxed snapshot paths)
- PWA — **`group-home-page-client.tsx`**, **`group-provider.tsx`** (R2: drop **`[MemberStabilization]`** / **`[MemberFix]`** console noise)
- PWA — **`community-visible-members.ts`**, **`group-home-page-client.tsx`**, **`group-management-dialog.tsx`** (R2: **`resolveCommunitySeedMemberPubkeysFromDirectory`**)
- PWA — **`group-provider.tsx`**, **`community-member-snapshot-policy.ts`** (R2: **`protectRemovalPubkeys`** = **`mergeKnownParticipantSeedPubkeys`**)
- PWA — **`group-provider.tsx`** (R2: remove parallel known-participants upsert from **`createdGroups`**)
- PWA — **`dm-conversation-hydrate-pipeline.ts`** (new), **`use-conversation-messages.ts`**, **`dm-conversation-hydrate-read-model.ts`** (module header)
- Docs — **`docs/archive/rewrite-shelf/37-owner-aligned-extraction-workstreams.md`**, **`docs/archive/rewrite-shelf/workstreams/dm-read-model-ownership-extraction-contract.md`**, **`docs/archive/rewrite-shelf/workstreams/restore-and-import-ownership-extraction-contract.md`** (DM read / restore owner lists → **`dm-read-authority-contract.ts`** only)
- Docs — **`v1.5.0-refactor-verification-and-docs-policy.md`**, **`v1.5.0-refactor-checkpoints.md`**, **`v1.5.0-architecture-refactor-queue.md`** (verification blurb), **`08-maintainer-playbook.md`** (stamp + v1.5.0 refactor period), **`handoffs/current-session.md`**; prior refactor pivot docs (`12-core-architecture-truth-map.md`, `14-module-owner-index.md`, `v1.5.0-implementation-plan.md`, `v1.5.0-phase3-scope.md`, `decentralized-messaging-deletion-roster-limitations.md`, etc.); **docs:check** numbered-doc stamps + stale path ref fixes per earlier session
- PWA — **`dm-conversation-displayable-message.ts`**, **`dm-conversation-displayable-message.test.ts`**, **`use-conversation-messages.ts`**, **`dm-conversation-hydrate-read-model.ts`**, **`dm-conversation-hydrate-indexed-map-rows.ts`** (comment)
- PWA — **`dm-conversation-normalize-message.ts`**, **`dm-conversation-normalize-message.test.ts`**, **`use-conversation-messages.ts`**, **`dm-conversation-hydrate-indexed-scan.ts`** (comment), **`dm-conversation-hydrate-indexed-map-rows.ts`** (comment)
- PWA — **`dm-conversation-projection-live-merge.ts`**, **`dm-conversation-projection-live-merge.test.ts`**, **`use-conversation-messages.ts`**
- PWA — **`dm-conversation-projection-evidence-messages.ts`**, **`dm-conversation-projection-evidence-messages.test.ts`**, **`use-conversation-messages.ts`**, **`dm-conversation-hydrate-read-model.ts`** (comment)
- PWA — **`dm-conversation-message-retention-dedupe.ts`**, **`dm-conversation-message-retention-dedupe.test.ts`**, **`dm-conversation-hydrate-indexed-map-rows.ts`**, **`dm-conversation-hydrate-indexed-map-rows.test.ts`**, **`use-conversation-messages.ts`**, **`use-conversation-messages.test.ts`**
- PWA — **`dm-conversation-hydrate-sibling-diagnostics.ts`**, **`utils/dm-conversation-sibling-ids.ts`**, **`dm-conversation-sibling-ids.test.ts`**, **`use-conversation-messages.ts`**, **`dm-conversation-hydrate-read-model.ts`** (comment)
- PWA — **`dm-conversation-hydrate-indexed-scan.test.ts`** (3)
- PWA — **`dm-conversation-hydrate-indexed-scan.ts`**, **`use-conversation-messages.ts`** (indexed hydrate + load-earlier imports), **`dm-conversation-hydrate-read-model.test.ts`**
- PWA — **`conversation-history-authority.ts`** **deleted**; **`conversation-history-authority-shared.ts`** **folded into `dm-read-authority-contract.ts`**; **`HEURISTIC_PATH_QUARANTINE.md`** Entry 1 updated; **`use-conversation-messages.ts`**, **`dm-read-authority-contract.ts`**, **`conversation-message-materialization.ts`** (`import type` from contract), **`conversation-history-authority.test.ts`** (15), **`12-core-architecture-truth-map.md`**
- PWA — **`group-provider.tsx`** (known-participants persist gate), **`community-known-participants-store.ts`** (writer contract note)
- PWA — **`community-known-participant-directory.ts`** + **`community-known-participant-directory.test.ts`**; **`group-home-page-client.tsx`**, **`group-management-dialog.tsx`** (seed path)
- PWA — **`community-visible-members.ts`**, **`community-member-roster-projection.ts`** (R2 stabilize dedupe)
- PWA — `incoming-dm-event-handler.ts` (terminal invite response observe log), `incoming-dm-event-handler.test.ts`, `community-invite-card.tsx` (cancel path comment)
- PWA — `group-provider.tsx` (`recordMembershipLedgerAfterInviteDecline`), `community-invite-card.tsx` (decline → ledger), `group-provider.test.tsx` (ledger terminal assertion)
- `@dweb/core` — `profile-message-bus.ts`, package export map
- PWA — `profile-runtime-provider.tsx`, `profile-runtime-scope.ts`, `unlocked-app-runtime-shell.tsx`, `chat-state-store.ts`, tests above

## Open Risks Or Blockers

- **DM-001 (accepted limitation):** Delete-for-me is **not** guaranteed after refresh/restart; Web/Desktop may diverge. Documented in **`docs/messaging/deletion-roster-limitations.md`**. **No further patch work** unless R1 is chartered.
- **MEM-001 (accepted limitation):** Community roster can collapse to one visible member after refresh while chat still works. Same multi-owner failure mode. **No further patch/debug work** unless R2 is chartered.
- **Debugging cancelled (2026-05-14):** Maintainer directive — stop incremental triage on delete, sync, and roster; screenshots (e.g. NewTest 1 showing **1 members** + single participant modal) are expected under current architecture, not open defect queues.
- **ARCH-001:** Incomplete v1.5 architecture refactor + early multi-store debt — incremental fixes do not converge; full rewrite deferred.
- PWA production **`getActiveProfileIdSafe`** migration is complete except **`profile-scope`** / **`profile-runtime-scope`** internals; remaining grep is tests and those modules.
- **Verification stance (2026-05-14):** **Client and manual A/B testing are deferred** until refactor exit criteria in **`docs/program/v1.5.0-refactor-verification-and-docs-policy.md`**. **R1/R2 refactor queue is deferred** for day-to-day feature work. Keep **`pnpm exec tsc --noEmit`** (apps/pwa), focused contract tests, and **`pnpm docs:check`** green.
- Phase 1 must not break existing runtime behavior while being incrementally adopted.
- Historical CRDT/community emergency-plan details are archived; consult `docs/archive/` only when needed.

## Phase 2 readiness (v1.5.0)

- In **`docs/program/v1.5.0-implementation-plan.md`**, **Phase 2** is **contract-first storage — dual engine** (weeks 3–4): shared **`@dweb/storage-contracts`** ports + **native SQLite** (one migration owner, default **Rust**) + **PWA IndexedDB**; not “Drizzle everywhere in the browser.”
- Workspace package **`packages/dweb-storage-contracts`** exists with subpath exports: **`migration-policy`**, **`runtime-capabilities`**, **`scoped-context`**, **`message-delete-tombstones`** (types, normalize/merge, persistence port). **Delete tombstones slice (Phase 2 first vertical):** PWA dual-write to **IndexedDB** (`@dweb/storage/message-delete-tombstones-indexed-db`) + startup merge in **`MessagingProvider`**; **localStorage** remains the sync read path on web. **Tauri:** SQLite **`tombstones`** via **`@dweb/db`** (upsert on insert, **`db_delete_all_tombstones_for_profile`**), in-memory cache + serialized queue in **`message-delete-tombstone-store`**, **`hydrateMessageDeleteTombstonesFromSqlite`** on profile change and before backup/merge when desktop.
- **Formal Phase 1 exit gates**: **`getActiveProfileIdSafe`** and legacy **`window.dispatchEvent`…`obscur:`** are **grep-zero in `apps/`**, with ProfileMessageBus unit + single-process isolation tests passing. Remaining Phase 1 work is limited to incremental refactors/cleanup (not new gate closures).
- **Phase 2 first slice is landed** (delete tombstones: contracts + PWA IDB + native SQLite + tests). **`ProfileRuntimeProvider`** + **`ProfileRuntimeScope`** carry **`storagePorts`**; **`getResolvedStoragePorts()`** / **`useResolvedStoragePorts()`** for product code; **`restore-merge-chat-state`** normalizes via **`@dweb/storage-contracts`**. **Mobile tombstones adapter** landed for the Capacitor SQLite contract path; follow-up remains **extra repository ports** / further storage slices.

## Next Atomic Step

1. **Phase 3 M5:** Manual two-client relay gossip join; confirm `groups.membership_ingress_applied` + ledger `joined` after provisional invite UI.
2. ~~Gate **`runtime_invite_accepted`**~~ — done: provisional roster only; ledger via **`relay_gossip_ingress`**.
3. ~~Relay bridge CRDT receive quarantine~~ — done: ingress-only authority; settings bulk-leave → **`persistExplicitCommunityMembershipLeave`**.
4. ~~REL-004 engineering~~ — leave outbox: ledger-first, `recordCommunityLeaveRelayPublishOutcome`, **`flushPendingCommunityLeaveOutbox`** + **`useCommunityLeaveOutboxRetry`** in `RuntimeActivationManager` (60s interval + relay-open debounce).
5. ~~REL-001 partial~~ — leave intent gate on recovery/backfill; see `community-rel-001-leave-intent-guard.test.ts`.
6. **P0 REL-002/003** — historical live UI, multi-profile isolation.
5. **Phase 4** prep when verification policy allows.


## Manual A/B Evidence Collection

**Status (2026-05-14):** Deferred as a **required** refactor gate until **`docs/program/v1.5.0-refactor-verification-and-docs-policy.md`** exit criteria are met. The steps below remain the playbook **when** client testing resumes.

1. Start two users/profiles and open the same DM conversation.
2. A sends a normal message to B.
3. Wait until A's message is network-confirmed and can be deleted for everyone.
4. A clicks Delete for Everyone.
5. In A and B devtools consoles, collect:
   - `window.obscurAppEvents?.findByName?.("messaging.delete_for_everyone_requested", 20)`
   - `window.obscurAppEvents?.findByName?.("messaging.delete_for_everyone_rejected", 20)`
   - `window.obscurAppEvents?.findByName?.("messaging.delete_for_everyone_remote_result", 80)`
6. Interpret B's result:
   - Missing `v2_subscription_started`: B's global v2 runtime transport owner is not mounted/enabled, or B is not running the updated bundle.
   - Has `v2_subscription_started` but no `v2_subscription_event_received` after A deletes: B is subscribed but the delete event does not arrive through relays.
   - Has `v2_subscription_event_received` but no `dm_receive_parse`: raw event reached B but was dropped before/decryption/parsing.
   - Missing both `enhanced_receive_parse` and `dm_receive_parse`: B did not receive/decrypt/classify the delete command at all.
   - Present `enhanced_receive_parse` with `versioned_delete`: production enhanced path received and understood the new delete command.
   - Present `enhanced_delete_apply` with `no_match`: command arrived, but target IDs do not match B's in-memory or persisted message aliases.
   - Present `enhanced_ui_apply` with `removed`: enhanced path removed it from state; if UI still shows it, another UI/persistence path reintroduced it.
   - Missing `dm_receive_parse`: B did not receive/decrypt/classify the delete command.
   - Present `dm_receive_parse` but missing `dm_receive_classified`: controller path did not receive the pipeline delete result.
   - Present `dm_receive_classified` but rejected `coordinator_decode`/`coordinator_store`: coordinator/scope/permission/storage failure.
   - Present `coordinator_store` but `dm_ui_apply` has `resultCode: "no_match"`: recipient message identity mismatch or message not loaded in memory.
   - Present `dm_ui_apply` with `removed` but UI still shows message: upper UI/persistence rehydration path is reintroducing the message.

## Next Thread Bootstrap Prompt

```text
Read AGENTS.md, docs/encyclopedia/08-maintainer-playbook.md, and docs/handoffs/current-session.md.
DM-001 (delete-for-me after refresh) is an accepted limitation — see docs/messaging/deletion-roster-limitations.md.
Do not spend threads on incremental DM delete persistence unless a refactor milestone is chartered.
Resume from the Next Atomic Step: work on features unrelated to messaging architecture, stack, and database.
Update docs/handoffs/current-session.md before finishing.
```

## Archive Pointers

- Full pre-compaction handoff: `docs/archive/handoffs/current-session-archive-2026-05-07-pre-compaction.md`
- Maintainer playbook: `docs/encyclopedia/08-maintainer-playbook.md`
- DM delete incident context: `docs/encyclopedia/17-dm-delete-restore-divergence-incident.md`

## Checkpoints

<!-- CONTEXT_CHECKPOINTS_START -->
### 2026-05-14T21:40:00Z checkpoint
- Summary: **R0/R2 gateway slice** — `@dweb/client-gateway/app-extensions` (`FullClientGateway` + opaque R1/R2 contracts); PWA `AppClientGateway` aliases concrete ports. **`communityRoster.resolveAuthorEvidencePubkeysFromMessages`** routed in **`group-provider`**, **`community-message-author-evidence`**. **`use-conversation-messages`** uses gateway tombstones; removed deprecated **`applyBufferedEvents`** re-export. **`chat-view.test.tsx`** typed capture ref; **`pnpm exec tsc --noEmit`** (apps/pwa) green; Vitest **43** (author-evidence, group-provider, chat-view, use-conversation-messages).
- Next: R1/R2 grep exit + optional tombstone/stabilize migrations per Next Atomic Step.

### 2026-05-14T21:39:00Z checkpoint
- Summary: **R0/R2 tombstone + stabilize** — **`messaging-provider`**, **`use-chat-actions`** → **`useResolvedClientGateway().messageDeleteTombstones`**. **`communityRoster.stabilizeMemberPubkeys`** on port/owner; **`use-stable-community-participant-pubkeys`** routed. ESLint blocks direct **`stabilizeCommunityMemberPubkeys`** import. **`pnpm exec tsc --noEmit`** green; visible-members + resolve-client-gateway Vitest **14**.
- Next: R1/R2 grep exit; tighten package contracts when owners stable.

### 2026-05-14T22:00:00Z checkpoint
- Summary: **R1 ESLint + CI guard** — expanded restricted imports (hydrate assembler, load-earlier, realtime, author evidence); hydrate telemetry inside **`runDmConversationHydrateReadModelPipeline`**; **`dm-conversation-delete-identity-ids`** + **`dm-conversation-message-list-equiv`** utilities. **`pnpm gateway:boundaries:check`** mirrors ESLint (owner paths exempt). **`pnpm exec tsc --noEmit`** green.
- Next: Promote typed `@dweb/client-gateway` contracts; optional move **`toConversationIdDiagnosticLabel`** behind diagnostics helper.

### 2026-05-14T22:05:00Z checkpoint
- Summary: **Package contracts** — `@dweb/client-gateway/community-roster` (typed R2 port), `dm-materialization` (generic hydrate result), `messaging-diagnostics` (`toConversationIdDiagnosticLabel`). `FullClientGateway` generics unconstrained for app bind. Persist hydrate uses **`GroupConversationRosterContract`**. Owner smoke tests in **`client-gateway-contract-satisfaction.test.ts`**.
- Next: Optional duplicate diagnostic helper dedupe in **`message-persistence-service`** / restore hydrate; DM hydrate params promotion when stable.

### 2026-05-14T22:10:00Z checkpoint
- Summary: **Diagnostics dedupe** — removed local **`toConversationIdDiagnosticLabel`** from **`message-persistence-service`**, **`restore-hydrate-indexed-messages`**; pipeline + sibling diagnostics import **`@dweb/client-gateway/messaging-diagnostics`** directly. R1/R2 exit criteria marked done in handoff Next Atomic Step.
- Next: Optional hydrate params promotion to package; no DM-001/MEM-001 debug unless user requests.

### 2026-05-15T22:35:00Z checkpoint
- Summary: **Phase 3 M1/M2/M3 partial** — **`apply-community-membership-ingress`**, **`subscribe-community-membership-ingress`**, **`GroupProvider`** handler; relay bridge publishes **`eventContent`**; coordinator **`relay_gossip_ingress`**; invite **`provisionalJoin`**. Vitest: ingress apply (2), M4 replay (8), group-provider (28). **`pnpm exec tsc --noEmit`** green. Docs synced: implementation-plan Phase 3 gates, phase3-scope, architecture queue.
- Next: Phase 3 M5 manual A/B; P0 REL blockers; evaluate relay bridge CRDT authority.
### 2026-05-13T22:15:00Z checkpoint
- Summary: **R2 —** **`groups/leave/page.tsx`**: **`useSealedCommunity`** **`initialMembers`** = **`resolveCommunitySeedMemberPubkeysFromDirectory`** (directory + roster by **`group.id`** or **`toGroupConversationId`** fallback). **`pnpm exec tsc --noEmit`** (apps/pwa); handoff + checkpoints.
- Next: R2 queue — snapshot vs refresh; truth-map durable OR-set owner row when ledger path is single-owner documented.

### 2026-05-13T21:40:00Z checkpoint
- Summary: **R2 —** **`main-shell.tsx`** **`sealedCommunityInitialMembers`** for **`useSealedCommunity`** (directory seed contract aligned with group home / management). **`main-shell.test.tsx`** **`useGroups`** mock adds **`communityKnownParticipantDirectoryByConversationId: {}`**. **`pnpm exec tsc --noEmit`** + **`pnpm exec vitest run app/features/main-shell/main-shell.test.tsx`** (apps/pwa).
- Next: R2 queue exit (snapshot vs refresh, truth-map durable OR-set row); optional leave-page **`initialMembers`** parity.

### 2026-05-14T16:35:00Z checkpoint
- Summary: **R2 —** **`resolveActiveCommunityMemberPubkeysFromConversation`**: one pass author + **`resolveVisibleCommunityMemberPubkeys`** for **`group-home-page-client`** + **`group-management-dialog`**; **`community-visible-members.test.ts`** +1. **`pnpm exec vitest run`** **`community-visible-members.test.ts`** + **`group-provider.test.tsx`**; **`pnpm exec tsc --noEmit`** (apps/pwa); truth map + **`14-module-owner-index`**; handoff + checkpoints + **`pnpm docs:check`**.
- Next: R2 exit still needs durable OR-set + ledger truth-map row; avoid parallel roster **`useMemo`** in other surfaces without the same contract.

### 2026-05-14T16:30:00Z checkpoint
- Summary: **R2 —** **`resolveAuthorEvidencePubkeysFromCommunityMessages`** reused in **`group-provider`** (`hydrateGroupsForPublicKey` coordinator authors + member merge) and **`collectGroupMessageAuthorPubkeys`** (**`community-message-author-evidence.ts`** delegates). **`pnpm exec vitest run`** **`community-message-author-evidence.test.ts`** + **`group-provider.test.tsx`**; **`pnpm exec tsc --noEmit`** (apps/pwa); truth map R2 paragraph restored + **`14-module-owner-index`**; handoff + checkpoints + **`pnpm docs:check`**.
- Next: R2 durable OR-set truth-map exit when ledger + directory contract is documented single-owner; avoid new React filter layers.

### 2026-05-14T16:25:00Z checkpoint
- Summary: **R2 —** **`resolveAuthorEvidencePubkeysFromCommunityMessages`** in **`community-visible-members.ts`**; **`group-home-page-client`** + **`group-management-dialog`** use it; **`community-visible-members.test.ts`** +1. **`docs/encyclopedia/12-core-architecture-truth-map.md`**, **`14-module-owner-index.md`**, queue last updated. **`pnpm exec vitest run`** **`community-visible-members.test.ts`** (11); **`pnpm exec tsc --noEmit`** (apps/pwa); **`pnpm docs:check`**; handoff + checkpoints.
- Next: R2 full exit still blocked on durable OR-set + truth-map owner row; **`group-provider`** snapshot vs refresh if runtime surfaces gaps.

### 2026-05-14T16:20:00Z checkpoint
- Summary: **R2 —** **`useStableCommunityParticipantPubkeys`**: ref-sync + **`stabilizeCommunityMemberPubkeys`** extracted from **`group-home-page-client`** and **`group-management-dialog`**; **`community-visible-members`** JSDoc cross-link. Vitest use-sealed-community integration + **`group-provider`** + **`community-visible-members`**; **`pnpm exec tsc --noEmit`** (apps/pwa); handoff + checkpoints.
- Next: R2 truth-map / queue exit when roster read model is documented single-owner; optional **`group-home-page-client`** further shrink.

### 2026-05-14T16:10:00Z checkpoint
- Summary: **R2 —** **`group-management-dialog`**: canonical **`useSealedCommunity`** (same module as **`group-home-page-client`**); removed **`use-sealed-community-fixed.ts`** (unused second CRDT surface on hook return). Dropped redundant **`knownParticipantRegistry`** memo; **`pnpm exec vitest run`** use-sealed-community integration + **`group-provider.test.tsx`**; **`pnpm exec tsc --noEmit`** (apps/pwa); handoff + checkpoints.
- Next: R2 queue — shrink **`group-home-page-client`** stabilization once read-model is single-path; snapshot vs refresh.

### 2026-05-14T16:05:00Z checkpoint
- Summary: **R2 —** **`community-member-snapshot-policy.ts`**: evidence-accurate **`policyReasonCode`** when relay snapshots are rejected or not tensioned (**`relay_evidence_relax_blocked_protected_member`**, **`relay_evidence_warming_up_strict`**, **`relay_evidence_partial_eose_strict`**, **`relay_evidence_confident`**); removes misleading **`relay_evidence_seed_only_allowing_thinner`** on non-relaxed paths. **`community-member-snapshot-policy.test.ts`** (+ **`warming_up` strict**, **`partial_eose` strict** cases). Vitest snapshot + relay-evidence policy; **`pnpm exec tsc --noEmit`** (apps/pwa); checkpoints + handoff.
- Next: R2 snapshot vs refresh convergence per queue; R1 read-model assembler when prioritized.

### 2026-05-13T23:30:00Z checkpoint
- Summary: **R1 —** **`dm-conversation-displayable-message.ts`**: **`isVoiceCallSignalPayload`** + **`isDisplayableDmConversationMessage`** deduped from **`use-conversation-messages`** and **`dm-conversation-hydrate-read-model`** (identical implementations removed). **`dm-conversation-displayable-message.test.ts`** (6). **`14-module-owner-index.md`**, **`dm-conversation-hydrate-indexed-map-rows.ts`** comment, handoff.
- Next: R1 single read-model assembler + truth-map row.

### 2026-05-13T23:00:00Z checkpoint
- Summary: **R1 —** **`dm-conversation-normalize-message.ts`**: **`normalizeDmConversationMessageRow`** moved from **`use-conversation-messages`**; **`applyBufferedEvents`** + hydrate map-rows + projection evidence + sibling diagnostics + **`loadEarlier`** call the service. **`dm-conversation-normalize-message.test.ts`** (5). Comments on **`dm-conversation-hydrate-indexed-scan.ts`** / **`dm-conversation-hydrate-indexed-map-rows.ts`**; **`14-module-owner-index.md`**, queue, handoff.
- Next: R1 single read-model assembler + truth-map row; **`pnpm docs:check`** after doc edits.

### 2026-05-13T22:15:00Z checkpoint
- Summary: **R1 —** **`dm-conversation-projection-live-merge.ts`**: **`mergeProjectionFirstWithLiveOverlayForDisplay`** + **`areMessageListsEquivalentById`** extracted from **`use-conversation-messages`** projection merge effect; effect **`conversationAliasIdSet`** dependency added. **`dm-conversation-projection-live-merge.test.ts`** (6). Docs: **`14-module-owner-index.md`**, **`v1.5.0-architecture-refactor-queue.md`**, **`v1.5.0-refactor-checkpoints.md`**, handoff.
- Next: R1 single read-model assembler + truth-map row; **`pnpm docs:check`** after doc edits.

### 2026-05-14T17:30:00Z checkpoint
- Summary: **R1 —** `dm-read-authority-migration-bridge`: added **`buildMigrationDmReadAuthorityParams`**, **`legacyProjectionEvidenceMessageCount`**, **`resolveHydrationMessagesViaDmReadBridge`**; fixed **`selectMessagesViaBridge`** / **`resolveDmReadAuthorityViaBridge`** to use same allow-flags as legacy (was incorrectly narrowing from post-resolve `authority.source`). **`use-conversation-messages`** `hydrateHistory` uses bridge when **`normalizedPublicKeyHex`** set, else legacy + materialization select. Vitest **`dm-read-authority-migration-bridge.test.ts`** (2). **`pnpm exec tsc --noEmit`** (apps/pwa) green. Docs: **`v1.5.0-refactor-checkpoints.md`**, **`v1.5.0-architecture-refactor-queue.md`** (Last updated), handoff.
- Next: R1 truth-map row + eliminate no-pubkey legacy branch if safe; R2 OR-set.

### 2026-05-14T16:00:00Z checkpoint
- Summary: **Docs / process:** Added **`docs/program/v1.5.0-refactor-verification-and-docs-policy.md`** (defer client + manual A/B until R1/R2 + truth-map exit; checkpoint checklist: handoff, **`docs/program/v1.5.0-refactor-checkpoints.md`**, queue bump, **`pnpm docs:check`**). Added **`docs/program/v1.5.0-refactor-checkpoints.md`** running log. Updated **`docs/program/v1.5.0-architecture-refactor-queue.md`**, **`docs/encyclopedia/08-maintainer-playbook.md`** (review stamp 0406143c), **`docs/handoffs/current-session.md`**.
- Next: R1 **`dm-read-authority-contract`** migration path; R2 OR-set; append this log on each future checkpoint.

### 2026-05-14T15:15:00Z checkpoint
- Summary: **R1 —** `conversation-message-materialization.ts` adds **`selectMessagesForConversationHistoryAuthority`** (maps legacy authority decision → one of projection / persisted / indexed layers) and **`capMessageListToSoftLiveWindow`**. **`use-conversation-messages`** `hydrateHistory` uses them instead of inline ternary + slice. Vitest materialization file **8** tests; **`pnpm exec tsc --noEmit`** (apps/pwa) green.
- Next: **`dm-read-authority-contract`** parity + replace **`resolveConversationHistoryAuthority`** call path; R2 OR-set.

### 2026-05-14T15:05:00Z checkpoint
- Summary: **R1 — materialization module:** `conversation-message-materialization.ts` implements projection-first vs hydrated-first merge semantics + `filterMessagesBySuppressedIds`. **`use-conversation-messages`** uses it for projection overlay and post-hydrate live union; **`applyBufferedEvents`** / **`loadPersistedConversationFallbackMessages`** aligned on **`isMessageIdentityInSuppressedIdSet`**. Vitest **`conversation-message-materialization.test.ts`** (6). **`pnpm exec tsc --noEmit`** (apps/pwa) green.
- Next: Lift authority selection + hydrate batch into one read-model owner if still duplicated; R2 OR-set.

### 2026-05-14T14:30:00Z checkpoint
- Summary: **R1 slice:** added `conversation-message-visibility.ts` (`isMessageIdentityInSuppressedIdSet`, `isAccountProjectionTimelineEntrySuppressed`); wired `use-conversation-messages` + `account-projection-selectors`. **R2-adjacent:** `community-member-snapshot-policy` uses `[...raw]` for `protectRemovalPubkeys` (Set/array). **Hygiene:** `incoming-dm-event-handler` log context uses `null` for missing `relayUrlHint`; integration + dual-subscriber + relay-pool + storage-ports + relay-recovery tests adjusted so **`pnpm exec tsc --noEmit`** (from `apps/pwa`) is green.
- Next: Single ordered read-model merge for R1 exit; R2 durable OR-set read path per refactor queue.

### 2026-05-13T15:58:00Z checkpoint
- Summary: Landed **Phase 3 M4** deterministic coordinator replay coverage in **`apps/pwa/app/features/groups/services/community-phase3-m4-membership-replay.test.ts`**: `runtime_invite_accepted` → visible joined membership + `runtime_join_confirmed`; ledger-only cold start (`hydratedFromLedgerOnlyCount`); sequential accept-then-restart-on-saved-ledger; leave terminal then stale invite-accept suppressed (`runtimeJoinSuppressedByTerminalCount`). Evidence: `pnpm exec vitest run app/features/groups/services/community-phase3-m4-membership-replay.test.ts` (4/4).
- Next: M4 offline/reconnect slices against ingress/bridge; Phase 3 gate checklist pass with evidence; dual-owner trim per scope doc.

### 2026-05-13T14:05:00Z checkpoint
- Summary: **Product priority reset:** roadmap completion and **client-side verification** of core behavior come before establishing comprehensive automated testing specs or large regression suites; security sanity-check before investing in new tests. Handoff **Next Atomic Step** updated accordingly.
- Next: Resume **v1.5.0 Phase 3** roadmap work from scope/plan docs; smoke affected surfaces after each slice.

### 2026-05-13T13:40:00Z checkpoint
- Summary: Completed M2 **discovery / search / settings / vault / notifications / invites / desktop** localStorage key sweep: all touched modules now pass **`getScopedStorageKey(base, getResolvedProfileId())`** (or equivalent) — **`discovery-cache`**, **`resolved-identity-cache`**, **`use-peer-trust`** debug flag, **`vault-media-grid`**, **`search-page-client`** recent searches, **`notification-storage-key`**, **`account-sync-status-store`**, **`use-theme`**, **`use-auto-lock`**, **`use-accessibility-preferences`**, **`privacy-settings-service`**, **`use-profile`**, **`pin-lock-service`**, **`profile-manager`**, **`use-invites`**, **`security-enhancements` SecureStorage**, **`use-relay-pool`** / **`use-dev-mode`**, **`offline-manager`**, **`connection-request-service`**. Removed duplicate **`getResolvedProfileId`** import in **`search-page-client`**. **`pnpm run build`** (apps/pwa) success.
- Next: Optional test assertion cleanup for **`getScopedStorageKey(base)`**; then A/B + membership evidence per Phase 3 plan.

### 2026-05-13T13:22:00Z checkpoint
- Summary: M2 relay + navigation persistence now uses **`getScopedStorageKey(..., getResolvedProfileId())`** (or explicit **`profileId`**) instead of ambient registry defaults: **`nip65-service`** cache; **`use-relay-list`** storage key + **`loadRelayListFromStorage` / `saveRelayListToStorage` (optional `profileId`)** with hook deps on resolved profile; **`invite-manager`** relay list read path; **`account-rehydrate-service`**, **`encrypted-account-backup-service`**, **`restore-materialization`** relay list I/O scoped to restore **`profileId`**; **`relay-persistence`** (desktop); **`use-invite-redemption`** invite-sent marker; **`main-shell`** last-chat restore key (last-page key was already resolved-scoped). Verified **`use-relay-list.test`**, **`nip65-service.test`**, **`pnpm run build`** (apps/pwa).
- Next: Continue single-arg **`getScopedStorageKey`** sweep for discovery/search/settings/vault modules listed in Next Atomic Step.

### 2026-05-13T16:35:00Z checkpoint
- Summary: **`notification-target-preference`** now scopes DM/group preference keys with **`getScopedStorageKey(..., profileId ?? getResolvedProfileId())`** (via **`resolvePreferenceProfileId`**) instead of ambient **`readRegistryBackedActiveProfileId()`** alone. **`subscribeNotificationTargetPreferenceChanges`** filters **`storage`** events by **`::${profileId}`** suffix when the key contains `::`. Call sites updated: **`ChatHeader`**, **`group-home-page-client`**, **`group-management-dialog`**, **`DesktopNotificationHandler`**. Tests: **`notification-target-preference.test.ts`**, **`chat-header.test.tsx`**, **`desktop-notification-handler.test.tsx`**; **`pnpm run build`** (apps/pwa) success.
- Next: Continue M2 sweep for other single-arg **`getScopedStorageKey`** persistence (relay lists, main-shell navigation hints, etc.).

### 2026-05-13T12:14:00Z checkpoint
- Summary: **`profile-transport-queue`** no longer relies on ambient registry for scoped localStorage keys. Queue instances are keyed by the fully resolved storage string (`getScopedStorageKey(..., profileId ?? getResolvedProfileId())`); **`useProfileTransportQueue(scopeKey, profileId)`** and **`getProfileTransportQueue`** accept optional **`profileId`**. **`enhanced-dm-controller`** passes **`runtimeSnapshot.session.profileId`** so transport queue persistence aligns with window runtime scope when it diverges from **`readRegistryBackedActiveProfileId()`**. Verified with **`pnpm run build`** (apps/pwa, success).
- Next: Same pattern for **`notification-target-preference`** storage helpers (optional `profileId` on read/write + dual subscriber filters) if cross-profile bleed is observed; otherwise continue M2 callback audit.

### 2026-05-14T08:32:00Z checkpoint
- Summary: Continued Phase 3 M2 owner hardening in `GroupProvider` by removing ambient-profile ledger mutations from membership coordinator paths. `applyCoordinator*` helpers now accept/propagate explicit `profileId` and all touched call sites pass scoped profile context (leave/disband/roster-snapshot/runtime-evidence flows). `shouldMaterializeRuntimeEvidence` and snapshot recovery ledger reads were also profile-scoped to avoid cross-profile drift during reconciliation. Verified with `pnpm exec vitest run app/features/groups/providers/group-provider.test.tsx` (27/27 passing).
- Next: Continue M2 audit for remaining UI+persistence coupled paths, especially where chat-state updates and ledger mutations are still interleaved in the same callback without a single owner contract boundary.

### 2026-05-14T08:48:00Z checkpoint
- Summary: Tightened Phase 3 M2 profile scoping at the ledger service boundary: `communityMembershipLedgerInternals.setCommunityMembershipStatus` now accepts optional ledger `options` and forwards them to `upsertCommunityMembershipLedgerEntry`, so internal test helpers (and future call sites) cannot accidentally write to the wrong profile scope. Verified with `pnpm exec vitest run app/features/groups/services/community-membership-ledger.test.ts app/features/groups/services/community-scope-isolation.test.ts` (15/15 passing).
- Next: Continue scanning `features/groups` for remaining membership ledger mutations that omit explicit `profileId` (or rely on ambient `profileScopeOverride`) and route them through a single canonical mutation owner.

### 2026-05-14T09:00:00Z checkpoint
- Summary: Extended Phase 3 M2 explicit profile scoping to the “known participants” directory so cross-profile member directories cannot bleed across same-process windows. `community-known-participants-store` now accepts optional `profileId` and uses `getResolvedProfileId()` by default; `GroupProvider` passes scoped `profileId` for all reads/writes (`loadCommunityKnownParticipantsEntries`, `upsertCommunityKnownParticipantsEntry`). Verified with `pnpm exec vitest run app/features/groups/providers/group-provider.test.tsx` (27/27 passing).
- Next: Continue scanning `features/groups` for any remaining persisted group/member state keyed via `getScopedStorageKey(...)` that is still relying on ambient scope; prefer explicit `{ profileId }` threading at call sites in M2-critical flows.

### 2026-05-14T09:06:00Z checkpoint
- Summary: Continued Phase 3 M2 profile isolation in remaining local persistence helpers. `use-sealed-community` join-request pending state is now stored under `getScopedStorageKey(..., profileId)` so same-process windows do not share cooldown/pending state across profiles. `community-leave-proof-service` local cache is now scoped via `getScopedStorageKey(..., profileId)` and high-level APIs accept optional `profileId` to avoid cross-profile leave-proof bleed. `group-management-dialog` muted-members storage key now resolves scoped key with `getResolvedProfileId()`. Verified via `pnpm exec vitest run app/features/groups/services/community-leave-proof-service.test.ts app/features/groups/hooks/use-sealed-community.integration.test.ts` (37/37 passing).
- Next: Continue scanning remaining `features/groups` localStorage usage (tombstones/outbox/operation-log paths are already scoped) and ensure all writes that can occur during membership recovery/roster replay carry explicit profile scope.

### 2026-05-14T09:24:00Z checkpoint
- Summary: Finished M2 scoping pass for remaining membership-adjacent local persistence and confirmed PWA compiles. `use-sealed-community` now passes `profileId` through to `recordCommunityLeaveProof` so leave-proof caching cannot bleed across profiles. `use-community-membership-crdt` localStorage fallback is now keyed via `getScopedStorageKey(..., profileId)` (defaulting to `getResolvedProfileId`) so CRDT snapshots do not collide across profiles. Fixed two unrelated TypeScript build blockers uncovered by `next build`: corrected `community-membership-sync` Nostr type imports to `@dweb/*` and tightened `GroupAccessMode` typing in `groups/[...id]/group-home-page-client.tsx`. Verified with `pnpm run build` (success).
- Next: Continue Phase 3 M2 audit for any remaining ambient-scope persisted state in groups/messaging cross-boundaries, then proceed to the next owner-convergence slice (single canonical mutation owner during replay).

### 2026-05-14T09:29:00Z checkpoint
- Summary: Hardened operation-log replay path scoping in `community-sync-service`: relay-ingested operations now thread an explicit `profileId` into both `addOperation` and subsequent `loadOperationLog` reads, avoiding ambient-scope lookups during relay merge callbacks. Re-verified compile integrity with `pnpm run build` (success).
- Next: Continue M2 by auditing groups↔messaging boundary mutations for any remaining implicit profile resolution inside async callbacks; prefer explicit `{ profileId }` plumbing into ledger/tombstone/operation-log writes.

### 2026-05-14T09:34:00Z checkpoint
- Summary: Continued M2 async-callback scoping inside `GroupProvider` by threading explicit `profileId` into all touched tombstone writes/reads during join/leave/disband/purge flows (`isGroupTombstoned`, `removeGroupTombstone`, `addGroupTombstone`, `addGroupTombstoneFromConversationId`). This removes ambient-scope fallback risk in callback-heavy mutation paths that run during restore/replay and user-driven state transitions. Verified with `pnpm exec vitest run app/features/groups/providers/group-provider.test.tsx` (27/27 passing).
- Next: Continue scanning groups↔messaging boundary callbacks for remaining storage writes without explicit `profileId`, then move to next owner-convergence slice.

### 2026-05-14T09:40:00Z checkpoint
- Summary: Extended explicit profile scoping beyond group provider into dev/runtime tooling path that reads group tombstones. `dev-panel` now resolves `profileId` via `getResolvedProfileId()` and passes it to `loadGroupTombstones(publicKeyHex, { profileId })`, eliminating ambient-scope fallback in audit diagnostics. Re-validated full PWA compile via `pnpm run build` (success).
- Next: Continue M2 owner convergence by auditing remaining non-test consumers of group persistence surfaces (operation log, known participants, leave outbox/proof) for callback-time implicit profile resolution.

### 2026-05-14T09:43:00Z checkpoint
- Summary: Hardened CRDT persistence-key isolation for multi-profile same-process runtime. In `use-community-membership-crdt`, IndexedDB primary storage now uses the same profile-scoped key derivation as localStorage fallback (`getScopedStorageKey` via `toMembershipPersistenceKey`) instead of bare `communityId`, preventing cross-profile CRDT state collisions when both profiles share one browser process. Verified with `pnpm exec vitest run app/features/groups/hooks/use-sealed-community.integration.test.ts` (20/20 passing).
- Next: Continue M2 callback audit across groups/messaging boundaries, then define the remaining canonical-owner extraction slice for replay-time mutations.

### 2026-05-14T09:47:00Z checkpoint
- Summary: Extended explicit profile scoping on groups↔messaging boundary stores by removing implicit `getScopedStorageKey(STORAGE_KEY)` usage in two high-frequency messaging persistence modules. `failed-incoming-event-store` and `request-event-tombstone-store` now resolve storage keys via explicit `profileId` threading (optional parameter on `readState/writeState/suppress/isSuppressed/clear`, defaulting through `getResolvedProfileId`), so async consumers can pin scope deterministically. Verified with focused tests: `failed-incoming-event-store.test.ts` + `request-event-tombstone-store.test.ts` (4/4 passing), and regression coverage in `incoming-dm-event-handler.test.ts` (pass).
- Next: Continue M2 owner convergence by auditing remaining messaging stores that still call `getScopedStorageKey(STORAGE_KEY)` without explicit `profileId` threading, prioritizing request/relay evidence stores used in async pipelines.

### 2026-05-14T07:26:00Z checkpoint
- Summary: Reviewed and aligned roadmap docs for v1.5.0: Phase 2 mobile contract gate reflected as complete; Phase 3 rewritten from illustrative snippets to executable gates and milestones. Added canonical scope doc `docs/program/v1.5.0-phase3-scope.md` with in/out-of-scope, owner contract, acceptance gates, and evidence matrix.
- Next: Start Phase 3 M1 by implementing relay ingress normalization + diagnostics, then validate via focused tests before owner consolidation.

### 2026-05-14T07:40:00Z checkpoint
- Summary: Began Phase 3 M1. Added `community-membership-ingress` normalization with typed ingress channels and reject reasons; wired `community-membership-relay-bridge` to use normalized ingress verdicts and publish profile-scoped `community-membership-ingress` bus events. Extended `@dweb/core/profile-message-bus` event union and added focused tests (`community-membership-ingress.test.ts`).
- Next: Continue M1 with relay-bridge integration coverage for ingress diagnostics and then begin M2 single-owner mutation consolidation.

### 2026-05-14T08:18:00Z checkpoint
- Summary: Continued M1/M2 boundary hardening. Added `community-membership-relay-bridge.test.ts` for accepted/rejected ingress behavior and moved ingress bus publish to immediately after accepted verdict (before merge), preserving diagnostics evidence even if downstream parse/merge fails. For M2 owner convergence, removed direct `localStorage` writes from `GroupProvider.forcePurgeCommunity`; introduced canonical `replaceCommunityMembershipLedger(...)` in `community-membership-ledger` for explicit replacement semantics (non-merge) and wired purge path to scoped ledger owner API.
- Next: Continue M2 by auditing remaining `GroupProvider` mutation points that still combine UI mutation + direct persistence side-effects, then route them through a single coordinator/ledger mutation contract.

### 2026-05-13T18:45:00Z checkpoint
- Summary: **`notification-target-preference-changed`** on **`ProfileMessageBus`** (`@dweb/core`); dual dispatch from **`notification-target-preference`**; **`subscribeNotificationTargetPreferenceChangedDual`** + **`ChatHeader`** wiring; Vitest dual + isolation + chat-header. Legacy window event unchanged for cross-tab **`storage`**.
- Next: shrink other **`obscur:`** publishers/listeners; **`ChatStateStore`** factory when ready.

### 2026-05-13T18:30:00Z checkpoint
- Summary: **`single-process-profile-isolation`**: asserts same bus drops **`chat-state-replaced`** when **`event.profileId`** ≠ owner (aligns with **`packages/dweb-core` `createProfileMessageBus.publish`**).
- Next: **`ChatStateStore`** explicit deps / factory; Phase 1 **`obscur:`** shrink.

### 2026-05-13T18:05:00Z checkpoint
- Summary: **`getResolvedStoragePorts()`** + **`ProfileRuntimeScope.storagePorts`** wired from **`ProfileRuntimeProvider`**; tombstone I/O migrated off **`message-delete-tombstone-store`** in DM/receive/incoming paths, persistence, deletion coordinator, **`use-chat-actions`**, account-sync restore/backup/bootstrap; **`restore-merge-chat-state`** uses **`@dweb/storage-contracts`** for normalize. Partial Vitest mocks use **`importOriginal`** for tombstone store.
- Next: new **`StoragePorts`** slices or **`ChatStateStore`** factory + single-process test; Phase 1 grep gates when ready.

### 2026-05-13T17:00:00Z checkpoint
- Summary: **`mergeStoragePorts`** + **`ProfileRuntimeProvider` `storagePorts` partial prop**; Vitest **`default-storage-ports`**, **`profile-runtime-provider.storage-ports`**, **`message-delete-tombstones-contract-regression`**. Implementation plan: tombstone contract regression gate checked.
- Next: migrate remaining direct tombstone-store imports behind ports; **`ChatStateStore`** factory + single-process test when ready.

### 2026-05-13T16:25:00Z checkpoint
- Summary: **`useResolvedStoragePorts()`** on **`ProfileRuntimeProvider`** (falls back to **`DEFAULT_STORAGE_PORTS`**). **`MessagingProvider`** uses it for tombstone hydrate/merge; **`useConversationMessages`** uses **`messageDeleteTombstones`** port for suppress + load suppressed ids. **`docs/program/v1.5.0-implementation-plan.md`** Phase 2 DI gate marked landed for first slice; handoff updated.
- Next: optional provider **`storagePorts` override** for tests; migration regression test for tombstones slice; or **`ChatStateStore`** factory + single-process chat-store test.

### 2026-05-12T20:10:00Z checkpoint
- Summary: **`messages-index-rebuilt`** on **`ProfileMessageBus`**; **`publish`** guard extended. **`dispatchMessagesIndexRebuiltEvent`** in **`message-persistence-service`** dual-publishes migration/index rebuilds. **`subscribe-messages-index-rebuilt-dual`**; **`useVaultMedia`** uses it (with existing **`subscribeChatStateReplacedDual`**). Handoff: **Phase 2 readiness** section clarifies v1.5.0 Phase 2 = **Drizzle+SQLite** vs Phase 1 grep gates. **`single-process-profile-isolation`**: messages-index-rebuilt isolation test. Vitest: **`single-process-profile-isolation`**, **`use-vault-media.test`** pass.
- Next: Phase 2 storage slice decision, or **`ChatStateStore`** factory + single-process chat-store test.

### 2026-05-12T19:05:00Z checkpoint
- Summary: **`peer-interaction-updated`** on **`ProfileMessageBus`**; **`publish`** guard extended. **`peer-interaction-store`** dual-publishes with **`profileId`** on **`detail`**; exported **`PEER_INTERACTION_UPDATED_EVENT`** + **`PeerInteractionUpdatedEventDetail`**. **`subscribe-peer-interaction-updated-dual`**; **`usePeerLastActiveByPeer`** uses it + **`storage`** (replaces raw window listener for same-tab updates). **`single-process-profile-isolation`**: peer-interaction isolation case. Vitest: **`peer-interaction-store.test`**, **`single-process-profile-isolation`** pass.
- Next: **`MESSAGES_INDEX_REBUILT`**, **`notification-target-preference`**, or **`account-sync-mutation`** dual path when a single subscriber is identified.

### 2026-05-12T18:20:00Z checkpoint
- Summary: Extended **`ProfileBusDomainEvent`** with **`community-operation-log-updated`**, **`community-state-updated`**, and three CRDT window mirrors; **`publish`** profile guard covers them. Dual-publish from **`community-operation-log`** (**`saveOperationLog`**), **`community-sync-service`** (**`COMMUNITY_STATE_UPDATED_EVENT`**), **`community-membership-gossip`**, **`community-membership-relay-bridge`**. Operation log window **`detail`** now includes **`profileId`**. Removed dead **`community-operation-log`** imports / **`USE_OPERATION_LOG`** from **`group-provider`**. **`single-process-profile-isolation`**: tests for operation-log + community-state isolation. Vitest: **`single-process-profile-isolation`** pass.
- Next: add **`subscribe-*-dual`** consumers when UI/hooks need these signals on the bus; remaining **`obscur:`** publishers.

### 2026-05-12T17:45:00Z checkpoint
- Summary: Extended **`ProfileBusDomainEvent`** with account-restore (started/completed) and **`community-membership-ledger-updated`**; **`createProfileMessageBus.publish`** filters foreign **`detail.profileId`**. **`restore-materialization-events`** and **`saveCommunityMembershipLedger`** dual-publish to injected bus + window. New **`subscribe-account-restore-materialization-started-dual`**, **`...-completed-dual`**, **`subscribe-community-membership-ledger-updated-dual`**; **`GroupProvider`** uses them. **`single-process-profile-isolation.test.ts`**: isolation cases for ledger + restore completed. Vitest: **`single-process-profile-isolation`**, **`restore-materialization-events`**, **`community-membership-ledger`**, **`group-provider.test`** — pass.
- Next: migrate remaining high-churn **`obscur:`** publishers/listeners; **`ChatStateStore`** factory + single-process chat-store test when ready.

### 2026-05-12T11:25:00Z checkpoint
- Summary: **`group-removed`** domain event in **`@dweb/core`**; **`dispatchGroupRemove`** + **`GROUP_REMOVE_EVENT`** in **`profile-bus-dispatch`**; **`subscribe-group-remove-dual`** + unit test; **`GroupProvider`** uses dual subscriber; **`use-sealed-community`** uses **`dispatchGroupRemove`** on disband. **`profile-bus-dispatch.test.ts`** covers **`dispatchGroupRemove`**. **`use-sealed-community.integration.test.ts`**: fixed **`ignores disband replay`** test to install **`dispatchEvent`** spy before handlers run (was measuring too late). Full integration file still shows unrelated **`members`** timeouts in this environment — treat as pre-existing / env unless reproduced on CI.
- Next: **`obscur:`** window shrink for **`group-invite`** / **`group-membership-confirmed`** / snapshots when safe; **`ChatStateStore`** factory + single-process test.

### 2026-05-12T10:42:00Z checkpoint
- Summary: **`subscribeGroupInviteAcceptedDual`** added (coalesced bus + window); **`GroupProvider`** uses **`subscribeChatStateReplacedDual`** for chat-state hydrate and dual helper for invite-accepted (removed inline duplicate listeners / pending ref). **`MessagingProvider`** chat-state hydrate uses **`subscribeChatStateReplacedDual`**. Hydration/visibility tests: extend **`messagePersistenceService`** mock with **`bindProfileBusChatStateReplaced`**.
- Next: shrink **`obscur:`** window surface; optional **`ChatStateStore`** factory + fuller single-process test.

### 2026-05-12T10:35:00Z checkpoint
- Summary: Finished PWA production migration from **`getActiveProfileIdSafe`** to **`getResolvedProfileId`** across auth, account-sync, search, main-shell hooks, messaging (incoming handler, v2 DM/receive/delete coordinator), groups community modules, vault CAS recovery, encrypted backup / rehydrate paths; updated **`identity-profile-binding`**, **`session-api`**, **`auth-storage-keys`**, **`message-deletion-coordinator`** tests for **`getResolvedProfileId`** mocks. **`apps/pwa/eslint.config.mjs`**: **`no-restricted-imports`** for **`getActiveProfileIdSafe`** is now **error** (exemptions unchanged). Vitest on touched suites: pass.
- Next: optional **`subscribeChatStateReplacedDual`** in messaging/group providers; reduce **`window`** obscur listeners as consumers move bus-only; optional test mock cleanup.

### 2026-05-12T10:25:00Z checkpoint
- Summary: main-shell + settings migrated to `getResolvedProfileId`; ESLint warn on `getActiveProfileIdSafe` import; `single-process-profile-isolation.test.ts` added.
- Next: Batch-migrate remaining profile-scope safe usages; optional subscribeChatStateReplacedDual in messaging/group providers.

### 2026-05-12T10:15:00Z checkpoint
- Summary: `subscribe-chat-state-replaced-dual` helper; `use-peer-trust`, `use-conversation-messages`, `use-vault-media` dual-subscribe + coalesce; `MessagePersistenceService` queue + `bindProfileBusChatStateReplaced` from `MessagingProvider`; profile scopes use `getResolvedProfileId` where touched.
- Next: ESLint gate for `getActiveProfileIdSafe`; shrink duplicate chat-state listener wiring in `messaging-provider`/`group-provider` toward shared helper if desired.

### 2026-05-12T10:06:00Z checkpoint
- Summary: Phase 1 roadmap continuation — profile bus invite-accepted dual dispatch, messaging + groups subscribe to chat-state-replaced on bus with coalesce; GroupProvider migrated to `getResolvedProfileId()`.
- Next: Migrate remaining CHAT_STATE_REPLACED listeners (peer-trust, message-persistence, conversation-messages, vault); then invite-accepted bus-only consumer once double-handler risk is eliminated.

### 2026-05-07T14:52:14Z checkpoint
- Summary: Compacted oversized current-session handoff. Archived the full 4410-line pre-compaction file and replaced the live handoff with a concise state focused on DM delete-for-everyone runtime convergence.
- Evidence: Archive path created at `docs/archive/handoffs/current-session-archive-2026-05-07-pre-compaction.md`; live handoff rewritten to compact format.
- Uncertainty: Runtime root cause of sender-only deletion remains unresolved.
- Next: Trace recipient runtime delete path from command receipt through coordinator ingestion, tombstone storage, and UI message filtering.
### 2026-05-07T15:10:36Z checkpoint
- Summary: Added diagnostic-only instrumentation for DM delete-for-everyone A/B replay. Sender logs request/publish; receive pipeline logs decrypt/parse; controller logs receive classification, coordinator result, and UI apply; coordinator logs decode/scope/permission/duplicate/store outcomes. Focused tests and typecheck pass.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run manual two-user A/B replay on dev server and collect window.obscurAppEvents findByName outputs for messaging.delete_for_everyone_requested, messaging.delete_for_everyone_rejected, and messaging.delete_for_everyone_remote_result from both sender and recipient.
### 2026-05-07T15:29:14Z checkpoint
- Summary: Identified why B had no matching v2 delete logs: live DM UI appears to route through enhanced-dm-controller/incoming-dm-event-handler, while earlier instrumentation/fix targeted v2. Patched shared parseDeleteCommand to support __dweb_cmd__delete: message_delete_v1 and updated incoming-dm-event-handler production path to use it, with enhanced_receive_parse/enhanced_delete_apply/enhanced_ui_apply diagnostics. Added regression test. Typecheck and 56 focused tests pass.
- Evidence: not provided
- Uncertainty: not provided
- Next: Manual A/B retest on dev server. On B, inspect window.obscurAppEvents.findByName('messaging.delete_for_everyone_remote_result', 80) for enhanced_receive_parse, enhanced_delete_apply, and enhanced_ui_apply after A deletes a confirmed DM.
### 2026-05-07T15:36:41Z checkpoint
- Summary: Corrected A/B interpretation: prior screenshots were sender A; B returned empty delete diagnostics. Added central dm-subscription-manager diagnostics for subscription_started and subscription_event_received before decrypt/parse so B can prove whether the incoming subscription is mounted and whether any relay event reaches the browser. Focused tests/typecheck pass.
- Evidence: not provided
- Uncertainty: not provided
- Next: Manual A/B retest after reloading the bundle with the post-decrypt dedup fix. On B, verify raw events no longer end at `dm_process_result`/`already_processed`; expected next evidence is `dm_receive_parse` with `versioned_delete`, followed by `dm_receive_classified` and `dm_ui_apply`.
### 2026-05-07T16:01:09Z checkpoint
- Summary: Found actual global runtime transport owner uses v2 useDmController via RuntimeMessagingTransportOwnerProvider and controllers/v2/dm-relay-transport, not dm-subscription-manager. Added v2_subscription_started and v2_subscription_event_received diagnostics at the v2 relay transport boundary. Typecheck passes.
- Evidence: not provided
- Uncertainty: not provided
- Next: Manual A/B retest after bundle reload. On B, first look for v2_subscription_started in window.obscurAppEvents.findByName('messaging.delete_for_everyone_remote_result', 80). After A deletes a confirmed DM, check for v2_subscription_event_received, dm_receive_parse, dm_receive_classified, and dm_ui_apply.
### 2026-05-07T16:04:52Z checkpoint
- Summary: B-side evidence now shows v2_subscription_started and v2_subscription_event_received, proving B is subscribed and raw relay events reach v2 transport. Added dm_process_result diagnostic after processIncomingEvent to classify each received event as skipped/message/self_echo/delete with reason. Typecheck passes.
- Evidence: not provided
- Uncertainty: not provided
- Next: Manual A/B retest after bundle reload. On B, inspect messaging.delete_for_everyone_remote_result for dm_process_result entries corresponding to v2_subscription_event_received events, especially skipped reasons or delete action, then continue to dm_receive_parse/dm_receive_classified/dm_ui_apply.
### 2026-05-07T16:11:27Z checkpoint
- Summary: Fixed root cause indicated by B evidence: v2 process result was skipped already_processed after raw relay receipt. Moved receive-pipeline dedup to after successful decrypt and keyed it by decrypted canonical event/rumor ID. Added regression test that decrypt failures do not poison processed cache. Typecheck and focused tests pass.
- Evidence: not provided
- Uncertainty: not provided
- Next: Manual A/B retest after reloading bundle. On B, verify raw events no longer end at dm_process_result/already_processed; expected next evidence is dm_receive_parse versioned_delete, dm_receive_classified, then dm_ui_apply.
### 2026-05-07T16:40:01Z checkpoint
- Summary: Latest B evidence showed delete event classified as normal message, not delete. Added dm_receive_plaintext_classified diagnostic after decrypt to show whether plaintext contains delete_prefix, legacy_command_delete, or normal_plaintext. Fixed import conflicts and type errors. Typecheck and focused tests pass.
- Evidence: not provided
- Uncertainty: not provided
- Next: Manual A/B retest after reloading bundle. On B, query for dm_receive_plaintext_classified entries to see whether the decrypted plaintext is recognized as a delete command.
### 2026-05-07T17:03:00Z checkpoint
- Summary: B evidence showed delete event decrypted as normal_plaintext, not delete_prefix. This proves sender is not encrypting a delete command. Added dm_sender_plaintext_fingerprint diagnostic before sendDm to log whether commandPayload contains delete_prefix_present. Typecheck and focused tests pass.
- Evidence: not provided
- Uncertainty: not provided
- Next: Manual A/B retest after reloading bundle. On A, query for dm_sender_plaintext_fingerprint to see whether sender is actually encoding a delete command. If it shows normal_plaintext, the sender is not using the v2 delete path.
### 2026-05-07T17:32:43Z checkpoint
- Summary: Root cause: delete command missing #p tag. V2 relay transport subscription filter requires #p: [myPublicKeyHex] to receive incoming DMs. Without this tag, B's subscription won't match the delete command event. Fixed by adding ["p", delParams.peerPublicKeyHex] to delete command publish customTags. Typecheck and focused tests pass.
- Evidence: not provided
- Uncertainty: not provided
- Next: Manual A/B retest after reloading bundle with the #p tag fix. B should now receive the delete command event because the subscription filter will match the #p tag. Verify B receives dm_receive_plaintext_classified with delete_prefix and dm_receive_parse with versioned_delete.
### 2026-05-08T04:20:08Z checkpoint
- Summary: Confirmed a second deadlock behind sender-only delete behavior: canonical deletion tombstones (`features/messaging/deletion/*`) and restore-visible tombstones (`features/messaging/services/message-delete-tombstone-store.ts`) are still separate systems. Added a narrow bridge so canonical delete/create/ingest also writes durable suppression ids with explicit `profileId`. Added focused assertions for coordinator-created durability and backup/export suppression.
- Evidence: `cmd /c pnpm -C apps/pwa exec vitest run app/features/messaging/deletion/message-deletion-coordinator.test.ts app/features/messaging/controllers/v2/dm-receive-pipeline.test.ts app/features/account-sync/services/encrypted-account-backup-service.test.ts`
- Uncertainty: The new focused failures show the bridge is not yet observably surfacing through `loadMessageDeleteTombstoneEntries(...)`, so durable non-resurrection is still not proven end-to-end.
- Next: Fix the remaining legacy suppression visibility gap in focused tests, then rerun the deletion + backup slices before the manual A/B runtime retest.
### 2026-05-08T05:42:09Z checkpoint
- Summary: Removed the overlapping DM local-delete path from `apps/pwa/app/features/main-shell/hooks/use-chat-actions.ts`, making the DM controller the single canonical owner for DM delete-for-everyone. Also fixed the remaining durability/export gap by making backup payload build read delete tombstones with explicit profile scope and hardening delete-command/tombstone id generation against missing `crypto.randomUUID()` in mixed runtimes.
- Evidence: `cmd /c pnpm -C apps/pwa exec vitest run app/features/main-shell/hooks/use-chat-actions.delete-targets.test.ts app/features/messaging/deletion/message-deletion-coordinator.test.ts app/features/messaging/controllers/v2/dm-receive-pipeline.test.ts app/features/account-sync/services/encrypted-account-backup-service.test.ts`
- Uncertainty: Runtime A/B behavior is still unverified; the focused slices now prove command parsing, coordinator storage, backup tombstone export, and non-resurrection filtering, but do not yet prove recipient B UI convergence on a live relay replay.
- Next: Reload the updated bundle and run the manual A/B replay. On B, verify `v2_subscription_event_received`, `dm_receive_plaintext_classified`, `dm_receive_parse`, `dm_receive_classified`, and `dm_ui_apply` all occur for the delete event. Then verify a backup/export/restore path does not resurrect the deleted row.
### 2026-05-09T04:40:01Z checkpoint
- Summary: Fixed 4 stale reason-string expectations in dm-receive-pipeline.test.ts that drifted from production code. Production now returns: dedup (was already_processed), decrypt failed / raw error message (was decrypt_failed:...), blocked (was blocked_sender), no_peer_pubkey (was invalid_event). 3 focused files, 91 tests now pass. Typecheck clean.
- Evidence: not provided
- Uncertainty: not provided
- Next: Manual A/B retest after reloading the updated bundle. On B, verify v2_subscription_event_received, dm_receive_plaintext_classified with delete_prefix, dm_receive_parse with versioned_delete, and dm_ui_apply for the delete event after A deletes a confirmed DM.
### 2026-05-11T15:21:53Z checkpoint
- Summary: Added diagnostic logging to trace community invite/response message rendering
- Evidence: not provided
- Uncertainty: not provided
- Next: Test the fixes in the actual PWA and verify: 1) Invite messages render as cards not raw JSON, 2) Member roster updates correctly, 3) Community chat shows correct history
### 2026-05-11T16:00:36Z checkpoint
- Summary: Fixed raw JSON showing for community invite messages by adding fallback payload parsing in MessageList
- Evidence: not provided
- Uncertainty: not provided
- Next: Test the PWA to verify: 1) Community invite cards render without raw JSON below, 2) Invite accept flow works correctly, 3) Member roster updates after accept
### 2026-05-11T16:17:20Z checkpoint
- Summary: Identified architectural flaw: membership sync relies on fragile DMs instead of durable relay events. Created design docs for relay-based gossip sync solution.
- Evidence: not provided
- Uncertainty: not provided
- Next: Implement Phase 1: Subscribe to NIP-29 membership events in Group Provider to process join/leave events from relay
### 2026-05-12T13:55:00Z checkpoint
- Summary: Messaging M2 scope pass: `sync-checkpoints` in-memory map + localStorage are profile-scoped (no single global `Map` across profiles). `peer-relay-evidence-store`, `invitation-sender-profile-tag`, `m10-shared-intel-policy` accept optional `profileId` / pass runtime scope from DM controller paths; account backup/bootstrap restore pass explicit profile into checkpoint loaders; v2 `sendDm` passes `profileId` into relay URL resolution.
- Evidence: `pnpm -C apps/pwa exec vitest run app/features/messaging/lib/sync-checkpoints.test.ts app/features/messaging/services/peer-relay-evidence-store.test.ts app/features/messaging/services/m10-shared-intel-policy.test.ts app/features/messaging/controllers/dm-sync-orchestrator.test.ts app/features/messaging/services/invitation-sender-profile-tag.test.ts`; `pnpm -C apps/pwa run build`
- Uncertainty: Callers that omit optional `profileId` still resolve via `getResolvedProfileId()` inside stores — correct for single-window default, but long-lived workers should pass explicit scope when added later.
- Next: Audit remaining messaging stores (`request-flow-evidence`, NIP-96 upload key, etc.) for the same explicit-scope pattern.
### 2026-05-12T22:08:00Z checkpoint
- Summary: Completed M2 follow-up: `request-flow-evidence-store` keys + APIs take optional `profileId` (default `getResolvedProfileId()`); backup/bootstrap/existing callers wired; `getNip96StorageKey(profileId?)` uses resolved scope; `peer-interaction-store` scopes account+profile keys; UI/hooks (`network-profile-view`, `use-peer-last-active-by-peer`, v2 runtime transport owner) pass explicit profile where available.
- Evidence: `pnpm -C apps/pwa exec vitest run app/features/messaging/services/request-flow-evidence-store.test.ts app/features/messaging/services/peer-interaction-store.test.ts app/features/messaging/providers/runtime-messaging-transport-owner-provider.test.tsx app/features/messaging/controllers/incoming-dm-event-handler.test.ts app/features/search/hooks/use-contact-request-outbox.chaos.test.ts`; `pnpm -C apps/pwa run build`
- Uncertainty: `request-transport-service` still omits `profileId` on evidence mutations — acceptable because store defaults to `getResolvedProfileId()` at mutation time.
- Next: Optional deeper audit of outbox/contact-request storage keys vs injected runtime (same pattern as request-flow).
### 2026-05-14T17:01:36Z checkpoint
- Summary: R1: docs-check fixed stale backtick refs to deleted conversation-history-authority.ts in docs/rewrite workstreams; handoff/checkpoints/queue aligned; tsc + vitest (authority slice) + docs:check green.
- Evidence: `cd apps/pwa && pnpm exec tsc --noEmit`; `pnpm exec vitest run .../conversation-history-authority.test.ts .../dm-read-authority-contract.test.ts .../use-conversation-messages.integration.test.ts` (68 tests); `pnpm docs:check` at repo root.
- Uncertainty: not provided
- Next: R1 truth-map exit: single materialization read-model owner per (profileId, conversationId).
### 2026-05-14T17:11:06Z checkpoint
- Summary: R1: folded conversation-history-authority-shared into dm-read-authority-contract; materialization uses import type from contract; deleted shared module; docs + HEURISTIC + rewrite lists updated; tsc + 76 vitest + docs:check green.
- Evidence: `cd apps/pwa && pnpm exec tsc --noEmit`; `pnpm exec vitest run app/features/messaging/services/dm-read-authority-contract.test.ts app/features/messaging/services/conversation-history-authority.test.ts app/features/messaging/services/conversation-message-materialization.test.ts app/features/messaging/hooks/use-conversation-messages.integration.test.ts` (76 tests); `pnpm docs:check` at repo root.
- Uncertainty: not provided
- Next: R1 truth-map exit: single materialization read-model owner per (profileId, conversationId).
### 2026-05-14T17:14:27Z checkpoint
- Summary: R1 doc triage: refactor queue interim vs exit; truth-map R1 bullet names materialization; module index splits DM hydrate choke vs hook assembler; handoff Next step numbering + evidence.
- Evidence: `pnpm docs:check` at repo root (117 markdown files).
- Uncertainty: not provided
- Next: R1 code: extract single read-model assembler from use-conversation-messages (IndexedDB+overlay+suppression) or converge paths per queue.
### 2026-05-14T17:29:08Z checkpoint
- Summary: R1: added dm-conversation-hydrate-read-model.ts (assembleDmHydrateThreadReadModel); use-conversation-messages hydrate calls it after IDB scan; getMessageDirectionCounts + toConversationIdDiagnosticLabel exported from read-model; 2 unit tests; docs queue/14/12 updated.
- Evidence: `cd apps/pwa && pnpm exec tsc --noEmit`; `pnpm exec vitest run app/features/messaging/services/dm-conversation-hydrate-read-model.test.ts app/features/messaging/hooks/use-conversation-messages.integration.test.ts app/features/messaging/services/dm-read-authority-contract.test.ts app/features/messaging/services/conversation-history-authority.test.ts` (70 tests); `pnpm docs:check` at repo root.
- Uncertainty: not provided
- Next: R1: move IndexedDB scan + mapRows into read-model boundary or further thin hook per queue exit.
<!-- CONTEXT_CHECKPOINTS_END -->
