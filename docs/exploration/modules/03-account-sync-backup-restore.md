# Module 3 — Account sync & backup restore

_Last reviewed: 2026-06-02 (baseline commit 7f84f813)._

**Status:** v1 complete (first-pass audit)  
**Last updated:** 2026-06-02  
**Scope:** `apps/pwa/app/features/account-sync/` + restore-adjacent paths in messaging, groups, vault, profiles, runtime

---

## 1. Scope

**Primary path:** `apps/pwa/app/features/account-sync/` — **~64** TS files, **~12k prod LOC** (~21k total with tests).

| Subfolder | ~Files | Owns |
|-----------|--------|------|
| `services/` | ~52 | Backup publish/restore, merge orchestration, projection runtime/store, bootstrap, CRDT sync protocol, diagnostics |
| `hooks/` | 6 | `useAccountSync`, projection/sync snapshots |
| Root | 2 | `account-sync-contracts.ts`, `account-event-contracts.ts` |

**Largest prod files:**

| File | ~LOC | Role |
|------|------|------|
| `services/encrypted-account-backup-service.ts` | 1,816 | Truth map row 7 — publish, fetch, merge, apply restore |
| `services/restore-merge-module.ts` | 844 | `orchestrateRestoreMerge`, ledger/room-key reconciliation |
| `services/restore-merge-chat-state.ts` | 833 | `mergeChatState`, tombstone sanitization, native body strip |
| `hooks/use-account-sync.ts` | 681 | Truth map row 8 — auto publish/restore loops |
| `services/account-event-bootstrap-service.ts` | 669 | P3c seal-only vs full import |
| `services/account-projection-runtime.ts` | 591 | Event log bootstrap + replay owner |

**Adjacent restore paths (outside feature root):**

| Path | Role |
|------|------|
| `runtime/components/runtime-activation-manager.tsx` | Mounts `useAccountSync` |
| `profiles/services/unified-account-export-service.ts` | Portable + workspace export/import |
| `vault/services/cas-media-recovery.ts` | Post-restore media relink |
| `messaging/services/chat-state-store.ts` | Restore write target (mirror) |
| `groups/services/community-membership-ledger.ts` | Ledger merge on restore |
| `groups/services/community-leave-proof-service.ts` | Relay leave-proof enrichment before apply |
| `shared/account-sync-mutation-signal.ts` | Mutation → backup publish trigger |

**Scale vs other modules:**

| Module | Prod LOC | Note |
|--------|----------|------|
| Account-sync (M3) | ~12k | One file ≈ 15% of prod code |
| Messaging (M2) | ~56k | Distributed |
| Groups (M1) | ~36.5k | Two mega-files |

Test ratio is **high** (~46% of total LOC) — driven by `encrypted-account-backup-service.test.ts` (~4.9k LOC).

---

## 2. Stated contract (canonical docs)

| Claim | Source |
|-------|--------|
| Row 7 — backup publish/restore: `encrypted-account-backup-service.ts` | Truth map |
| Row 8 — sync orchestration: `use-account-sync.ts` | Truth map |
| Row 9 — chat-state: native UI mirror only, not message authority | Truth map + native SQLite policy |
| P3c — native bootstrap: seal-only (tombstones + peer trust); no full DM timeline import | Native policy bands |
| P5-BKP-1 — native restore must not dual-write DM bodies into chat-state authority | `p5-persistence-survival-contract.md` |
| Subtraction queue #3 — gate backup/chat-state DM body merge on native restore | P5 + native policy |
| Invariant #4 — restore cannot silently shrink self-authored history | Truth map |
| Required diagnostics: `backup_restore_merge_diagnostics`, `backup_restore_apply_diagnostics` | Truth map |
| ACC-01 — delete-for-me across refresh/restore on open Nostr: accepted limitation | Design goals §6 |

---

## 3. As-built ownership

### 3.1 Encrypted backup **create / export**

| Entry point | Production? | Notes |
|-------------|-------------|-------|
| `encrypted-account-backup-service.ts` → `publishEncryptedAccountBackup` | Yes | Kind `30078`, d-tag `obscur-account-backup` |
| `buildBackupPayload` / `buildBackupPayloadWithHydratedChatState` | Internal | Reads chat-state, ledger, tombstones, relays, profile — **no SQLite DM read** |
| `use-account-sync.ts` → `maybePublishBackup` | Yes | Startup, 2m interval, visible, pagehide, mutation signals |
| `unified-account-export-service.ts` | Yes | Portable file bundle |

**Publish sources:** profile, peer trust, request flow, sync checkpoints, `chatState`, `communityMembershipLedger`, `roomKeys`, tombstones, settings.

On native, `buildBackupPayloadWithHydratedChatState` skips `chatStateStoreService.hydrateMessages`. `hydrateChatStateFromIndexedMessages` is a **no-op stub** (returns input unchanged).

### 3.2 Backup **restore apply**

