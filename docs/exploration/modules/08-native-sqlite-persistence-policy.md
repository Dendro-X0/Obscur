# Module 8 — Native SQLite & persistence policy

_Last reviewed: 2026-06-02 (baseline commit 7f84f813)._

**Status:** v1 complete (first-pass audit)  
**Last updated:** 2026-06-02  
**Scope:** Native persistence policy docs + `@dweb/db` / `libobscur` stack + PWA persistence owners and CI gates

---

## 1. Scope

**Primary paths:**

| Path | Role |
|------|------|
| `docs/program/obscur-native-sqlite-policy.md` | Canonical native owner matrix (P3a–P4-5, ACC-03/04) |
| `docs/program/p5-persistence-survival-contract.md` | CI survival bands replacing manual persistence smoke |
| `apps/pwa/app/features/runtime/native-persistence-policy.ts` | Runtime gate: `requiresSqlitePersistence()` |
| `apps/pwa/app/features/runtime/persistence-policy.ts` | Greenfield IDB exclusion + `getDmHydrateRecoveryFlags()` |
| `packages/db/` (`@dweb/db`) | TS façade → Tauri `db_*` invoke |
| `packages/libobscur/src/db/` | Rust SQLite schema + repositories |
| `apps/desktop/src-tauri/src/commands/db.rs` | Tauri command bindings |

**Adjacent paths (native persistence consumers):**

| Path | Role |
|------|------|
| `messaging/services/message-persistence-service.ts` | DM outbound write owner (P5-DM-1) |
| `messaging/services/dm-conversation-hydrate-indexed-scan.ts` | DM hydrate I/O (SQLite window) |
| `messaging/services/dm-conversation-hydrate-pipeline.ts` | Hydrate orchestration; chat-state fallback gate |
| `messaging/services/dm-read-authority-contract.ts` | Hydrate authority decisions (R1 choke) |
| `messaging/services/conversation-list-authority.ts` | List authority resolver (P3a) |
| `messaging/services/chat-state-store.ts` | Truth map row 9 — localStorage mirror |
| `groups/services/sealed-group-message-persistence.ts` | Sealed group message durability (P3d) |
| `groups/services/community-group-sqlite-store.ts` | Group list SQLite (P5-COM-4) |
| `messaging/services/relay-checkpoint-sqlite-store.ts` | ACC-03 relay checkpoints |
| `messaging/services/call-record-sqlite-store.ts` | ACC-04 call history |
| `messaging/lib/sync-checkpoints.ts` | Checkpoint contract + SQLite mirror hook |
| `account-sync/services/account-event-bootstrap-service.ts` | P3c seal-only native bootstrap |
| `account-sync/services/restore-merge-chat-state.ts` | P5-BKP-1 body strip |
| `profiles/services/account-shared-sqlite-profile-ids.ts` | Multi-window profile-slot scan (M4) |

### Scale (approx.)

| Metric | Value |
|--------|-------|
| `@dweb/db` prod files | 3 TS (`index.ts`, `client.ts`, `types.ts`) |
| `@dweb/db` client LOC | ~156 |
| `@dweb/db` API surface | 22 exported functions (messages, tombstones, conversations, groups, calls, checkpoints, search) |
| `libobscur` `messages.rs` | ~1,419 LOC |
| `libobscur` `schema.rs` | ~263 LOC (SCHEMA_VERSION = 3) |
| Runtime policy files | `native-persistence-policy.ts` (12 LOC), `persistence-policy.ts` (24 LOC) |
| Largest persistence owners | `message-persistence-service.ts` ~814 LOC; `dm-read-authority-contract.ts` ~734 LOC; `restore-merge-chat-state.ts` ~895 LOC; `chat-state-store.ts` ~438 LOC |

**Scale vs other modules:**

| Module | Role in M8 |
|--------|------------|
| M2 Messaging | Primary SQLite consumer — hydrate + persist |
| M1 Groups | Sealed messages + group list SQLite |
| M3 Account sync | Bootstrap seal-only + restore strip; backup publish gap |
| M4 Profiles | Profile-slot FK + multi-slot hydrate scan |
| M5 Relays | 7d lookback live-only; ACC-03 checkpoints |
| M7 Runtime | `requiresSqlitePersistence()` gates relay bootstrap policy |

