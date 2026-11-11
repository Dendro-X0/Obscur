# Design — Cut 1.2 Message durability (K-MSG-DUR)

**Date:** 2026-11-09  
**Status:** **L1 Pass** (desktop L2 restart soak optional / owed)  
**Parent:** [cut1-replacement-authority-design-2026-11-09.md](./cut1-replacement-authority-design-2026-11-09.md) §1.2

```text
HANDOFF ATOMIC STEP: Cut 1.2 K-MSG-DUR
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass
CANONICAL OWNER:     dm engine SQLite messages (native); browser degraded chat-state / in-memory shim
PROOF BEFORE DONE:   L1 — native path never opens message IDB / MessageQueue durable store
SURFACE:             Tauri desktop primary
```

## Goal

On native, DM message durability is **SQLite only** (`dm.insertMessage` / thread reads). IndexedDB `MessageQueue` and `openMessageDb` must not open or act as durable storage.

## Deliver

1. `nativeDmSkipsIndexedDbMessageQueue()` gates **all** `MessageQueue` public I/O (not only persist/getMessage).
2. `openMessageDb` **rejects** when `requiresSqlitePersistence()` (fail-closed).
3. Restore/hydrate + reset helpers skip message-IDB paths on native.
4. L1 contract vitest names Cut 1.2 owner-uniqueness.

## Non-goals

- Soft L3 Fixed · K-OUTBOX-LS (1.3) · chat-state CRM demotion (1.5) · send-face (1.4)

## Proof

| Layer | Command / check |
|-------|-----------------|
| L1 | vitest Cut 1.2 contract + existing dm-durability-contract |
| L2 | optional desktop: message survives unlock/lock (owed) |
