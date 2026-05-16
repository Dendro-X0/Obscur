# Obscur — Architecture Roadmap & Specification

**Status**: Draft — Pre-rebuild planning  
**Version target**: v2.0.0  
**Last updated**: 2026-05-08

---

## 1. Project Identity

Obscur is a sovereign communication platform. Its non-negotiable properties:

- Fully local execution — no cloud dependency for core function
- Nostr-based transport — relay-routed, censorship-resistant
- End-to-end encrypted — E2EE for all DMs and group messages
- Strict account isolation — multiple accounts on one device never share state
- Cross-device portability — account data survives device loss via key export
- Modular extensibility — new features integrate without touching core contracts
- Native desktop + PWA — Tauri v2 for desktop, Next.js PWA for browser

---

## 2. Root Cause of Current Complexity

The existing codebase accumulated complexity through rapid iteration without a stable data contract. Specific failure modes:

| Problem | Symptom | Root cause |
|---|---|---|
| Multiple state owners | Deleted messages reappear | 5+ stores own the same message list |
| Profile key collision | Messages disappear on refresh | Scoped/unscoped localStorage keys mixed |
| Dedup-vs-delete conflict | Delete commands silently dropped | Dedup gate placed before command classification |
| Duplicate conversations | Two sidebar entries for same peer | Conversation ID derivation inconsistent across code paths |
| Untestable flows | Bugs only found in production | State spread across IndexedDB, localStorage, in-memory refs |

The fix is not another patch layer. It is a single authoritative data store with a typed schema.

---

## 3. Target Stack

### 3.1 Kept (proven, no reason to change)

| Component | Technology |
|---|---|
| Desktop runtime | Tauri v2 |
| UI framework | Next.js 16 + React 19 |
| UI components | Existing component library |
| Styling | Tailwind CSS |
| Identity | secp256k1 keypairs (Nostr) |
| DM encryption | NIP-17 (kind 1059 gift wrap) + NIP-04 (kind 4) read |
| Transport | Nostr relay WebSocket pool |
| Crypto primitives | `@noble/secp256k1`, `@noble/hashes` |
| Tor integration | Existing Tauri Tor binary |
| State management | Zustand (UI-local state only) |

### 3.2 Replaced

| Current | Replacement | Reason |
|---|---|---|
| IndexedDB (`messagingDB`) | SQLite via `tauri-plugin-sql` | Transactions, foreign keys, joins, single source of truth |
| localStorage tombstones | `tombstones` SQL table | Profile-scoped by FK, refresh-safe, no key collision |
| `chatStateStore` JSON blobs | `conversations` SQL table | Queryable, no merge logic required |
| `projectionStore` | Eliminated | SQL query replaces projection derivation |
| `dm-ledger` (shadow mode) | `events_log` SQL table | Same append-only guarantees, queryable |
| Multiple coordinator services | Single `MessageRepository` | One insert path, one read path |

### 3.3 Added

| Component | Purpose |
|---|---|
| `tauri-plugin-sql` (SQLite) | Primary persistent store for desktop |
| `Drizzle ORM` | Type-safe schema, migrations, query builder |
| `better-sqlite3` (browser fallback) | WASM SQLite for PWA-only sessions |
| `drizzle-kit` | Migration generation and management |

---

## 4. Core Data Schema

Every feature is expressed as tables in this schema. No external stores.

