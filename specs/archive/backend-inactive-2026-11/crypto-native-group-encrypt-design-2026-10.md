# Design — Native group AES-GCM (Track B8)

**Date (UTC):** 2026-10-15  
**Status:** Landed  
**Parent:** [crypto-native-group-encrypt-investigation-2026-10.md](./crypto-native-group-encrypt-investigation-2026-10.md)

```text
HANDOFF ATOMIC STEP: Track B8 — native group encrypt/decrypt design + mutate
PAUSED / CANCELLED: Soft L3 · remount · Step C · uncapped Quiet · community reopen
CANONICAL OWNER: libobscur::crypto::group_aes + wallet::* + NativeCryptoService
PROOF: libobscur unit test · cargo check desktop · native-crypto-service.test.ts
```

## Wire format (frozen — match JS/bot)

- Key: 32-byte hex room key
- Encrypt: AES-256-GCM, 12-byte random IV, ciphertext = `base64(iv || ct_with_tag) + "?v=1"`
- Decrypt: strip `?v=*`, base64-decode, IV = first 12 bytes

## Commands (no session — room key is argument)

| Command | Args | Result |
|---------|------|--------|
| `generate_group_room_key` | — | 64-char hex |
| `encrypt_group_message` | `plaintext`, `roomKeyHex` | wire string |
| `decrypt_group_message` | `ciphertext`, `roomKeyHex` | plaintext |

## Mutate

1. `packages/libobscur/src/crypto/group_aes.rs` + mod export + roundtrip test
2. Desktop + mobile `wallet.rs` thin wrappers; register in `lib.rs` + `app.toml`
3. `NativeCryptoService` override three methods — fail-closed (no `super`)

## Proof (executed)

| Layer | Command | Result |
|-------|---------|--------|
| L1 | `cargo test group_aes` (libobscur) | **3/3** |
| L1 | `cargo check` (desktop) | **ok** |
| L1 | `vitest run native-crypto-service.test.ts` | **8/8** |

## Non-goals

Delete `CryptoServiceImpl` group path (PWA) · Soft L3 · Quiet · change `?v=1` wire

_Last updated: 2026-10-15T14:20:00Z_