---

## 2. Stated contract (canonical docs)

| Claim | Source |
|-------|--------|
| **Policy (one sentence):** On native, all durable product state lives in SQLite via `libobscur` / Tauri `db_*` — not IndexedDB, not chat-state as authority | `obscur-native-sqlite-policy.md` |
| Truth map **row 9** (`chat-state-store.ts`): Web = durable owner; **Native = UI mirror only** — not DM/group message read authority | Truth map L37–39 |
| Truth map **row 0** (ClientGateway): tombstones + delete paths via gateway ports → SQLite on native | Policy § R1 alignment |
| **R1** hydrate choke: `dm-conversation-hydrate-pipeline.ts` + `dm-read-authority-contract.ts`; SQLite via `dm-conversation-hydrate-indexed-scan.ts` | Policy owner matrix |
| P3a–P3d + P4-5 owner matrix **done (code)**; Phase B restart soak **deferred** | Policy § Bands |
| P5 complete: `pnpm verify:p5-persistence` **64 tests**, 5 skipped | `p5-persistence-survival-contract.md` |
| P5-BKP-1: native restore must not dual-write DM bodies into chat-state authority | P5 band table |
| P3c: account bootstrap on native = **seal-only** (tombstones + peer trust + checkpoints) | Policy owner matrix |
| ACC-03 relay checkpoints + ACC-04 call records wired to SQLite | Policy owner matrix (2026-06-02) |
| Runtime detection: `hasNativeRuntime()` — **not** notification `isTauri()` | Policy § Runtime detection |
| 7-day relay lookback = **live subscription only**, never history TTL | P5-DM-3 |
| Log `NON_CANONICAL` if native reads IndexedDB for production DM paths | Policy § Authority rules |

---

## 3. As-built ownership

### 3.1 Runtime gate & policy flags

| Entry point | Production? | Notes |
|-------------|-------------|-------|
| `runtime-capabilities.ts` → `hasNativeRuntime()` / `hasCallableNativeBridge()` | Yes | Callable Tauri bridge required |
| `native-persistence-policy.ts` → `requiresSqlitePersistence()` | Yes | Thin wrapper: `hasNativeRuntime()` |
| `persistence-policy.ts` → `getDmHydrateRecoveryFlags()` | Yes | Native: `allowLegacyPersistedAuthority: false`, `allowIndexedDbMessageWindowFallback: false` |
| `persistence-policy.ts` → `INDEXED_DB_PERMANENTLY_EXCLUDED` | Partial | Constant `true`; enforced in `storage-health-service.ts` |
| `offline-runtime-policy.ts` → `shouldSkipRelayNetworkBootstrap()` | Yes | Native skips relay network bootstrap |
| `account-sync-migration-policy.ts` → `applyNativeProjectionPolicyOverride()` | Yes | Forces `legacy_writes_disabled` on native |

### 3.2 DM write path (P5-DM-1)

| Entry point | Production? | Notes |
|-------------|-------------|-------|
| `message-persistence-service.ts` → `queueMessageUpsert()` | Yes | On Tauri: blocks UUID-only optimistic rows; waits for `eventId` |
| `message-persistence-service.ts` → `flushQueue()` | Yes | `isTauri()` → `dbInsertMessage()` + `dbUpsertConversation()`; also `mirrorMessageToChatState()` |
| `message-persistence-service.ts` → tombstone/delete flush | Yes | `dbInsertTombstone`, `dbDeleteMessages` on native |

### 3.3 DM read / hydrate path (P3b, P5-DM-2, R1)

