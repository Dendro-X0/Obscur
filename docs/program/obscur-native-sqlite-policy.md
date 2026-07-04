# Native persistence policy — SQLite (desktop + mobile)

**Status:** Active (2026-06-01) · **P4-5 owner matrix:** § [Owner matrix (native)](#owner-matrix-native-2026-06-01) below  
**Design goals:** [design-goals-and-constraints.md](./design-goals-and-constraints.md) § persistence  
**Truth map:** [12-core-architecture-truth-map.md](../encyclopedia/12-core-architecture-truth-map.md) — row 9 + R1 multiplicity; this doc is the **native persistence** detail for rows 0 and 9.  
**Aligns with:** [obscur-2.0-milestone-roadmap.md](../archive/program/inactive-2026-06/obscur-2.0-milestone-roadmap.md) Lane P3, [greenfield/04-architecture-sketch.md](../archive/greenfield/04-architecture-sketch.md), [platform-pivot-private-trust-2026-05.md](./platform-pivot-private-trust-2026-05.md)

---

## Policy (one sentence)

**On native runtime (desktop Tauri, mobile shell), all durable product state lives in SQLite via `libobscur` / Tauri `db_*` commands — not IndexedDB, not chat-state localStorage as authority.**

Production web is disabled (`native-runtime-gate`); dev browser harness may keep IndexedDB for local iteration only.

---

## Surfaces

| Surface | Persistence | QA |
|---------|-------------|-----|
| Desktop (Tauri) | SQLite only | Multi-profile windows |
| Mobile (Tauri) | SQLite only | Emulator + device |
| Browser dev / PWA local | IndexedDB + projection (legacy) | Not production target |
| Production web | **Disabled** | N/A |

---

## Domains (convergence order)

| Domain | SQLite owner | Deprecate on native |
|--------|--------------|---------------------|
| DM messages + tombstones | `db_insert_message`, `db_delete_message`, tombstone tables | chat-state `messagesByConversationId` as **read** authority |
| DM conversations list | `db_get_conversations`, `db_upsert_conversation` | chat-state `createdConnections` as **list** authority |
| DM delete tombstones | `db_insert_tombstone`, gateway `messageDeleteTombstones` port | IndexedDB tombstone merge (`mergeMessageDeleteTombstonesFromIndexedDb` — web only) |
| Community group list | `db_get_groups`, `db_upsert_group` | chat-state `createdGroups` as **sole** list authority |
| Sealed group messages | `db_get_group_messages`, `db_insert_group_message` | chat-state `groupMessages` as **read** authority |
| Account projection event log | Seal-only bootstrap on native ([account-event-bootstrap-service.ts](../../apps/pwa/app/features/account-sync/services/account-event-bootstrap-service.ts)) | Full DM timeline import from backup/chat-state |
| UI prefs (pinned/hidden/unread/overrides) | **chat-state localStorage** (interim) | — (future: dedicated SQLite or prefs table) |
| Relay checkpoints / call records | `@dweb/db` API exists; **no PWA owner yet** | — |
| Settings / identity registry | Profile registry + scoped localStorage | Competing unscoped keys |

---

## Runtime detection

Use `hasNativeRuntime()` from `apps/pwa/app/features/runtime/runtime-capabilities.ts` (callable Tauri bridge) — **not** `isTauri()` from notifications.

Helper: `requiresSqlitePersistence()` in `native-persistence-policy.ts`.

---

## Authority rules (native)

1. **Conversation list** — always `sqlite` authority on native (even when empty).
2. **DM hydrate** — load window from SQLite first; IndexedDB recovery paths **off** on native.
3. **Deletes** — await SQLite tombstone + row delete before UI success; no parallel IDB purge as truth.
4. **Diagnostics** — log `NON_CANONICAL` if native code reads IndexedDB for production DM paths.

---

## Testing

- All product QA on **desktop**, two+ profile windows.
- Automated: extend `conversation-list-authority.test.ts`, DM hydrate tests with `hasNativeRuntime` mocked true.
- No requirement to keep web/desktop parity tests green for native-only bands.

---

## Relation to Nostr / communities

SQLite fixes **local truth** and delete resurrection. **Roster join/leave across clients** still requires coordination directory (not Nostr relay authority). See [community-fork-decision-2026-05.md](./community-fork-decision-2026-05.md).

---

## Bands

| Band | Deliverable | Pass |
|------|-------------|------|
| **P3a** | Conversation list + policy doc | Native always `sqlite` authority — **Done** |
| **P3b** | DM hydrate native-only path | Delete-for-me survives restart (desktop) — **Verified** (Phase 1C O-2 t4 + Phase 1D cold restart `n8`) |
| **P3c** | Account projection native bootstrap | **Verified** — seal-only import; projection replay clean on cold unlock digest |
| **P3d** | Community tables native-only | **Verified** — NewTest 2 group list + sealed messages survive taskkill/relaunch (2026-07-04) |
| **P4-5** | Owner matrix documented | This doc § Owner matrix — **Done** (2026-06-01) |

---

## Owner matrix (native) — 2026-06-01

**Purpose (P4-5):** One table agents and maintainers use with [12-core-architecture-truth-map.md](../encyclopedia/12-core-architecture-truth-map.md).  
**API surface:** [`packages/db/src/index.ts`](../../packages/db/src/index.ts) (Tauri → `libobscur`).  
**Runtime gate:** `requiresSqlitePersistence()` in [`native-persistence-policy.ts`](../../apps/pwa/app/features/runtime/native-persistence-policy.ts).

**Legend — native authority**

| Label | Meaning |
|-------|---------|
| **SQLite** | Durable read/write truth on native |
| **chat-state (mirror)** | Profile-scoped localStorage via [`chat-state-store-legacy.ts`](../../apps/pwa/app/features/messaging/services/chat-state-store-legacy.ts); may write or merge but **not** listed as read authority |
| **chat-state (web only)** | Skipped when `requiresSqlitePersistence()` |
| **Repair shim** | Reads chat-state once to backfill SQLite; subtract when bus→sqlite is lossless |
| **Not wired** | Contract exists; no canonical app owner |

### Domain owners

| Domain | SQLite commands | Canonical module(s) | Native read authority | Native write path | chat-state on native | Status |
|--------|-----------------|---------------------|----------------------|-------------------|----------------------|--------|
| **DM thread hydrate** | `dbGetMessages` | [`thread-history/hydrate-indexed-scan.ts`](../../apps/pwa/app/features/messaging/services/thread-history/hydrate-indexed-scan.ts) | **SQLite** | — | Fallback **off** ([`dm-conversation-hydrate-pipeline.ts`](../../apps/pwa/app/features/messaging/services/dm-conversation-hydrate-pipeline.ts) L201–211) | **P3b done** |
| **DM outgoing persist** | `dbInsertMessage`, `dbUpsertConversation` | [`message-persistence-service.ts`](../../apps/pwa/app/features/messaging/services/message-persistence-service.ts) | **SQLite** | Same + message bus | Mirror for repair only | **P3b done** |
| **DM outgoing repair** | — | — (removed `02f1cb1b`) | **SQLite** | Bus → persistence service | — | **Removed** |
| **DM invite repair** | — | — (removed `02f1cb1b`) | **SQLite** | `commitOutboundCommunityDmInvite` | — | **Removed** |
| **DM conversation list** | `dbGetConversations` | [`messaging-provider.tsx`](../../apps/pwa/app/features/messaging/providers/messaging-provider.tsx) + [`conversation-list-authority.ts`](../../apps/pwa/app/features/messaging/services/conversation-list-authority.ts) | **SQLite** (`sqlite_native`) | `dbUpsertConversation` via persistence service | Merges metadata via `mergeDmConversationLists`; still **writes** connections/unread/pinned/hidden | **P3a done**; metadata mirror remains |
| **DM sync seed (first paint)** | — | [`dm-thread-sync-seed-loader.ts`](../../apps/pwa/app/features/messaging/services/dm-thread-sync-seed-loader.ts) | — | — | **Skipped** on native (returns `[]`) | **Done** |
| **DM delete tombstones** | `dbInsertTombstone`, `dbGetTombstones`, … | Client gateway `messageDeleteTombstones` port | **SQLite** (hydrate on unlock) | Gateway + persistence service | — | **P3b done** |
| **Group list** | `dbGetGroups`, `dbUpsertGroup` | [`community-group-sqlite-store.ts`](../../apps/pwa/app/features/groups/services/community-group-sqlite-store.ts), [`group-provider-port.tsx`](../../apps/pwa/app/features/groups/providers/group-provider-port.tsx) | **SQLite** + merge | `syncGroupConversationsToSqlite` | `createdGroups` still updated for merge/UI | **P3d done** |
| **Sealed group messages** | `dbGetGroupMessages` | [`sealed-group-message-persistence.ts`](../../apps/pwa/app/features/groups/services/sealed-group-message-persistence.ts) | **SQLite** first | `persistSealedGroupMessages` **no-op** on native | Read fallback only if sqlite empty (non-native path) | **P3d done** |
| **Account bootstrap** | — | [`account-event-bootstrap-service.ts`](../../apps/pwa/app/features/account-sync/services/account-event-bootstrap-service.ts) | Seal/tombstones/trust only | — | No full DM import on native | **P3c done** |
| **Account backup/restore** | Partial (`dbDeleteMessages` handling) | [`encrypted-account-backup-service.ts`](../../apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.ts) | Mixed | Writes **chat-state** | High-risk dual path | **Audit** before claiming restore **V** |
| **Requests / peer trust** | — | [`use-requests-inbox.ts`](../../apps/pwa/app/features/messaging/hooks/use-requests-inbox.ts), [`use-peer-trust.ts`](../../apps/pwa/app/features/network/hooks/use-peer-trust.ts) | **chat-state** | chat-state | `connectionRequests` in chat-state | **Web parity**; native OK as mirror if not list authority |
| **Vault / media relink** | — | [`cas-media-recovery.ts`](../../apps/pwa/app/features/vault/services/cas-media-recovery.ts) | Reads chat-state for scan | — | Evidence only | **P2** — not DM authority |
| **Relay checkpoints** | `dbUpsertRelayCheckpoint` (package) | [`relay-checkpoint-sqlite-store.ts`](../../apps/pwa/app/features/messaging/services/relay-checkpoint-sqlite-store.ts) + [`sync-checkpoints.ts`](../../apps/pwa/app/features/messaging/lib/sync-checkpoints.ts) | **SQLite** per-relay on native; localStorage mirror for `dm:all` | `mirrorTimelineCheckpointToSqlite` on sync finalize + restore | — | **ACC-03 done** — bootstrap from SQLite on cold start |
| **Voice call records** | `dbInsertCallRecord`, `dbGetCallRecords` (package) | [`call-record-sqlite-store.ts`](../../apps/pwa/app/features/messaging/services/call-record-sqlite-store.ts) + [`call-state-runtime.ts`](../../apps/pwa/app/features/messaging/services/call-state-runtime.ts) | **SQLite** terminal history on native | `persistTerminalCallRecordFromStatus` on end/reject | **CRDT** live session (`call-state-crdt.ts`) | **ACC-04 done** |

### chat-state production call sites (native-relevant)

**~25 production modules** import `chatStateStoreService` (excluding `*.test.*`). On native, treat them as:

| Role | Modules (representative) | Rule |
|------|--------------------------|------|
| **List authority** | — | None on native — use `resolveConversationListAuthority` → `sqlite` |
| **Hydrate authority** | — | Pipeline skips persisted message fallback when `requiresSqlitePersistence()` |
| **UI mirror / writes** | `messaging-provider.tsx`, `group-provider-port.tsx`, `chat-state-durability-owner.tsx` | Allowed for pinned/hidden/unread/groups merge; do **not** add new message bodies here |
| **Repair / drift** | `account-sync-drift-detector.ts` | Drift detector only; repair shims removed `02f1cb1b` |
| **Backup / migration** | `encrypted-account-backup-service.ts`, `restore-materialization.ts`, `identity-integrity-migration.ts` | Must not resurrect deletes on native; test in Phase B |
| **Dev-only** | `dev-panel.tsx` | Not product truth |

### R1 truth-map alignment

| Truth-map row | Native SQLite doc anchor |
|---------------|---------------------------|
| **0 ClientGateway** | Tombstones + delete paths via gateway ports → SQLite on native |
| **9 chat-state-store** | **Web:** durable owner. **Native:** UI mirror + repair shims only — not DM/group message read authority |
| **R1 DM multiplicity** | Hydrate choke: `dm-conversation-hydrate-pipeline.ts` + `dm-read-authority-contract.ts`; SQLite window via `thread-history/hydrate-indexed-scan.ts` |
| **R2 community** | Group list/messages: `community-group-sqlite-store.ts` + `sealed-group-message-persistence.ts`; roster still ledger/coordination |

### v1.9.x+ subtraction queue (do not expand chat-state on native)

1. Remove native **repair shims** once outgoing path always lands in SQLite before UI success.
2. Stop merging `persistedDmConnections` into sqlite list when sqlite row is source of truth (metadata-only merge doc in `messaging-provider`).
3. Gate backup restore DM bodies on native — seal-only parity with bootstrap.
4. Wire relay checkpoint / call record owners or mark **A** in register.

---

## Enforcement honesty (2026-06-01)

Policy bands mark **code path** ownership; they do **not** mean every native read/write is SQLite-only yet.

| Check | v1.9.x expectation |
|-------|-------------------|
| Owner matrix § above matches code owners | **Done** (P4-5, 2026-06-01) |
| Grep: no new native **read** authority via `messagesByConversationId` / `groupMessages` | Ongoing — repair/backup paths listed in matrix |
| Restart soak (P3b–P3d) | Phase B — [unified-verification-matrix.md](./unified-verification-matrix.md) |
| New native IDB writes for DM/community | **Forbidden** — CI/review |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-02 | P4-5 subtraction queue closed; repair shims removed; ACC-03/04 for ancillary sqlite tables |
| 2026-06-01 | P4-5 — native owner matrix; chat-state roles; R1/R2 truth-map anchors |

Full product intent: [design-goals-and-constraints.md](./design-goals-and-constraints.md) §3.

---

## Do not

- Add new IndexedDB writes on native for DM/community features.
- Treat greenfield as the shipping shell for this policy (Obscur implements here).
- Promise cross-client delete-for-everyone until `TeamTransportPort` exists — SQLite enables local tombstones only.
