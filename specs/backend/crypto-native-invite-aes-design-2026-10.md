# Design — Native invite AES-GCM (Track B9)

**Date (UTC):** 2026-10-15  
**Status:** Landed  
**Parent:** [crypto-native-group-encrypt-design-2026-10.md](./crypto-native-group-encrypt-design-2026-10.md)

```text
HANDOFF ATOMIC STEP: Track B9 — invite AES native (B8 follow-on)
PAUSED / CANCELLED: Soft L3 · remount · Step C · uncapped Quiet · community reopen
CANONICAL OWNER: libobscur::crypto::invite_aes + wallet + NativeCryptoService
PROOF: cargo test invite_aes · cargo check desktop · native-crypto-service.test.ts
```

## Wire format (match CryptoServiceImpl)

- Key: 32 raw bytes (IPC as 64-char hex)
- Encrypt: AES-256-GCM, 12-byte IV → `base64(iv || ct_with_tag)` (**no** `?v=` suffix)
- Decrypt: base64-decode; IV = first 12 bytes

## Commands

| Command | Args | Result |
|---------|------|--------|
| `encrypt_invite_data` | `plaintext`, `keyHex` | base64 wire |
| `decrypt_invite_data` | `ciphertext`, `keyHex` | plaintext |

## Mutate

1. `packages/libobscur/src/crypto/invite_aes.rs` + export + roundtrip test
2. wallet desktop/mobile + `lib.rs` + `app.toml`
3. `NativeCryptoService.encryptInviteData` / `decryptInviteData` — fail-closed

## Proof (executed)

| Layer | Command | Result |
|-------|---------|--------|
| L1 | `cargo test invite_aes` | **2/2** |
| L1 | `cargo check` (desktop) | **ok** |
| L1 | `vitest run native-crypto-service.test.ts` | **9/9** |

## Non-goals

`signInviteData` / schnorr · Soft L3 · Quiet · change wire format

_Last updated: 2026-10-15T14:28:00Z_