| Entry point | Production? | Notes |
|-------------|-------------|-------|
| `dm-conversation-hydrate-indexed-scan.ts` → `loadConversationWindow()` | Yes | Native: `dbGetMessages()` across `listAccountSharedSqliteProfileIds()`; web returns `[]` |
| `dm-conversation-hydrate-pipeline.ts` | Yes | L200–209: chat-state fallback **skipped** when `requiresSqlitePersistence()` |
| `dm-read-authority-contract.ts` → `resolveLegacyHydrationAuthority()` | Yes | Native: returns `authority: "indexed"` (SQLite) when projection not preferred |
| `dm-read-authority-contract.ts` → `resolveHydrationDmReadMessages()` | Yes | `allowLegacyRecovery: false` on native |
| `dm-thread-sync-seed-loader.ts` | Yes | Returns `[]` on native (first-paint seed skipped) |
| `use-conversation-messages.ts` → `hydrateHistory` | Yes | Delegates to pipeline (M2 owner) |

### 3.4 DM conversation list (P3a)

| Entry point | Production? | Notes |
|-------------|-------------|-------|
| `conversation-list-authority.ts` → `resolveConversationListAuthority()` | Yes | Native → always `{ authority: "sqlite", reason: "sqlite_native" }` |
| `messaging-provider.tsx` | Yes | Calls `dbGetConversations()`; still **writes** chat-state for pinned/hidden/unread/connections merge |

### 3.5 Community / groups (P3d, P5-COM-*)

| Entry point | Production? | Notes |
|-------------|-------------|-------|
| `community-group-sqlite-store.ts` | Yes | SQLite list authority on native (P5-COM-4) |
| `sealed-group-message-persistence.ts` → `loadPersistedSealedGroupMessages()` | Yes | Native: SQLite first, merges chat-state aliases as supplement |
| `sealed-group-message-persistence.ts` → `commitSealedGroupMessages()` | Yes | SQLite + chat-state mirror |
| `sealed-group-message-persistence.ts` → `persistSealedGroupMessages()` | Yes | **No-op on native** (legacy web-only path) |
| `group-provider.tsx` | Yes | Hydrates from SQLite + chat-state merge (M1) |

### 3.6 Account sync / backup (P3c, P5-BKP-1)

| Entry point | Production? | Notes |
|-------------|-------------|-------|
| `account-event-bootstrap-service.ts` | Yes | Native: skips full DM timeline import; hydrates tombstones from SQLite first |
| `restore-merge-chat-state.ts` → `stripChatStateMessageBodiesForNativeMirror()` | Yes | Clears `messagesByConversationId` + `groupMessages` before chat-state replace |
| `encrypted-account-backup-service.ts` | Yes | Applies strip on native restore; **publish reads chat-state mirror only** (M3 gap) |

### 3.7 Ancillary SQLite domains (ACC-03, ACC-04)

| Entry point | Production? | Notes |
|-------------|-------------|-------|
| `relay-checkpoint-sqlite-store.ts` | Yes | Mirrors `dm:all` timeline progress to per-relay rows |
| `sync-checkpoints.ts` | Yes | localStorage primary contract; bootstraps from SQLite frontier on native cold start |
| `call-record-sqlite-store.ts` | Yes | Terminal call history; live session stays in `call-state-crdt.ts` |
| `call-state-runtime.ts` | Yes | Wires ACC-04 persist on call end |

### 3.8 Rust / Tauri stack

| Entry point | Production? | Notes |
|-------------|-------------|-------|
| `packages/libobscur/src/db/repositories/messages.rs` | Yes | All CRUD: messages, tombstones, conversations, groups, group messages, call records, relay checkpoints, FTS |
| `messages.rs` → `ensure_profile_slot()` | Yes | FK-safe profile row before inserts |
| `messages.rs` → `get_messages_by_conversation()` | Yes | No age ceiling in SQL — pagination by `received_at` only |
| `packages/libobscur/src/db/schema.rs` | Yes | Profile-scoped tables; `(event_id, profile_id)` PK dedup |
| `apps/desktop/src-tauri/src/commands/db.rs` | Yes | 22 Tauri commands mirroring `@dweb/db` |
| `packages/libobscur/src/net/mod.rs` | Partial | **Separate** `obscur_sync_checkpoint.sqlite3` for Rust background sync — distinct from app `relay_checkpoints` table |

