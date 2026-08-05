# Investigation — R-HYDRATE-DM-READ Slice 14

**Status:** Closed by design · 2026-07-30

## Finding

`loadLegacyConversationWindow` in `hydrate-indexed-scan.ts` is the last production DM hydrate reader still on bare `dbGetMessages`. Engine `DmGetThreadPayload` already carries `beforeReceivedAt` (Rust + TS contracts).

| Call | Replacement |
|------|-------------|
| `dbGetMessages(profileId, conversationId, limit, before)` | `fetchDmThreadRows({ host, profileId, payload: { conversationId, limit, beforeReceivedAt } })` |

## Parallel callers after Keep-set

Kernel thread port already engine-only (Slice 6). Hydrate legacy window joins that owner.

## Deferred

Vault `db_*` · P2 UI soak · community group IPC
