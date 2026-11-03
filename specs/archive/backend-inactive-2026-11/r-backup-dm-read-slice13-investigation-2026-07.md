# Investigation — R-BACKUP-DM-READ Slice 13

**Status:** Closed by design · 2026-07-30

## Finding

`collectNativeSqliteBackupEvidence` still uses bare DM IPC after Slices 6–12:

| Call | Replacement |
|------|-------------|
| `dbGetConversations(profileId)` | `listDmConversations({ host, profileId })` |
| `dbGetMessages(profileId, id, limit)` | `fetchDmThreadRows({ host, profileId, payload })` |

Group collect/apply (`dbGetGroups`, `dbGetGroupMessages`, `dbUpsertGroup`, `dbInsertGroupMessage`) stays — **community PAUSED**.

Apply DM path already uses `writeDmKernelMessage` (B3).

## Deferred

| Path | Why |
|------|-----|
| `hydrate-indexed-scan` `dbGetMessages` | Separate owner; not backup-evidence |
| Vault `db_*` | No dm-engine equivalent yet |
| Group engine migration | Community PAUSED |