```sql
-- Profile isolation: all tables reference profile_id
-- Each profile is an independent account on the device

CREATE TABLE profiles (
  id           TEXT PRIMARY KEY,              -- uuid
  public_key   TEXT NOT NULL UNIQUE,          -- hex
  display_name TEXT,
  created_at   INTEGER NOT NULL,              -- unix ms
  is_active    INTEGER NOT NULL DEFAULT 0     -- boolean
);

-- Canonical message store
-- Primary key is the Nostr event ID — dedup is free
CREATE TABLE messages (
  event_id          TEXT NOT NULL,            -- Nostr event ID (hex)
  profile_id        TEXT NOT NULL REFERENCES profiles(id),
  conversation_id   TEXT NOT NULL,            -- [pubkeyA:pubkeyB] sorted
  sender_pubkey     TEXT NOT NULL,
  recipient_pubkey  TEXT NOT NULL,
  plaintext         TEXT NOT NULL,
  kind              INTEGER NOT NULL,         -- 4 or 14
  created_at        INTEGER NOT NULL,         -- unix seconds (from relay)
  received_at       INTEGER NOT NULL,         -- local unix ms
  is_outgoing       INTEGER NOT NULL,         -- boolean
  reply_to_event_id TEXT,                     -- nullable
  has_attachment    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (event_id, profile_id)
);

-- Delete-for-everyone: a tombstone row hides a message
-- No scoping bugs: profile_id FK enforces isolation
CREATE TABLE tombstones (
  event_id        TEXT NOT NULL,
  profile_id      TEXT NOT NULL REFERENCES profiles(id),
  deleted_at      INTEGER NOT NULL,           -- local unix ms
  deleted_by      TEXT NOT NULL,              -- pubkey hex
  PRIMARY KEY (event_id, profile_id)
);

-- Conversation index: derived from messages, kept in sync by triggers
CREATE TABLE conversations (
  id                    TEXT NOT NULL,        -- [pubkeyA:pubkeyB] sorted
  profile_id            TEXT NOT NULL REFERENCES profiles(id),
  peer_pubkey           TEXT NOT NULL,
  last_event_id         TEXT,
  last_message_at       INTEGER,
  last_plaintext_preview TEXT,
  unread_count          INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (id, profile_id)
);

-- Relay bookmarks per peer (informs publish targeting)
CREATE TABLE peer_relay_hints (
  peer_pubkey  TEXT NOT NULL,
  profile_id   TEXT NOT NULL REFERENCES profiles(id),
  relay_url    TEXT NOT NULL,
  last_seen_at INTEGER NOT NULL,
  PRIMARY KEY (peer_pubkey, relay_url, profile_id)
);

-- Connection requests (separate from DMs)
CREATE TABLE connection_requests (
  event_id      TEXT NOT NULL,
  profile_id    TEXT NOT NULL REFERENCES profiles(id),
  sender_pubkey TEXT NOT NULL,
  intro_message TEXT,
  status        TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | rejected
  received_at   INTEGER NOT NULL,
  PRIMARY KEY (event_id, profile_id)
);

-- Group channels
CREATE TABLE groups (
  id         TEXT PRIMARY KEY,               -- relay-assigned or locally generated
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  name       TEXT NOT NULL,
  relay_url  TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'public', -- public | private | sovereign
  joined_at  INTEGER NOT NULL
);

CREATE TABLE group_messages (
  event_id    TEXT NOT NULL,
  group_id    TEXT NOT NULL REFERENCES groups(id),
  profile_id  TEXT NOT NULL REFERENCES profiles(id),
  sender_pubkey TEXT NOT NULL,
  plaintext   TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  received_at INTEGER NOT NULL,
  PRIMARY KEY (event_id, profile_id)
);

CREATE TABLE group_tombstones (
  event_id   TEXT NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  deleted_at INTEGER NOT NULL,
  deleted_by TEXT NOT NULL,
  PRIMARY KEY (event_id, profile_id)
);

-- Voice call records
CREATE TABLE call_records (
  call_id       TEXT PRIMARY KEY,            -- uuid
  profile_id    TEXT NOT NULL REFERENCES profiles(id),
  peer_pubkey   TEXT NOT NULL,
  initiated_by  TEXT NOT NULL,               -- pubkey
  status        TEXT NOT NULL,               -- missed | answered | declined | timeout
  started_at    INTEGER,
  ended_at      INTEGER,
  duration_ms   INTEGER
);

-- Relay subscription bookmarks (resume after restart)
CREATE TABLE relay_checkpoints (
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  relay_url  TEXT NOT NULL,
  last_event_at INTEGER NOT NULL,            -- unix seconds
  PRIMARY KEY (profile_id, relay_url)
);
```

