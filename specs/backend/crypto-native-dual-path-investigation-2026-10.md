# Investigation — Native crypto dual path (Track B2 candidate)

**Date (UTC):** 2026-10-15  
**Status:** Inventory complete · B2 fail-closed landed  

**Parent:** [ts-backend-to-rust-migration-status-investigation-2026-10.md](./ts-backend-to-rust-migration-status-investigation-2026-10.md)  
**Prior landed:** [db-insert-upsert-legacy-parallel-tombstone-design-2026-10.md](./db-insert-upsert-legacy-parallel-tombstone-design-2026-10.md)

```text
HANDOFF ATOMIC STEP: Track B2 — next one-owner Rust-first subtraction (spec before code)
PAUSED / CANCELLED: Soft L3 · remount · Step C · uncapped Quiet · community reopen
CANONICAL OWNER (target): Rust wallet::* / protocol_* via native invoke — not browser @noble on Tauri
PROOF (this doc): inventory only — no mutate
```

## Context after B1

Bare `db_insert_message` / `db_upsert_conversation` are gone. `allow-db-commands` is engine_invoke-family only. No product `invoke("db_*")` remains under `apps/pwa/app`.

## Finding

On Tauri, `crypto-service.ts` selects `NativeCryptoService`, which **extends** `CryptoServiceImpl` (browser `@noble` / SubtleCrypto). Identity/DM/gift-wrap paths prefer Rust `wallet::*` IPC, then **fall back** to `super.*` (JS crypto) on native failure.

| Surface | Native (Rust) | Still inherits / JS path |
|---------|---------------|--------------------------|
| Session / keychain | `initNativeSession`, `clearNativeSession`, `hasNativeKey`, … | — |
| Sign / encrypt DM / NIP-44 / gift-wrap | `sign_event_native`, `encrypt_nip04/44`, `encrypt_gift_wrap`, … | `super.*` on invoke fail |
| Group room encrypt/decrypt | — | `CryptoServiceImpl` only (SubtleCrypto) |
| Invite / random / verify helpers | — | `CryptoServiceImpl` only |
| Rumor id hash | SubtleCrypto in native module | FNV-style fallback |

Also registered (already Rust, not dual JS): `protocol_*` (x3dh, ratchet, envelope verify) — out of scope for “subtract TS”; keep as-is.

## Recommended next mutate (one slice)

**Do not wholesale rewrite crypto.** First design should pick **one** subtractable class:

1. **Preferred:** Group message encrypt/decrypt on Tauri — add Rust wallet commands (or reuse existing) + override in `NativeCryptoService` with **no** `super` fallback when native key is present.  
2. **Alt:** Fail-closed native DM/sign paths — remove `super.encryptDM` / `super.signEvent` fallback when `hasNativeKey()` is true (subtraction of silent dual path).

## Non-goals

Soft L3 · uncapped Quiet · deleting `CryptoServiceImpl` (PWA/browser still needs it) · coordination Worker

_Last updated: 2026-10-15T16:55:00Z_
