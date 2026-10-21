# Design — Native generateSecureRandom / generateInviteId

**Date (UTC):** 2026-10-17  
**Status:** Implementing  
**Parent:** [crypto-subtlecrypto-inventory-b10-investigation-2026-10.md](./crypto-subtlecrypto-inventory-b10-investigation-2026-10.md)

```text
HANDOFF ATOMIC STEP: remaining B10 — generateSecureRandom + generateInviteId native
PAUSED / CANCELLED: Soft L3 Fixed · remount · uncapped Quiet · Tor Verified
CANONICAL OWNER: libobscur::crypto::secure_random + wallet + NativeCryptoService
PROOF: cargo test secure_random · cargo check desktop · native-crypto-service.test.ts
```

## Context

L2 soak: Atom A blocked (no HS creds) · Atom B T1 Fail (host TLS_ERROR). Default order → remaining B10 inherited.

## Goal

On Tauri, replace `crypto.getRandomValues` in `generateSecureRandom` / `generateInviteId` with Rust `getrandom`. Fail-closed (no JS fallback).

## Wire

| Command | Args | Result |
|---------|------|--------|
| `generate_secure_random` | `length` (1..=1024) | lowercase hex of `length` bytes |

`generateInviteId` = native random length 16 → hex (32 chars).

## Mutate

1. `packages/libobscur/src/crypto/secure_random.rs`
2. wallet + `lib.rs` + `app.toml`
3. `NativeCryptoService` overrides both methods

## Non-goals

`verifyEventSignature` · Soft L3 · Tor Verified · Matrix Atom A

_Last updated: 2026-10-17T13:40:00Z_
