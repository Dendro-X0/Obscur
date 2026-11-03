# Investigation — Native group encrypt/decrypt (Track B8 candidate)

**Date (UTC):** 2026-10-15  
**Status:** Inventory · design not started  
**Parent:** [crypto-native-dual-path-investigation-2026-10.md](./crypto-native-dual-path-investigation-2026-10.md)

```text
HANDOFF ATOMIC STEP: Track B8 — next Rust-first slice after B7 stub delete
PAUSED / CANCELLED: Soft L3 · remount · Step C · uncapped Quiet · community reopen
CANONICAL OWNER (target): Rust wallet::* group AES + NativeCryptoService override
PROOF (this doc): inventory only
```

## Finding

`NativeCryptoService` does **not** override `generateRoomKey` / `encryptGroupMessage` / `decryptGroupMessage` — Tauri inherits `CryptoServiceImpl` (SubtleCrypto AES-GCM, wire `base64(iv||ct)?v=1`). DM/NIP-44/gift-wrap already fail-closed to Rust (B2).

Callers: `group-thread-relay-ingest` (decrypt) · sealed community paths · `scripts/lib/community-bot-crypto.mjs` (Node twin of same AES-GCM).

No existing Tauri command for room-key AES in wallet (NIP-04/44/17 only). Native group crypto needs **new** Rust commands + JS overrides — not pure subtraction. Wire format must stay `?v=1`-compatible with bot/scripts.

## Recommended next

Write `crypto-native-group-encrypt-design-2026-10.md` before any mutate: wire format, command names, fail-closed when native session present, keep `CryptoServiceImpl` for PWA.

## Non-goals

Soft L3 · Quiet · community PAUSED bands · deleting browser SubtleCrypto path

_Last updated: 2026-10-15T14:10:00Z_
