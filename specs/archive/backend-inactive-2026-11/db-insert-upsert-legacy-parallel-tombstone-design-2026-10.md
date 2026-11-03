# Design — Tombstone LEGACY_PARALLEL `db_insert_message` / `db_upsert_conversation`

**Date (UTC):** 2026-10-15  
**Status:** Landed  
**Parent:** [ts-backend-to-rust-migration-status-investigation-2026-10.md](./ts-backend-to-rust-migration-status-investigation-2026-10.md)  
**Prior:** [engine-invoke-boundary-subtract-design-2026-07.md](./engine-invoke-boundary-subtract-design-2026-07.md)

```text
HANDOFF ATOMIC STEP: Track B — migrate TS server-side to Rust; subtract replaced modules
PAUSED / CANCELLED: Soft L3 · remount · Step C · uncapped Quiet · community reopen
CANONICAL OWNER: libobscur dispatch_dm insertMessage / upsertConversation
PROOF: engine-invoke-boundary-catalog + dm-persist-owner contracts · cargo check desktop
```

## Goal

Durable DM write already lands via `engine_invoke` → Rust. Remove the replaced bare IPC + `@dweb/db` wrappers so there is **one** write surface.

## Mutate

1. Unregister + remove `db_insert_message` / `db_upsert_conversation` from Tauri `db.rs` / `lib.rs` / `app.toml`
2. Remove `dbInsertMessage` / `dbUpsertConversation` from `packages/db`
3. Flip boundary catalog: assert **absent** (not LEGACY_PARALLEL present)
4. Fix stale comments / tests that still name bare IPC as product path

## Proof (executed)

| Layer | Command | Result |
|-------|---------|--------|
| L1 | `vitest run engine-invoke-boundary-catalog.contract.test.ts dm-persist-owner.contract.test.ts` | **28/28** |
| L1 | `cargo check` (apps/desktop/src-tauri) | **ok** |

## Non-goals

Crypto wholesale · coordination Worker · Soft L3 · community PAUSED bands

_Last updated: 2026-10-15T16:52:30Z_