### Key properties of this schema

- **Dedup is free**: `PRIMARY KEY (event_id, profile_id)` — `INSERT OR IGNORE` silently drops duplicates
- **Delete-for-everyone**: `LEFT JOIN tombstones WHERE tombstones.event_id IS NULL` in every message query
- **Profile isolation**: Every row carries `profile_id`. Cross-account contamination requires a deliberate SQL error
- **No merge logic**: Conversation list is a query, not a derived data structure that needs reconciliation
- **Refresh-safe**: Data lives in SQLite, not in React state or localStorage refs

---

## 5. Feature Architecture

### 5.1 Transport Layer (unchanged contract)

The relay pool connects, subscribes, and publishes. It knows nothing about messages or profiles.

```
RelayPool
  .subscribe(filters, onEvent)  → SubId
  .publish(event)               → PublishResult
  .unsubscribe(subId)
```

One subscription per active profile. Filter: `{ kinds: [4, 1059], "#p": [myPubkey], since: lastCheckpoint }`.

The subscription dispatcher receives raw `NostrEvent` objects and routes to handlers. It does not interpret content.

### 5.2 Ingest Pipeline (simplified)

```
RelayEvent
  → decrypt(event, myPrivKey)        → { plaintext, senderPubkey, kind }
  → classify(plaintext)              → "message" | "delete_command" | "connection_request" | "unknown"
  → db.insert / db.delete            → SQL write
  → notify(conversationId)           → lightweight signal to UI
```

No dedup gate in code. SQLite `INSERT OR IGNORE` handles duplicates at the DB level.  
No format detection. Classification is a pure function on the decrypted plaintext.

### 5.3 Delete-for-Everyone (simplified)

**Send side:**
```
user clicks delete
  → insert tombstone (event_id, profile_id, now, myPubkey)
  → encode delete command: { type: "delete", eventIds: [eventId] }
  → encrypt and publish to relay as DM to peer
```

**Receive side:**
```
relay delivers delete command event
  → decrypt → classify as "delete_command"
  → extract eventIds from payload
  → INSERT OR IGNORE INTO tombstones (eventId, profileId, now, senderPubkey)
  → notify(conversationId)
```

**Display:**
```sql
SELECT m.* FROM messages m
LEFT JOIN tombstones t 
  ON t.event_id = m.event_id AND t.profile_id = m.profile_id
WHERE m.conversation_id = ?
  AND m.profile_id = ?
  AND t.event_id IS NULL
ORDER BY m.created_at ASC;
```

No bus events for persistence. No tombstone store. No profileId scoping bugs.

### 5.4 Conversation List (simplified)

```sql
SELECT c.*, m.plaintext as preview
FROM conversations c
LEFT JOIN messages m ON m.event_id = c.last_event_id
WHERE c.profile_id = ?
ORDER BY c.last_message_at DESC;
```

No duplicate entries possible — conversation `id` is a primary key.

---

## 6. Migration Plan

Migration is phased. Each phase ships independently and is testable.

### Phase 0 — Schema foundation (no behavior change)
- Add `tauri-plugin-sql` to Cargo.toml
- Add Drizzle ORM to pnpm workspace
- Define schema in `packages/libobscur` (Rust-owned SQL migrations) and TS contracts in `packages/dweb-storage-contracts` (see `docs/program/v1.5.0-implementation-plan.md` Phase 2)
- Generate and test migrations with `drizzle-kit`
- Write `MessageRepository` with typed query functions
- **All existing behavior unchanged** — SQLite runs alongside current stores

### Phase 1 — Dual-write messages
- On every message receive: write to SQLite AND existing IndexedDB
- On every message send: write to SQLite AND existing IndexedDB
- Validate: message counts match between stores
- **No UI change yet**

### Phase 2 — Read from SQLite
- Switch `useConversationMessages` to query SQLite
- Switch conversation list to query SQLite
- Delete tombstones write to SQL table
- Remove `message-delete-tombstone-store.ts`
- Remove `chatStateStore` message path
- **UI now reads from SQLite**

