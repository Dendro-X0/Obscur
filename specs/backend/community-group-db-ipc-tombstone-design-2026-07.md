# Design — Group `db_*` IPC tombstone

**Status:** Designed · Implemented · Verified (L1) · 2026-07-31  
**Parents:** [community-u2-group-persist-engine-design-2026-07.md](./community-u2-group-persist-engine-design-2026-07.md) (Wave C left warm ACL as LEGACY_PARALLEL) · Slice 15/19/21/23 tombstone pattern

---

## Session gate

```text
HANDOFF ATOMIC STEP:  Group db_* IPC tombstone — Done
PAUSED / CANCELLED:   Full community · COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab as validation
CANONICAL OWNER:      workspace-engine via engine_invoke (listGroups / upsertGroup / listGroupMessages / insertGroupMessage / insertGroupTombstone)
PROOF BEFORE DONE:    cargo check -p obscur_desktop_lib · vitest engine-invoke-boundary-catalog
OUT OF SCOPE:         Community un-pause · COM-RUN-01 · db_insert_message / db_upsert_conversation · U2 L3 re-soak
```

**Charter:** Maintainer selected **group `db_*` IPC tombstone** after U5 Wave B Done. Product + backup already on workspace-engine (U2 A–C); this slice only kills leftover Tauri handlers/ACL.

**Closeout (2026-07-31):** Handlers unregistered · ACL omit · boundary catalog **22 Pass** · `cargo check -p obscur_desktop_lib` Pass.

---

## Keep-set

| # | Change |
|---|--------|
| 1 | Remove five group handlers from both `generate_handler!` lists in `lib.rs` |
| 2 | Delete command fns from `commands/db.rs`; leave tombstone comment (+ U2 design pointer) |
| 3 | Drop from `permissions/app.toml` + sync `gen/schemas/acl-manifests.json` |
| 4 | Update `packages/db/src/client.ts` comment (TS helpers already gone in Wave C) |
| 5 | Boundary catalog: handlers absent · ACL omit · workspace methods present; Slice 24 allow-set without group `db_*` |

**Unchanged:** `libobscur` repository APIs (warmup + `engine_invoke` workspace methods still call them). `GroupRecord` / message / tombstone **types** remain in `@dweb/db`.

### Commands tombstoned

| Tauri command | Engine method |
|---------------|---------------|
| `db_get_groups` | `workspace.listGroups` |
| `db_upsert_group` | `workspace.upsertGroup` |
| `db_get_group_messages` | `workspace.listGroupMessages` |
| `db_insert_group_message` | `workspace.insertGroupMessage` |
| `db_insert_group_tombstone` | `workspace.insertGroupTombstone` |

---

## Proof

```bash
pnpm -C apps/pwa exec vitest run app/engine-lab/engine-invoke-boundary-catalog.contract.test.ts
cargo check -p obscur_desktop_lib
```

**Do not claim:** Community un-paused · COM-RUN-01 fixed · U2 L3 re-verified from this slice alone.

---

## Claim language

| May say | When |
|---------|------|
| Group `db_*` IPC tombstoned | Handlers unregistered · ACL omit · L1 green |
| Group persist sole engine IPC | U2 product path + this tombstone |
| Fixed community | **Never** from this slice |
