# Design — U2: Group persist → workspace-engine (charter)

**Status:** Chartered · Wave A–C Done · **Wave D Done (L3)** · 2026-07-31  
**Parents:** [community-unpause-integration-study-2026-07.md](./community-unpause-integration-study-2026-07.md) §6 U2 · [obscur-native-sqlite-policy.md](../../docs/program/obscur-native-sqlite-policy.md) P3d · [engine-invoke-b3-backup-evidence-migrate-design-2026-07.md](./engine-invoke-b3-backup-evidence-migrate-design-2026-07.md) (DM pattern)  
**Charter:** Maintainer selected **U2** after U6 Wave B Done (2026-07-31).

---

## Session gate

```text
HANDOFF ATOMIC STEP:  U2 — group persist engine migrate (chartered)
PAUSED / CANCELLED:   Full community · COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab as validation
CANONICAL OWNER:      @obscur/workspace-engine via engine_invoke (host dispatch_workspace)
PROOF BEFORE DONE:    Wave A L1 allowlist · Wave B L1 · Wave C backup · L3 restart soak
OUT OF SCOPE:         COM-RUN-01 roster · membership port (U4 Done) · invite role (U6 Done) · Slice C crypto · full band un-pause
```

**Allowed under this charter:** `groups/**` + `packages/obscur-workspace-engine/**` + `packages/obscur-engine-contracts/**` + `packages/libobscur` workspace dispatch + account-sync group evidence — **only** for persist-owner subtraction named below.

---

## Goal

One canonical native persist path for **group list** and **group messages**:

| Today (bare IPC) | Target |
|------------------|--------|
| `dbGetGroups` / `dbUpsertGroup` → `db_get_groups` / `db_upsert_group` | `engine_invoke` `workspace.listGroups` / `workspace.upsertGroup` |
| `dbGetGroupMessages` / `dbInsertGroupMessage` / `dbInsertGroupTombstone` | `workspace.listGroupMessages` / `insertGroupMessage` / `insertGroupTombstone` |

Same SQLite tables (`libobscur` repositories) — **subtract dual IPC**, do not invent a second store.

Chat-state / workspace metadata cache remains a **UI merge input**; SQLite remains **native durability** (P3d). Engine is the only allowed write/read bridge to those tables from product code.

---

## Facts (exploration 2026-07-31)

### Already present

| Piece | State |
|-------|--------|
| `WORKSPACE_ENGINE_METHODS.listGroups` | Contracts + `@obscur/workspace-engine` `listWorkspaceGroups` |
| Host `dispatch_workspace` | `listGroups` + `upsertGroup` + `listGroupMessages` + `insertGroupMessage` + `insertGroupTombstone` |
| Product list store | **Wave A Done** — `community-group-sqlite-store` → `workspace-group-persist-port` → `@obscur/workspace-engine` |
| Product message path | **Wave B Done** — append / sqlite / suppress → `workspace-group-message-persist-port` |
| Backup + account evidence | **Wave C Done** — workspace-engine only; `@dweb/db` group helpers removed |
| Warm Tauri `db_*` group commands | **Tombstoned 2026-07-31** — [community-group-db-ipc-tombstone-design-2026-07.md](./community-group-db-ipc-tombstone-design-2026-07.md) |

### Product call sites (subtract)

| Surface | APIs | Role |
|---------|------|------|
| `community-group-sqlite-store.ts` | **Wave A:** workspace-engine via port (no bare list IPC) | List hydrate + sync |
| `group-thread-append.ts` | **Wave B:** `insertWorkspaceGroupMessageRecord` | Canonical thread write |
| `group-thread-sqlite-store.ts` | **Wave B:** `listWorkspaceGroupMessageRecords` | Thread page read |
| `group-thread-suppress.ts` | **Wave B:** `insertWorkspaceGroupTombstoneRecord` | Suppress / tombstone |
| `native-sqlite-backup-evidence.ts` | **Wave C:** workspace-engine list/upsert/insert | Backup collect/apply |
| `account-group-sqlite-evidence.ts` | **Wave C:** `listWorkspaceGroupMessageRecords` | Account evidence |

### Parallel paths (must not grow)

1. Bare `@dweb/db` group IPC (warm ACL)  
2. Workspace-engine `listGroups` (partial, unused by product)  
3. Chat-state `createdGroups` / `persistWorkspaceGroupMetadataCache` (metadata — keep; not SQLite owner)

---

## Waves

### Wave A — Group list via workspace-engine (**first implement**)

