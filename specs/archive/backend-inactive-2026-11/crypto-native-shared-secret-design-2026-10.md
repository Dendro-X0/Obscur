# Design — Native deriveSharedSecret (B10 follow-on)

**Date (UTC):** 2026-10-17  
**Status:** Landed  
**Parent:** [crypto-subtlecrypto-inventory-b10-investigation-2026-10.md](./crypto-subtlecrypto-inventory-b10-investigation-2026-10.md)

```text
HANDOFF ATOMIC STEP: override deriveSharedSecret (fail-closed sentinel)
PAUSED / CANCELLED: Soft L3 Fixed · remount · Step C · uncapped Quiet · Tor Verified
CANONICAL OWNER: libobscur::crypto::shared_secret + wallet + NativeCryptoService
PROOF: cargo test shared_secret · cargo check desktop · native-crypto-service.test.ts
```

## Goal

Move `deriveSharedSecret` off SubtleCrypto on Tauri when identity is the native sentinel. **Not ECDH** — match existing JS: `SHA-256(utf8(privateKeyHex + publicKeyHex))`.

## Wire

| Side | Behavior |
|------|----------|
| Input | session sk hex (Rust) + peer `publicKey` hex |
| Output | 32-byte digest as **64-char hex** (IPC); TS → `Uint8Array` |

## Commands

| Command | Session? | Args | Result |
|---------|----------|------|--------|
| `derive_shared_secret` | Yes | `publicKey` | digest hex |

## Mutate

1. `packages/libobscur/src/crypto/shared_secret.rs` + export + unit test
2. wallet desktop/mobile + `lib.rs` + `app.toml`
3. `NativeCryptoService.deriveSharedSecret` — sentinel → native fail-closed; hex → `super.*`

## Non-goals

ECDH upgrade · Soft L3 · `generateSecureRandom` / `verifyEventSignature`

## Proof (executed)

| Layer | Command | Result |
|-------|---------|--------|
| L1 | `cargo test shared_secret` | **1/1** |
| L1 | `cargo check` (desktop) | **ok** |
| L1 | `vitest` native-crypto-service (+ B10) | **16/16** |

_Last updated: 2026-10-17T13:10:00Z_
