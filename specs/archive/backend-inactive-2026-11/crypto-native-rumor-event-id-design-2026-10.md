# Design — Native rumor event id (B10 preferred mutate)

**Date (UTC):** 2026-10-17  
**Status:** Landed  
**Parent:** [crypto-subtlecrypto-inventory-b10-investigation-2026-10.md](./crypto-subtlecrypto-inventory-b10-investigation-2026-10.md)

```text
HANDOFF ATOMIC STEP: migrate deriveRumorEventId → Rust (subtract SubtleCrypto from native module)
PAUSED / CANCELLED: Soft L3 Fixed · remount · Step C · uncapped Quiet · Tor Verified
CANONICAL OWNER: libobscur::crypto::nip01::derive_rumor_event_id + wallet + NativeCryptoService
PROOF: cargo test derive_rumor_event_id · cargo check desktop · native-crypto-service.test.ts · B10 allowlist
```

## Goal

Remove the last `crypto.subtle` call inside `native-crypto-service.ts` by computing NIP-01 event ids in Rust. Fail-closed: no SubtleCrypto and no FNV fallback on Tauri.

## Wire / algorithm

NIP-01 id = lowercase hex SHA-256 of UTF-8 JSON serialization:

`[0, <pubkey>, <created_at>, <kind>, <tags>, <content>]`

Use `nostr::EventId::new` (same crate already used by gift-wrap / PoW).

## Command

| Command | Session? | Args | Result |
|---------|----------|------|--------|
| `derive_rumor_event_id` | No | `pubkey`, `createdAt`, `kind`, `tags`, `content` | 64-char hex id |

## Mutate

1. `libobscur::crypto::nip01::derive_rumor_event_id` + unit test (deterministic hex)
2. wallet desktop + mobile + `lib.rs` register + `app.toml` allow
3. TS `deriveRumorEventId` → `invokeNativeCommand` only; delete SubtleCrypto + FNV
4. B10 allowlist: drop `native-crypto-service.ts`

## Non-goals

- invite sign/verify · deriveSharedSecret · Soft L3 · browser CryptoServiceImpl digest helpers

## Proof (executed)

| Layer | Command | Result |
|-------|---------|--------|
| L1 | `cargo test derive_rumor_event_id` (libobscur) | **2/2** |
| L1 | `cargo check` (desktop src-tauri) | **ok** |
| L1 | `vitest` native-crypto-service + B10 allowlist | **14/14** |

_Last updated: 2026-10-17T11:45:00Z_
