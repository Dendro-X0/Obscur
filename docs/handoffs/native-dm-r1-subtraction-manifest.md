# Native DM R1 — Radical subtraction manifest

**Status:** Active (2026-06-08)  
**Rule:** Delete parallel paths. Do not add merge branches. One owner per layer.

---

## The cycle (why subtraction is mandatory)

```
SQLite write fails OR one-sided row set
  → hydrate authority picks projection / chat-state / merge repair
    → UI shows history then re-hydrate replaces it
      → retry timers (partial direction, stale empty, chat_route_active)
        → more authority merges
          → same one-sided outcome, different error surface
```

**Exit:** Native desktop DM must have **exactly one read path** and **exactly one write path**. Everything else is deleted or quarantined behind `controllers/legacy/`.

---

## Canonical owners (native desktop — target state)

| Layer | Owner | Forbidden on native |
|-------|--------|-------------------|
| **Write** | `messageBus` → `MessagePersistenceService` → `db_insert_message` | IndexedDB `MessageQueue`, chat-state message bodies |
| **Cold read** | `runNativeDmThreadHydrateReadModel` → `db_get_messages` | `dm-read-authority-contract`, projection hydrate, chat-state fallback |
| **Live read** | `messageBus` same-session overlay only | Projection merge `useEffect`, display cache, sync-seed paint |
| **Depth** | User scroll → `loadEarlierMessages` (SQLite cursor) | Multi-pass `scanDisplayableHistoryWindow` on initial open |
| **Repair** | `native-dm-sqlite-repair` → relay backfill event | Projection gap-fill, direction-coverage hydrate retry |
| **Diagnostics** | `native-dm-sqlite-integrity` (fail-loud) | Silent shrink guards that hide SQLite truth |

---

## Landed in this slice

| Item | File |
|------|------|
| Native SQLite-only hydrate | `native-dm-thread-hydrate.ts` |
| Native thread history port (projection no-ops) | `thread-history/native-dm-adapter.ts` |
| Gateway bind switch | `resolve-dm-thread-history-adapter.ts` + `client-gateway-adapter.ts` |
| Hook: no display cache / sync seed on native | `use-conversation-messages.ts` |
| Legacy controller quarantine | `controllers/legacy/*` + contract test |
| Integrity + repair | `native-dm-sqlite-integrity.ts`, `native-dm-sqlite-repair.ts` |

---

## DELETE queue (next surgical passes)

### Pass A — Hook slimming (native branch deletion, not guards)

**Status: landed (2026-06-08)**

- `native-dm-conversation-hydrate-owner.ts` — native-only hydrate + finalize + integrity
- `use-conversation-messages.ts` — early native delegate; web-only retry effects removed on native
- Skipped native triggers: `chat_route_active`, `stale_empty_retry`, `partial_direction_retry`
- Native `chat_state_replaced` — tombstones only, no re-hydrate

Remove from `use-conversation-messages.ts` on native entirely (not `if (native) return`):

- `buildHydrateSupplementalMessages` call
- `forceIndexedHydrationRef` / `preferIndexedAuthority`
- `directionCoverageHydrateAttemptRef` retry loop
- `partialDirectionHydrateAttemptRef` effect (already policy-disabled)
- `staleEmptyHydrateRetry` when projection unavailable
- `accountProjectionSnapshot` dependency for hydrate params

### Pass B — Conversation list (sidebar) ✅ landed 2026-06-08

`native-dm-conversation-list-owner.ts` + `messaging-provider.tsx`:

- Skip chat-state `createdConnections` hydrate on native (`shouldNativeDmSkipChatStateSidebarConnectionHydrate`)
- SQLite effect uses `resolveNativeDmSidebarConnections` only — no `persistedDmConnectionMetadata` merge
- `dbGetConversations` loads immediately on native (no idle defer)
- Unread counts sourced from SQLite rows on native

### Pass C — File deletion (after Pass A/B green + CDP gate)

| Module | Action |
|--------|--------|
| `dm-read-authority-contract.ts` | Web-only; native imports forbidden (contract test) |
| `dm-conversation-hydrate-pipeline.ts` | Web-only entry |
| `dm-conversation-projection-live-merge.ts` | Web-only |
| `dm-thread-display-cache.ts` | Web-only |
| `dm-thread-sync-seed-loader.ts` | Web-only |

### Pass D — Verification gate (required before claiming progress)

```bash
pnpm dev:desktop:online
pnpm dev:lab:run -- --cdp http://127.0.0.1:9222 --scenario dm-native-relay-backfill
```

No native DM claim without CDP + `messaging.native_dm_sqlite_integrity_violation` absent on fresh A/B thread.

---

## Contract tests (enforce subtraction)

- `native-dm-legacy-path.contract.test.ts` — no production import of `controllers/legacy/*`
- `native-dm-thread-hydrate.ts` — must not import `dm-read-authority-contract`, `dm-conversation-hydrate-pipeline`, projection merge modules
- `resolve-dm-thread-history-adapter.ts` — native returns `nativeDmThreadHistoryAdapter`

---

## Stop rule

If after Pass A–D the CDP gate still fails with `db_insert_message not allowed` or persistent one-sided SQLite:

1. Log **write path infeasible** in parked issues (not a read-model bug).
2. Do not add merge branches.
3. Freeze DM module until Tauri capability + clean profile evidence exists.
