# Design — Unblock RC1 cargo ops (root workspace + named filters)

**Status:** Implemented · RC1 green · 2026-07-30  
**Investigation:** [rc1-cargo-catalog-wiring-investigation-2026-07.md](./rc1-cargo-catalog-wiring-investigation-2026-07.md)

---

## Implement slice

1. Add repo-root `Cargo.toml` workspace with `members = ["packages/libobscur"]` only (do **not** pull Tauri `obscur_desktop_lib` into the workspace — separate manifest).  
2. In `packages/libobscur/src/engine_invoke.rs` tests:
   - Rename `rejects_empty_profile_id` → `session_scope_rejects_empty_profile_id`
   - Add `auth_boot_not_via_engine_invoke` asserting `dispatch` rejects engine `"auth"` and mentions `auth_boot_snapshot`
3. Leave `verify.operations.yaml` filters (`auth_boot`, `session_scope`) unchanged.  
4. Proof: `verify_operation_run` both ops @ `rc1` with `overrideKeep: true`; confirm `pass: true`.

## Non-goals

- CodaCtrl keep-set path bug for operationIds  
- Adding desktop crate to workspace  
- PAUSED dm/relay subtract  
