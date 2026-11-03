# Design — B3 migrate backup-evidence off `dbInsertMessage`

**Status:** Implemented (L1) · 2026-07-30  
**Parent:** [engine-invoke-boundary-subtract-design-2026-07.md](./engine-invoke-boundary-subtract-design-2026-07.md)  
**L3 prior:** [dual-owner-b2-l3-engine-invoke-2026-07-30.md](../../docs/handoffs/dual-owner-b2-l3-engine-invoke-2026-07-30.md)

---

## Session gate

```text
NEXT ATOMIC STEP:     Dual-owner subtract — B3 migrate remaining dbInsertMessage
PAUSED / CANCELLED:   community · Dev Lab
CANONICAL OWNER:      writeDmKernelMessage → engine_invoke dm.insertMessage
PROOF BEFORE DONE:    L1 dm-persist-owner allowlist · native-sqlite-backup-evidence.test · boundary catalog
OUT OF SCOPE:         community-dm-invite-pipeline edits · delete db_insert_message handler · group sqlite paths
```

---

## Parallel paths (before)

| Caller | Path |
|--------|------|
| Bus flush / probe | `writeDmKernelMessage` → `engine_invoke` |
| Backup restore | `applyNativeSqliteBackupEvidence` → `dbInsertMessage` → `db_insert_message` |
| Community invite | `persistInviteToNativeSqlite` → `dbInsertMessage` (**PAUSED** — keep) |

---

## Change (this slice)

| Before | After |
|--------|--------|
| `applyNativeSqliteBackupEvidence` maps DM rows with `dbInsertMessage(...).catch(...)` | Same map → `writeDmKernelMessage({ ...message, profile_id })` (failures already logged in write port) |
| Allowlist includes backup-evidence | Allowlist = **only** `community-dm-invite-pipeline.ts` |
| Group rows | Unchanged (`dbUpsertGroup` / `dbInsertGroupMessage`) — not DM dual-owner |

**Do not** touch `groups/services/community-dm-invite-pipeline.ts`.

---

## Mental simulation

1. Restore backup with `nativeSqliteEvidence.dmMessages` on Tauri.  
2. Each DM row goes through sole write port → `engine_invoke` `insertMessage` with restored `profileId`.  
3. Collect still reads via `dbGetMessages` (read path unchanged).  
4. Community invite still uses legacy command until band un-paused.

---

## Proof

| Layer | Command |
|-------|---------|
| L1 | `pnpm -C apps/pwa exec vitest run app/features/account-sync/services/native-sqlite-backup-evidence.test.ts app/features/messaging/services/dm-persist-owner.contract.test.ts app/engine-lab/engine-invoke-boundary-catalog.contract.test.ts` |
| L2 | (optional) path-b-b4 if wired |
| L3 | Not required this slice — B2 insert path already cold-restart proved |

---

## Claim language

| May say | When |
|---------|------|
| Implemented (B3 backup) | L1 green · allowlist community-only |
| Tombstoned `db_insert_message` | **Not this slice** — community caller remains |
| Fixed (backup restore) | Needs L3 restore soak — not claimed here |
