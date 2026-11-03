# Investigation — R-DM-INTEGRITY-READ Slice 12

**Status:** Closed by design · 2026-07-30

## Finding

Diagnostic owners still called bare `@dweb/db` after Slice 6–7:

| File | Call | Replacement |
|------|------|-------------|
| `native-dm-sqlite-integrity.ts` | `dbGetMessages` | `fetchDmThreadRows` + Tauri host |
| `native-dm-sqlite-repair.ts` | `dbGetConversations` | `listDmConversations` + Tauri host |

`native-sqlite-backup-evidence.ts` still uses `dbGet*` — **out of scope** (account-sync).

## Parallel paths after Keep-set

Integrity/repair → sole engine reads. Kernel UI path already engine-only (Slices 6–7).