### 3.9 Multi-window profile slots (M4 interaction)

| Entry point | Production? | Notes |
|-------------|-------------|-------|
| `account-shared-sqlite-profile-ids.ts` | Yes | On native, scans all registered profile slots + bound windows; hydrate merges rows then filters by account pubkey |

---

## 4. Persistence & truth

| Store | Authority (docs) | Authority (observed) | Domain |
|-------|------------------|----------------------|--------|
| **SQLite** (`@dweb/db` → `libobscur`) | Native durable truth | **Matches docs** for DM hydrate/read/write, list, deletes, groups, checkpoints, calls | DM thread, conversation list, tombstones, group list, sealed messages |
| **chat-state localStorage** | Web: durable owner; Native: **UI mirror only** | **Mostly matches** — still receives message mirrors on write; **not** hydrate read authority on native | Pinned/hidden/unread, connection metadata, group merge, backup publish payload |
| **Account projection event log** | Seal-only bootstrap on native | **Matches** — no DM_RECEIVED replay from chat-state on native | Peer trust, tombstones, checkpoints, bootstrap marker |
| **Relay live window** | Transport only; 7d `since` for subscription | **Matches** — lookback only in `dm-relay-transport.ts` | Live DM ingest, not hydrate TTL |
| **IndexedDB** | Permanently excluded (greenfield policy) | **Mostly excluded** — hydrate indexed scan returns `[]` on web when not native | Legacy web dev only |
| **Rust bg sync checkpoint DB** | Not documented in native policy | **Parallel store** in `libobscur/src/net/mod.rs` — separate from PWA `relay_checkpoints` | Rust background sync only |

### Truth map row 9 — chat-state mirror vs SQLite authority

| Surface | Web | Native (observed) |
|---------|-----|-------------------|
| DM message **read** | chat-state + projection + indexed fallback compete (R1 multiplicity) | **SQLite via indexed-scan**; pipeline skips persisted fallback |
| DM message **write** | chat-state + (deprecated) indexed | SQLite via `message-persistence-service` + chat-state mirror |
| Conversation **list** | projection / persisted / sqlite resolver | **Always sqlite** via `resolveConversationListAuthority` |
| Group messages **read** | chat-state primary on web | SQLite primary; chat-state merged if sqlite empty/supplement |
| UI prefs (pinned/hidden/unread) | chat-state | chat-state (interim — future SQLite prefs table) |

**User-visible symptom map (from P5 contract):**

| Symptom | Architectural truth (observed) |
|---------|-------------------------------|
| DM history gone after ~7 days | No default 7-day local purge (`localMessageRetentionDays` default 0); loss when SQLite never owned thread + relay 7d live window is only recovery |
| Group vanishes after leave | Terminal leave intent (ledger + tombstone) hides UI; SQLite row may persist; P5-COM-2 recovery separate from message durability |
| Sidebar survives, thread empty (Test 10) | List metadata (chat-state/SQLite list) ≠ message bodies (sealed persistence path); wrong profile slot (M4) |

---

## 5. Doc vs code conflicts

| Doc says | Code does | Severity |
|----------|-----------|----------|
| Log `NON_CANONICAL` if native reads IndexedDB for production DM paths | **No `NON_CANONICAL` string in codebase** (docs only) | **Med** — enforcement doc-only |
| P3b–P3d "done" implies restart survival verified | Code paths exist; **no CI cold-restart integration** for group messages | **Med** |
| Policy § Domains table: relay checkpoints "no PWA owner yet" | Owner matrix § ACC-03/04 **done** with wired owners | **Med** — internal doc drift within same file |
| Subtract queue: `persistSealedGroupMessages` no-op on native | `commitSealedGroupMessages()` still writes SQLite + chat-state — naming confusion | **Low** |
| Policy: use `hasNativeRuntime()`, not `isTauri()` | Many persistence paths use `@dweb/db` **`isTauri()`** instead of `requiresSqlitePersistence()` | **Low** — usually equivalent |
| Account backup restore "Audit" / high-risk dual path | P5-BKP-1 strip + static gates exist; **publish still serializes chat-state mirror** (sparse bodies on native) | **High** (M3) |
| Two relay checkpoint stores | PWA `relay_checkpoints` table + Rust `background_sync_checkpoints` in separate SQLite file | **Med** — undocumented multiplicity |
| P5 band P5-COM-MSG for group message restart | **Not in gate** — no cold-restart message survival test | **High** (M1 Test 10) |

