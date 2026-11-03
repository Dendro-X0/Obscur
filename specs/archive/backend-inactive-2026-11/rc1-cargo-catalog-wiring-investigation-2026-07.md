# Investigation — RC1 `verify_operation_run` catalog wiring (2026-07-30)

**Status:** Investigated · unblock design ready  
**Charter:** [rust-module-refactor-queue-2026-07.md](./rust-module-refactor-queue-2026-07.md) · MF-7 in [codactrl-mcp-first-agent-surface-2026-07.md](./codactrl-mcp-first-agent-surface-2026-07.md)

---

## Session gate

```text
NEXT ATOMIC STEP:     Rust refactor — RC1 prove
PAUSED / CANCELLED:   community · relay-publish · dm-persist · Dev Lab
OUT OF SCOPE:         Handler deletes · PAUSED bands · CodaCtrl daemon source (external)
```

---

## Evidence

| Attempt | Result |
|---------|--------|
| `verify_operation_run` without override | `path auth-boot-snapshot outside keep-set` (operationId treated as path — use `overrideKeep=true`) |
| `verify_operation_run` + `overrideKeep` | `exit 101` — `could not find Cargo.toml` at repo root |
| `cargo test auth_boot` in `packages/libobscur` | **0 tests** match filter |
| `cargo test session_scope` in `packages/libobscur` | **0 tests** match filter |

Step target from proof artifact: `cargo test -p libobscur auth_boot` (expects a **workspace** at repo root).

Repo today: only `packages/libobscur/Cargo.toml` and `apps/desktop/src-tauri/Cargo.toml` — **no root workspace**.

Desktop does have real auth boot unit tests (`commands/auth_boot.rs` · `boot_phase_*`) but MCP catalog does not use `--manifest-path apps/desktop/src-tauri/Cargo.toml`.

---

## Verdict

RC1 catalog is **wiring-false**, not a product auth regression. Unblock without PAUSED mutate:

1. Root virtual workspace member = `packages/libobscur` so `-p libobscur` works from repo root.  
2. Name libobscur tests so filters `auth_boot` / `session_scope` match real assertions (auth not on `engine_invoke`; empty `profileId` rejected).  
3. Re-prove via MCP with `overrideKeep=true` until keep-set path bug is fixed upstream.  
4. Optionally document desktop `auth_boot` tests as agent-side `cargo test --manifest-path …` (not MCP until CodaCtrl supports manifestPath).

---

## Claim language

| May say | When |
|---------|------|
| Investigated | This doc |
| RC1 verified | MCP `pass: true` for both ops after wiring fix |
| Auth F5 fixed | Already L3 — do not re-open from this RC1 wiring issue |