| Entry point | Production? | Notes |
|-------------|-------------|-------|
| `restoreEncryptedAccountBackup` | Yes | Fetch relay → leave-proof enrichment → merge → apply |
| `mergeIncomingRestorePayload` → `orchestrateRestoreMerge` | Internal | Tombstones, `mergeChatState`, ledger, room keys |
| `applyBackupPayload` | Legacy v1 | Full apply; native strips bodies first |
| `applyBackupPayloadNonV1Domains` → `applyNonV1RestoreMaterialization` | **Canonical** when projection append provided | Non-message domains + optional metadata |
| `restore-import-contracts.ts` → `resolveCanonicalBackupRestoreOwnerSelection` | Policy | Native / cutover: `restoreDmChatStateDomains: false` |

### 3.3 Account **projection / event log**

| Entry point | Role |
|-------------|------|
| `account-projection-runtime.ts` → `bootstrapAndReplay` | Empty log → bootstrap; existing without marker → seal |
| `account-event-bootstrap-service.ts` | Web: full chat-state import; **Native: seal-only** (no `DM_RECEIVED`) |
| `buildCanonicalBackupImportEvents` | Restore → projection events; respects skip-DM-timeline flag |
| `account-event-reducer.ts` | Replay materialization |
| `account-projection-selectors.ts` | Read model for contacts, DM list, messages |
| `account-event-ingest-bridge.ts` | Live canonical events (send, delete, contacts) |

### 3.4 Bootstrap on native (seal-only vs full)

| Condition | Behavior |
|-----------|----------|
| Native + empty event log | Tombstones from SQLite; peer trust; checkpoints; **no DM timeline** |
| Native + events, no marker | `buildBootstrapSealEvents` — tombstone seal + marker |
| Web + empty log | Full `collectFromChatState` timeline import |
| Native migration | `getAccountSyncMigrationPolicy` forces `legacy_writes_disabled` when `requiresSqlitePersistence()` |

**Test:** `account-event-bootstrap-service.native.test.ts`

### 3.5 Restore merge with **chat-state**

| Function | Owns |
|----------|------|
| `orchestrateRestoreMerge` | Pre-merge ledger; calls `mergeChatState` |
| `mergeChatState` | Merges connections, groups, DM maps, groupMessages, pins/unread |
| `stripChatStateMessageBodiesForNativeMirror` | Clears `messagesByConversationId` and `groupMessages` before replace |
| `sanitizeRestoredChatStateLiveCommunitySignals` | REL-002 — terminal ledger suppresses live community UI maps |

### 3.6 Cross-device sync hook

| Concern | Implementation |
|---------|----------------|
| Mount | `runtime-activation-manager.tsx` |
| Startup | Rehydrate → fast-follow restore → publish |
| Ongoing | Restore 60s + visible; publish 2m + pagehide + mutations |
| Convergence | `accountSyncConvergenceV091` — mutation → fast-follow restore |
| Post-restore | `messagingClientOperations.reconcileAccountEventLog` |

---

## 4. What survives restore vs stripped on native

### Survives (including native)

- Profile, peer trust, request evidence, sync checkpoints, relay list, settings
- Message **delete tombstones** (SQLite + gateway port)
- **Community membership ledger** (+ leave-proof enrichment)
- **Room key snapshots** (filtered to joined evidence)
- Chat-state **metadata:** `createdConnections`, `createdGroups` (ledger-filtered), pins, hidden, unread, overrides, connection requests
- Canonical **projection events** (contacts; DM timeline per migration phase)

### Stripped on native (P5-BKP-1 / P3c)

- `messagesByConversationId` — emptied before chat-state replace
- `groupMessages` — same
- DM timeline in cold bootstrap — no `DM_RECEIVED` events
- DM chat-state domains when `restoreDmChatStateDomains: false`
- Suppressed IDs purged from durable stores (`dbDeleteMessages`)

### Not written by restore

Backup restore does **not** call `dbInsertMessage` for DM bodies. `messagePersistenceService` is **imported** in `encrypted-account-backup-service.ts` but **never used** — native DM authority stays with normal messaging SQLite paths after restore.

---

## 5. Interaction with Module 1 (groups) and Module 2 (DM)

### Module 2 — DM

| Interaction | Detail |
|-------------|--------|
| Tombstones | Merged on restore; bootstrap hydrates from SQLite |
| Body restore | Blocked on native when projection owns history |
| Hydrate authority | Remains `dm-conversation-hydrate-pipeline` / SQLite — restore does not populate SQLite from backup bodies |
| Mutation signal | Chat-state / tombstone changes trigger backup publish |

### Module 1 — Groups

| Interaction | Detail |
|-------------|--------|
| Ledger | Load/merge/save; blocks left-group resurrection (AB-06) |
| Leave proofs | `fetchLeaveProofFromRelay` before merge |
| `createdGroups` | Merged + ledger-filtered in chat-state |
| `groupMessages` | Merged on web; **stripped on native** |
| REL-002 | Terminal ledger statuses suppress live sidebar/message maps |
| SQLite group list | **`community-group-sqlite-store` not updated by account-sync restore** — separate owner |