---

## 6. Test & CI coverage

**Present:**

| Test file | Proves |
|-----------|--------|
| `native-persistence-policy.test.ts` | Gate wiring |
| `dm-conversation-hydrate-indexed-scan.test.ts` | Native uses `dbGetMessages`; **P5-DM-2** 8+ day message survival |
| `message-persistence-service.test.ts` | P5-DM-1 outbound persist |
| `dm-read-authority-native-hydrate.test.ts` | Native authority branches |
| `conversation-list-authority.test.ts` | P3a sqlite_native decision |
| `account-event-bootstrap-service.native.test.ts` | P3c seal-only bootstrap |
| `encrypted-account-backup-service.native-restore.test.ts` | P5-BKP-1 body strip |
| `restore-merge-chat-state.native.test.ts` | `stripChatStateMessageBodiesForNativeMirror` |
| `p5-persistence-authority-gates.test.ts` | Static grep gates: BKP-1, ACC-04, P5-DM-3 |
| `community-group-sqlite-store.test.ts` | P5-COM-4 list upsert |
| `community-leave-recovery.test.ts` | P5-COM-2 |
| `community-auto-disband-policy.test.ts` | P5-COM-3 |
| `relay-checkpoint-sqlite-store.test.ts` | ACC-03 |
| `sync-checkpoints.test.ts` + `sync-checkpoints.native.test.ts` | Checkpoint mirror/bootstrap |
| `call-record-sqlite-store.test.ts` + `call-state-runtime.native-persist.test.ts` | ACC-04 |
| `packages/libobscur/src/db/repositories/messages.rs` (inline tests) | Relay checkpoint monotonicity, profile isolation, message CRUD |

**Missing (user-visible gaps):**

| Gap | Severity |
|-----|----------|
| **Group message cold restart** integration (send → exit → reopen) | **High** (M1 Test 10) |
| Native restore → **SQLite DM survival** end-to-end | Med |
| Native **backup publish** payload correctness (sparse chat-state on native) | **High** (M3) |
| Two-profile-window **restart soak** (Phase B) | **High** (policy marks manual verify pending) |
| `NON_CANONICAL` runtime diagnostic | Med |
| Restore updates group chat-state but **not** `community-group-sqlite-store` | Med (M3) |
| Rust bg-sync checkpoint DB vs PWA checkpoint table convergence | Med |

**CI gates:**

```bash
pnpm verify:p5-persistence   # 13 vitest files, 64 passed / 5 skipped (per P5 contract)
pnpm verify:stability        # render-loop / settings (not persistence-specific)
```

**Not in gate:** main `encrypted-account-backup-service.test.ts` (~4.9k lines), group message restart, multi-window soak.

---

## 7. Hypotheses (not proven)

- **H1:** "7-day DM history loss" on native is usually **SQLite never owning the thread** (UUID-only outbound blocked, or wrong profile slot before M4 fix) combined with relay 7d live window — not a local retention purge.
- **H2:** **Test 10 group message loss** is sealed-group write/read path + profile slot mismatch (M1 + M4), not SQLite schema failure — P5 gates cover DM but not COM-MSG restart.
- **H3:** **`isTauri()` vs `requiresSqlitePersistence()`** divergence could matter in dev harnesses where Tauri internals exist but product shell is not native — edge case only.
- **H4:** **chat-state mirror writes on native** inflate backup metadata but empty message bodies after strip — cross-device restore quality depends on SQLite + relay, not backup chat-state.
- **H5:** **Dual checkpoint stores** (Rust net vs PWA relay_checkpoints) may cause confusing gap/backfill behavior under Rust-initiated background sync (M5).