### Phase 3 — Remove legacy stores
- Remove IndexedDB message tables
- Remove `projectionStore`, `dm-ledger`, `chatStateStore` message path
- Remove `dm-controller.ts` v2 complexity (collapse to ~80 lines)
- Remove `dm-receive-pipeline.ts` dedup gate (SQL handles it)
- **Controller becomes: receive → decrypt → classify → db.insert → signal**

### Phase 4 — Feature parity verification
- Delete-for-everyone: end-to-end test with two accounts
- Duplicate conversation: structurally impossible with SQL PK
- Message persistence across refresh: SQL survives refresh by definition
- Profile isolation: verified by FK constraints

### Phase 5 — Group and call migration
- Migrate group messages to `group_messages` table
- Migrate call records to `call_records` table
- Unify search across messages + groups via SQL FTS

---

## 7. Module Boundaries

Each feature owns its own tables and repository. No feature imports another feature's repository directly.

```
packages/
  db/
    schema.ts           ← single source of schema truth
    migrations/         ← drizzle-kit output
    repositories/
      MessageRepository.ts
      ConversationRepository.ts
      TombstoneRepository.ts
      GroupRepository.ts
      CallRepository.ts

apps/pwa/app/features/
  messaging/
    ← imports from MessageRepository, TombstoneRepository only
  groups/
    ← imports from GroupRepository only
  calls/
    ← imports from CallRepository only
```

The repository layer is the only code that writes SQL. Features call repository methods. Features never write SQL directly.

---

## 8. What Gets Deleted

The following files/directories become dead code after Phase 3 and should be removed:

- `messaging/services/message-delete-tombstone-store.ts`
- `messaging/services/chat-state-store.ts`
- `messaging/services/dm-message-queue.ts`
- `messaging/services/dm-read-authority-contract.ts`
- `messaging/services/dm-authority-drift-detector.ts`
- `messaging/dm-ledger/` (entire directory)
- `messaging/deletion/` (entire directory)
- `messaging/controllers/incoming-dm-event-handler.ts` (replaced by ingest pipeline)
- ~~`messaging/controllers/v2/dm-delete-subscription.ts`~~ — **removed 2026-05-13** (never wired; live ingress is `dm-relay-transport.subscribeToIncomingDMs`). See `docs/program/v1.5.0-known-issues-and-investigation-queue.md`.
- `messaging/controllers/v2/dm-receive-pipeline.ts` (simplified to ~30 lines)
- `messaging/controllers/enhanced-dm-controller.ts` (replaced by simplified controller)

Estimated reduction: ~150,000 lines of application logic.

---

## 9. Open Questions (decisions before Phase 0)

1. **SQLite in PWA**: `tauri-plugin-sql` only runs in Tauri. For the browser PWA, we need `sql.js` (SQLite WASM) or `origin-private-file-system` with a WASM build. Decision needed: should PWA and desktop share the same DB layer, or should PWA retain IndexedDB as a fallback?

2. **NIP-04 read support**: Existing conversations use kind 4. After migration, should we keep kind 4 receive support indefinitely (for backwards compatibility with old messages) or set a cutoff date?

3. **Migration of existing messages**: Should Phase 1 backfill existing IndexedDB messages into SQLite, or only capture new messages going forward?

4. **Relay checkpoints**: The current `since: lastCheckpoint` pattern can miss events if the checkpoint is stale. Should Phase 0 include a relay checkpoint recovery strategy?

---

## 10. Success Criteria for v2.0.0

- [ ] Delete-for-everyone works reliably on both sender and recipient after page refresh
- [ ] No duplicate conversation entries in sidebar
- [ ] No outgoing messages disappearing after refresh
- [ ] Multiple accounts on same device maintain strict isolation
- [ ] All features work offline (no internet required after initial relay sync)
- [ ] TypeScript: 0 errors
- [ ] Core flow tests: message send, receive, delete, connection request
- [ ] Performance: conversation open < 100ms for 1000-message history
