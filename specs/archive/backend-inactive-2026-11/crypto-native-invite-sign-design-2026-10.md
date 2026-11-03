# Design — Native invite sign / verify (B10 follow-on)

**Date (UTC):** 2026-10-17  
**Status:** Landed  
**Parent:** [crypto-subtlecrypto-inventory-b10-investigation-2026-10.md](./crypto-subtlecrypto-inventory-b10-investigation-2026-10.md)

```text
HANDOFF ATOMIC STEP: override signInviteData / verifyInviteSignature (fail-closed)
PAUSED / CANCELLED: Soft L3 Fixed · remount · Step C · uncapped Quiet · Tor Verified
CANONICAL OWNER: libobscur::crypto::invite_sign + wallet + NativeCryptoService
PROOF: cargo test invite_sign · cargo check desktop · native-crypto-service.test.ts
```

## Goal

Move invite **SHA-256 + schnorr** off SubtleCrypto/@noble on Tauri. Keep **canonicalize** in TS so existing contact-card signatures stay wire-compatible (`undefined` keys, key order).

## Algorithm (match CryptoServiceImpl)

1. `canonical = sort(keys).map(k => \`${k}:${typeof v==='object'?JSON.stringify(v):v}\`).join('|')`
2. `hashHex = sha256(utf8(canonical)).to_hex()`
3. Sign: schnorr over 32-byte digest with session sk → 64-byte hex sig  
4. Verify: schnorr verify(sig, digest, pubkey)

## Commands

| Command | Session? | Args | Result |
|---------|----------|------|--------|
| `sign_invite_data` | Yes (identity) | `canonicalData: string` | sig hex |
| `verify_invite_signature` | No | `canonicalData`, `signature`, `publicKey` | `bool` |

## Mutate

1. `packages/libobscur/src/crypto/invite_sign.rs` — hash + sign/verify using existing nip01 schnorr helpers
2. wallet desktop/mobile + `lib.rs` + `app.toml`
3. Shared `canonicalizeInviteData` in TS; `NativeCryptoService` overrides — sentinel sign fail-closed; verify always native on Tauri
4. Hex-key sign still `super.*` (ephemeral / tests)

## Non-goals

`deriveSharedSecret` · Soft L3 · change contact-card payload shape

## Proof (executed)

| Layer | Command | Result |
|-------|---------|--------|
| L1 | `cargo test invite_sign` (libobscur) | **2/2** |
| L1 | `cargo check` (desktop src-tauri) | **ok** |
| L1 | `vitest` native-crypto-service (+ B10) | **15/15** |

_Last updated: 2026-10-17T12:55:00Z_