**Tests:** `community-restore-resurrection.test.ts`, `community-rel-002-restore-live-boundary.test.ts`

---

## 6. Test & CI coverage

**Present:**

| Test | Proves |
|------|--------|
| `encrypted-account-backup-service.test.ts` | Large publish/merge/restore matrix |
| `encrypted-account-backup-service.native-restore.test.ts` | P5-BKP-1 body strip |
| `restore-merge-chat-state.native.test.ts` | Strip contract |
| `p5-persistence-authority-gates.test.ts` | Static gates |
| `account-event-bootstrap-service.native.test.ts` | P3c seal-only |
| `restore-import-contracts.test.ts` | Projection vs chat-state owner |
| `account-sync-cross-device-deterministic.integration.test.ts` | Deterministic replay |
| `use-account-sync.test.ts` | Hook ordering, cooldowns |

**In `verify:p5-persistence`:** native-restore, authority gates, restore-merge-chat-state.native — **not** the main 4.9k-line backup test file.

**Gaps:**

| Gap | Risk |
|-----|------|
| No CI: native restore → **SQLite DM survival** end-to-end | Strip gated; history depends on local SQLite + relay |
| No CI: **native backup publish** includes correct DM payload | Publish reads chat-state mirror only — often empty on native |
| `applyBackupPayload` v1 still reachable | Parallel apply path |
| Restore updates `createdGroups` mirror but not **SQLite group list** | Cross-device group list drift |
| No automated two-device relay restore in CI | Manual matrix only |

---

## 7. Doc vs code conflicts

| Doc says | Code does | Severity |
|----------|-----------|----------|
| Native restore dual-path “audit” / high risk | P5-BKP-1 strip + CI exists; canonical path uses NonV1Domains | **Med** — doc lags |
| P3c “done” | Unit test only; no restart soak | **Low** |
| Subtract backup DM merge on native | Strip on **apply** yes; **publish** still serializes chat-state as-is | **High** — sparse cross-device backup |
| One owner per row | `applyBackupPayload` vs `applyBackupPayloadNonV1Domains` parallel | **Med** |
| IndexedDB hydration for backup | `hydrateChatStateFromIndexedMessages` is **no-op** | **Med** |
| Restore writes SQLite messages | `messagePersistenceService` import unused | **Med** |

---

## 8. Cross-dependencies

**Inbound:** `runtime-activation-manager`, settings export, auth import evidence.

**Outbound:**

- Messaging: `chat-state-store`, `messaging-client-operations`, sync checkpoints, media CAS
- Groups: membership ledger, leave-proof, reconstruction, display-name
- Network: peer trust
- Relays: publish/fetch backup events
- Vault: CAS media recovery
- Crypto: room-key store
- Profiles: scope, data-root export

---

## 9. Hypotheses (not proven)

1. **Cross-device DM backup on native is intentionally sparse** — SQLite is per-device authority; relay backup carries metadata + tombstones + ledger, not full threads.
2. **Group message loss on restart** is worsened by restore strip of `groupMessages` + no SQLite message restore from backup — aligns with Module 1 gaps.
3. **Projection event log** is the intended cross-device DM timeline transport under `legacy_writes_disabled`, but convergence with SQLite hydrate is not CI-proven.
4. **CRDT sync** (`crdt-sync-protocol.ts`) may be experimental vs kind-30078 encrypted backup — needs Module 5/6 cross-check.

---

## 10. Open questions for synthesis

1. Should native **publish** read SQLite for DM bodies, or is sparse backup the v1.9.x model?
2. When can **`applyBackupPayload` (v1)** be deleted?
3. Should restore **upsert SQLite group list** via `community-group-sqlite-store`?
4. Does projection replay **replace** SQLite hydrate for restored devices on native?
5. Is account-sync + relay backup **required** for DM-only ship, or portable bundle + local SQLite enough?
6. Should `verify:p5-persistence` add **BKP-2** (native publish payload audit)?

---

## 11. References

**Code:**

- `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.ts`
- `apps/pwa/app/features/account-sync/hooks/use-account-sync.ts`
- `apps/pwa/app/features/account-sync/services/account-event-bootstrap-service.ts`
- `apps/pwa/app/features/account-sync/services/restore-merge-module.ts`
- `apps/pwa/app/features/account-sync/services/restore-merge-chat-state.ts`
- `apps/pwa/app/features/account-sync/services/restore-import-contracts.ts`
- `apps/pwa/app/features/account-sync/services/account-projection-runtime.ts`

**Docs:**

- `docs/encyclopedia/12-core-architecture-truth-map.md` (rows 7–9)
- `docs/program/obscur-native-sqlite-policy.md`
- `docs/program/p5-persistence-survival-contract.md`
- `docs/program/design-goals-and-constraints.md`

**Prior modules:**

- [01-community-groups.md](./01-community-groups.md)
- [02-messaging-dm.md](./02-messaging-dm.md)

---

## Revision history

| Date | Change |
|------|--------|
| 2026-06-02 | v1 — first-pass audit |
