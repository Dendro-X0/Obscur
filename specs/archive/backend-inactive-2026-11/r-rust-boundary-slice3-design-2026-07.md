# Design — R-RUST-BOUNDARY Slice 3 (Tauri command catalog + guards)

**Status:** Implemented (L1 guards) · 2026-07-30  
**Investigation:** [r-rust-boundary-slice3-investigation-2026-07.md](./r-rust-boundary-slice3-investigation-2026-07.md)  
**Charter:** [rust-module-refactor-queue-2026-07.md](./rust-module-refactor-queue-2026-07.md)

---

## Session gate

```text
NEXT ATOMIC STEP:     Rust refactor Slice 3 — R-RUST-BOUNDARY design → implement (inventory + L1 guards)
PAUSED / CANCELLED:   community · relay-publish rewrite · dm-persist · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNER:      libobscur::engine_invoke::dispatch via `engine_invoke` (auth via `auth_boot_snapshot`)
PROOF BEFORE DONE:    L1 contract tests · optional RC1 later · no L3 required for inventory-only
OUT OF SCOPE:         Deleting db_* / relay handlers · wallet/protocol migrate · un-pausing PAUSED bands
```

---

## Target architecture (do not collapse shell into engine)

```
Shell / OS / profile / data-root / session / auth_boot
  → dedicated #[tauri::command] (KEEP)

Product engines (dm / workspace / transport typed)
  → engine_invoke → libobscur::dispatch
  → exception: engine_invoke_transport_publish_relay_event (async pool; PAUSED mutate)

Legacy SQLite (parallel today)
  → db_* via packages/db  (LEGACY_PARALLEL — no delete until dm-persist un-paused)
```

---

## Implement slice (smallest · keep-set)

1. **Catalog artifact** — keep investigation module counts + bucket table as SSOT (already written); link from charter.  
2. **L1 contract** (PWA engine-lab or desktop-adjacent vitest reading Rust sources):
   - `apps/desktop/src-tauri/src/lib.rs` desktop `generate_handler!` includes `commands::engine::engine_invoke`
   - `packages/libobscur/src/engine_invoke.rs` `dispatch` rejects `"auth"` with message pointing at `auth_boot_snapshot`
   - `commands/engine.rs` calls `libobscur::engine_invoke::dispatch` (no second dispatcher)
3. **No handler deletion** this slice.  
4. **Proof:** named vitest pass only.

Optional follow-up (separate atomic step, still no PAUSED mutate): RC1 `verify_operation_run` for `auth-boot-snapshot` / `session-scope-isolation` with correct `obscur_desktop_lib` cwd.

---

## Explicit non-goals

- Subtracting any of the 27 `db_*` commands  
- Changing `relay::*` or transport publish routing  
- Moving auth into `engine_invoke`  
- Wallet / protocol / LES consolidation  

---

## Claim language

| May say | When |
|---------|------|
| Designed | This doc |
| Implemented | L1 guards green |
| Verified (boundary) | L1 + (later) RC1 named ops |
| Fixed (single SQLite path) | After dm-persist un-pause + subtract design — **not** Slice 3 |
