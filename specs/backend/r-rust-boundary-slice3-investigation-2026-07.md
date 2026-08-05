# Investigation — R-RUST-BOUNDARY Slice 3 (Tauri ↔ libobscur)

**Status:** Investigation only · 2026-07-30 · **no product code** until design lands  
**Charter:** [rust-module-refactor-queue-2026-07.md](./rust-module-refactor-queue-2026-07.md)  
**Prior:** R-SCOPE Slice 2 L1 done · R-AUTH F5 done

---

## Session gate

```text
NEXT ATOMIC STEP:     Rust refactor Slice 3 — R-RUST-BOUNDARY investigation
PAUSED / CANCELLED:   community · relay-publish rewrite · dm-persist rewrite · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNER (target): libobscur::engine_invoke::dispatch via Tauri `engine_invoke` (+ async transport exception)
PROOF BEFORE DONE:    catalog + classification · RC1 ops later · L3 parity only
OUT OF SCOPE:         Un-pausing relay/dm · UI-kit · wallet/protocol big-bang · new parallel invoke stacks
```

---

## Facts (repo)

| Fact | Evidence |
|------|----------|
| Tauri commands in `apps/desktop/src-tauri/src` | **159** `#[tauri::command]` handlers |
| Typed engine boundary | `commands/engine.rs` → `libobscur::engine_invoke::dispatch` |
| Auth explicitly **not** on `engine_invoke` | `dispatch` returns `invalid_engine` for `"auth"` — use `auth_boot_snapshot` |
| Async transport fork | `engine_invoke_transport_publish_relay_event` when host-publish network gate on |
| Parallel SQLite surface | **27** `db_*` commands in `commands/db.rs`; TS `@obscur/db` / `packages/db` invokes them directly |
| Registered in `lib.rs` `generate_handler!` | Both `engine_invoke` **and** full `db_*` set (desktop cfg) |

### Count by module

| Count | Module |
|------:|--------|
| 27 | `commands/db.rs` |
| 24 | `wallet.rs` |
| 18 | `commands/profile.rs` |
| 14 | `commands/data_root.rs` |
| 13 | `commands/system.rs` |
| 11 | `commands/window.rs` |
| 10 | `protocol.rs` |
| 8 | `relay.rs` |
| 5 | `les.rs` / `tor.rs` |
| 4 | `session.rs` / `tray.rs` |
| 1 each | `engine_invoke`, `auth_boot_snapshot`, transport async publish, … |

---

## Dual-path map (product risk)

```
TS HostEnginePort (@obscur/engine-host)
  → resolveTauriEngineInvokeCommand
    → engine_invoke  OR  engine_invoke_transport_publish_relay_event
      → libobscur::dispatch  (dm | workspace | transport)

TS packages/db client
  → db_get_messages / db_insert_message / …
      → commands/db.rs → same SQLite Database

Auth kernel
  → auth_boot_snapshot  (not engine_invoke)
  → session: init_native_session / get_session_status / …
```

| Overlap | `engine_invoke` methods | Legacy `db_*` |
|---------|-------------------------|---------------|
| DM read | `dm.getThread`, `dm.listConversations` | `db_get_messages`, `db_get_conversations` |
| Workspace read | `workspace.listGroups` | `db_get_groups` |
| Transport persist read | `listRelayCheckpoints`, `listConfiguredRelayUrls` | `db_get_relay_checkpoints`, … |
| Transport publish | `publishRelayEvent` (+ async pool path) | Also `relay::publish_event` (raw) |

**Verdict:** Dual ownership is real for **SQLite product reads/writes** (`db_*` vs `engine_invoke`) and for **relay publish** (`engine_invoke` / async / `relay::publish_event`). Relay + dm-persist rewrites remain **PAUSED** — catalog only; no subtract this slice.

---

## Classification buckets (proposed)

| Bucket | Criteria | Examples | Slice 3 action |
|--------|----------|----------|----------------|
| **A · KEEP shell** | OS / window / tray / notify / Tor / updater | `window_*`, `tray_*`, `show_notification`, `start_tor` | Document; do not fold into `engine_invoke` |
| **B · KEEP auth/session** | Explicit auth/session owners | `auth_boot_snapshot`, `init_native_session`, storage-at-rest, login-assist | Protect; never route through `engine_invoke` |
| **C · KEEP profile/data-root** | Desktop isolation / data root | `desktop_bind_window_profile`, data-root migrate | Keep; aligns with R-SCOPE |
| **D · ENGINE_CANONICAL** | Typed engines already on dispatch | `engine_invoke`, transport async exception | Prefer for new TS; expand methods only with design |
| **E · LEGACY_PARALLEL** | Same DB as D, separate commands | All `db_*` | **Study / inventory** — mutate blocked while `dm-persist` PAUSED |
| **F · PAUSED_RELAY** | Network publish / pool | `relay::*`, host-publish async path | Capture-only; no rewrite until un-pause |
| **G · DEFER** | Large crypto/protocol surfaces | `wallet::*`, `protocol::*`, LES, upload | Out of Slice 3 mutate; list only |

---

## Wrong cwd / proof traps

| Trap | Correct |
|------|---------|
| `cargo test` at monorepo root for `libobscur` alone | Use package cwd: `packages/libobscur` and/or `apps/desktop/src-tauri` (`obscur_desktop_lib`) |
| Claim “single backend” while TS still calls `db_*` | Dual path remains until PAUSED bands lift |
| Migrate auth into `engine_invoke` | Explicitly rejected by current `dispatch` |

---

## Immediate subtract candidates (none safe yet)

| Candidate | Why not now |
|-----------|-------------|
| Tombstone unused `db_*` | Need call-graph of `@obscur/db` + dm-kernel writers; **dm-persist PAUSED** |
| Collapse `relay::publish_event` into engine path | **relay-publish PAUSED** |
| Fold wallet into `engine_invoke` | Out of keep-set urgency; DEFER |

**Safe Slice 3 implement (after design):** inventory artifact + L1 contract that `engine_invoke` stays registered and auth stays off `engine_invoke` — **documentation + CI guard**, no handler deletion.

---

## Recommended design inputs

1. Freeze buckets A–C / F–G as non-migrate for this queue step.  
2. Treat E as the only future subtract band — gated on maintainer un-pause of `dm-persist`.  
3. RC1 proof targets already named in charter: `auth-boot-snapshot` + `session-scope-isolation` (verify ops, correct cargo cwd).  
4. Optional L3: unlock→F5 still green after any Slice 3 **code** (inventory-only needs no F5).

---

## Claim language

| May say | When |
|---------|------|
| Investigated | This doc |
| Designed | Design doc with implement slice |
| Implemented | L1 inventory/guard only (no handler delete without un-pause) |
| Fixed (single invoke path) | Only after E/F subtract + L3 — **not** this investigation |