---

## 8. Open questions for synthesis

1. Should synthesis recommend a **P5-COM-MSG** band in `verify:p5-persistence`, or split gates into DM / COM / BKP scripts?
2. Is **chat-state message mirroring on native** still needed for backup/UI, or subtract now that SQLite owns bodies?
3. Should **`isTauri()` be replaced with `requiresSqlitePersistence()`** uniformly in persistence owners?
4. How should **Rust `background_sync_checkpoints`** relate to ACC-03 `relay_checkpoints` — merge, document, or isolate?
5. Does **native backup publish** need a BKP-2 band (serialize SQLite-derived evidence, not chat-state bodies)?
6. When can truth map **row 9** be narrowed to "localStorage UI prefs only" on native?
7. Phase B **manual restart matrix**: which P3 rows remain blocked on CI-only evidence?
8. Fork decision: Path A amputation can drop group SQLite paths; Path B still needs COM-MSG survival — does synthesis prioritize DM-only gate expansion or group rewrite?

---

## 9. References

**Code:**

- `apps/pwa/app/features/runtime/native-persistence-policy.ts`
- `apps/pwa/app/features/runtime/persistence-policy.ts`
- `apps/pwa/app/features/runtime/runtime-capabilities.ts`
- `packages/db/src/client.ts`
- `packages/libobscur/src/db/repositories/messages.rs`
- `packages/libobscur/src/db/schema.rs`
- `apps/desktop/src-tauri/src/commands/db.rs`
- `apps/pwa/app/features/messaging/services/message-persistence-service.ts`
- `apps/pwa/app/features/messaging/services/dm-conversation-hydrate-indexed-scan.ts`
- `apps/pwa/app/features/messaging/services/dm-conversation-hydrate-pipeline.ts`
- `apps/pwa/app/features/messaging/services/dm-read-authority-contract.ts`
- `apps/pwa/app/features/messaging/services/conversation-list-authority.ts`
- `apps/pwa/app/features/messaging/services/chat-state-store.ts`
- `apps/pwa/app/features/groups/services/sealed-group-message-persistence.ts`
- `apps/pwa/app/features/groups/services/community-group-sqlite-store.ts`
- `apps/pwa/app/features/messaging/services/relay-checkpoint-sqlite-store.ts`
- `apps/pwa/app/features/account-sync/services/account-event-bootstrap-service.ts`
- `apps/pwa/app/features/account-sync/services/restore-merge-chat-state.ts`
- `apps/pwa/app/features/profiles/services/account-shared-sqlite-profile-ids.ts`

**Docs:**

- `docs/program/obscur-native-sqlite-policy.md`
- `docs/program/p5-persistence-survival-contract.md`
- `docs/encyclopedia/12-core-architecture-truth-map.md` (rows 0, 9, R1, R2)

**Prior modules (cross-module map):**

| Module | Interaction with M8 |
|--------|---------------------|
| [01-community-groups.md](./01-community-groups.md) | Sealed persistence + group SQLite; **no P5 cold-restart message gate** |
| [02-messaging-dm.md](./02-messaging-dm.md) | Primary SQLite consumer; R1 partially collapsed on native |
| [03-account-sync-backup-restore.md](./03-account-sync-backup-restore.md) | P3c seal-only + P5-BKP-1 strip; backup publish gap |
| [04-profiles-multi-window-scope.md](./04-profiles-multi-window-scope.md) | Multi-slot hydrate scan; `ensure_profile_slot()` |
| [05-relays-transport.md](./05-relays-transport.md) | 7d lookback live-only; ACC-03 checkpoints |
| [06-coordination-path-b-workspace.md](./06-coordination-path-b-workspace.md) | Roster truth coordination-backed; SQLite fixes local only |
| [07-runtime-shell-startup.md](./07-runtime-shell-startup.md) | Pre-auth durability owners; native relay bootstrap skip |

---

## Revision history

| Date | Change |
|------|--------|
| 2026-06-02 | v1 — first-pass audit |