| Step | Work |
|------|------|
| A1 | Add `upsertGroup` to contracts + `workspace-engine` + `dispatch_workspace` (payload = `GroupRecord`) |
| A2 | Rewrite `community-group-sqlite-store` to call `listWorkspaceGroups` / `upsertWorkspaceGroup` via host port (same pattern as dm-kernel write port) |
| A3 | Contract: product allowlist for `dbGetGroups` / `dbUpsertGroup` empty (or only backup until Wave C) |
| A4 | Tombstone or comment `@dweb/db` group list helpers as non-product (keep for transition if needed) |

**Proof Wave A:** vitest store + engine contracts Pass · allowlist gate green.

### Wave B — Group messages via workspace-engine

| Step | Work |
|------|------|
| B1 | Add `listGroupMessages`, `insertGroupMessage`, `insertGroupTombstone` to contracts + host dispatch |
| B2 | Route `group-thread-append`, `group-thread-sqlite-store`, `group-thread-suppress` through engine |
| B3 | Contract: no product `dbInsertGroupMessage` / `dbGetGroupMessages` / `dbInsertGroupTombstone` outside backup (Wave C) |

**Proof Wave B:** group-thread append/sqlite/suppress tests Pass · allowlist empty for message IPC.

### Wave C — Backup evidence follows

| Step | Work |
|------|------|
| C1 | `native-sqlite-backup-evidence` + `account-group-sqlite-evidence` use workspace-engine only (mirror B3 DM migrate) |
| C2 | Empty remaining group bare-IPC allowlists; optionally deprecate `@dweb/db` group exports |

**Proof Wave C:** backup evidence tests Pass · boundary catalog updated.

### Wave D — L3 restart soak (separate atomic if long)

| Step | Work |
|------|------|
| D1 | Create or open managed community → send sealed message → quit → relaunch → list + thread present |
| D2 | Write `test-results/u2-l3-group-persist-*.json` |

**Proof Wave D:** L3 Pass on Tauri CDP/parity — **do not claim from L1 alone**.

---

## Mental simulation (end-to-end)

1. User creates **U6 Invite Role**-class community → metadata cache update → **Wave A** `upsertGroup` via engine → SQLite row.  
2. Cold restart → **Wave A** `listGroups` hydrates sidebar (merge with ledger still U4/U5 owners).  
3. Peer message arrives → **Wave B** `insertGroupMessage` → thread page `listGroupMessages`.  
4. Backup export/import → **Wave C** same engine methods — no bare `db_*`.  
5. Neighbors that must not regress: U4 leave port, U6 invite DM (dm-engine), Slice C wraps, COM-RUN-01 (still cancelled).

---

## Proof commands (planned)

```bash
# Wave A (exact files land with impl)
pnpm -C apps/pwa exec vitest run \
  app/features/groups/services/community-group-sqlite-store.test.ts \
  # + new workspace-group-persist-owner.contract.test.ts

# Wave B
pnpm -C apps/pwa exec vitest run \
  app/features/messaging/services/thread-history/group-thread-append.test.ts \
  app/features/messaging/services/thread-history/group-thread-sqlite-store.test.ts

# Wave C
pnpm -C apps/pwa exec vitest run \
  app/features/account-sync/services/native-sqlite-backup-evidence.test.ts

# Wave D
pnpm verify:u2-l3
# Evidence: test-results/u2-l3-group-persist-2026-07-31.json l3.pass=true
```

---

## Claim language

| May say | When |
|---------|------|
| U2 chartered / design ready | This file + handoff Next = Wave A |
| Wave A/B/C implemented | Allowlist + vitest Pass |
| U2 verified (native) | Wave D L3 Pass (`pnpm verify:u2-l3`) |
| Community un-paused | **Never** from U2 alone |
| COM-RUN-11 / roster fixed | Out of scope |
| Process-kill cold boot | **Not** claimed — Wave D used `webview_reload` |

---

## Forbidden

- Implementing Wave A–D without updating this design’s Status  
- Patching roster / invite UX “while we’re in groups/**”  
- Adding a second SQLite schema or chat-state-as-sole-durability regression  
- Claiming P3d broken or fixed without L3 restart evidence  

---

## Handoff after Wave D

| Field | Value |
|-------|--------|
| Done | **U2 Wave D** — L3 restart soak Pass (`webview_reload` + engine_invoke proof) |
| Next | Maintainer: pick next U-slice or leave community PAUSED |
| Optional | Group `db_*` IPC tombstone — **Done 2026-07-31** ([design](./community-group-db-ipc-tombstone-design-2026-07.md)) |
