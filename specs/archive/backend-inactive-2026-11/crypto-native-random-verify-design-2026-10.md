# Design — Native secure random + invite id + event verify (B10 remainder)

**Date (UTC):** 2026-10-17  
**Status:** Landed  
**Parent:** [crypto-subtlecrypto-inventory-b10-investigation-2026-10.md](./crypto-subtlecrypto-inventory-b10-investigation-2026-10.md)

```text
HANDOFF ATOMIC STEP: remaining B10 inherited — generateSecureRandom / generateInviteId / verifyEventSignature
PAUSED / CANCELLED: Soft L3 Fixed · remount · uncapped Quiet · Tor Verified
PRIOR SOAK: Atom A blocked (no HS) · Atom B T1 Fail (TLS_ERROR) — do not patch-loop
CANONICAL OWNER: libobscur + wallet + NativeCryptoService
PROOF: cargo test · cargo check desktop · native-crypto-service.test.ts · B10 allowlist
```

## Goal

On Tauri, override the last product crypto inheritances that still hit browser RNG / JS event verify:

| Method | Algorithm |
|--------|-----------|
| `generateSecureRandom(n)` | `getrandom` → bytes as hex (IPC) → `Uint8Array` |
| `generateInviteId()` | 16 secure random bytes → hex (same as Impl) |
| `verifyEventSignature(event)` | `nostr` crate verify (id + schnorr) |

Fail-closed: native errors throw (no `super` fallback on Tauri for these three).

## Commands

| Command | Session? | Args | Result |
|---------|----------|------|--------|
| `generate_secure_random` | No | `length: u32` | hex string (`length` bytes) |
| `verify_nostr_event` | No | event fields JSON or structured | `bool` |

`generateInviteId` = `generate_secure_random(16)` in TS (no separate command).

## Non-goals

ECDH · Soft L3 · Matrix Atom A · Tor Verified · deleting CryptoServiceImpl

## Proof (executed)

| Layer | Command | Result |
|-------|---------|--------|
| L1 | `cargo test` secure_random + verify_nostr | **3/3** |
| L1 | `cargo check` (desktop) | **ok** |
| L1 | `vitest` native + B10 | **17/17** |

_Last updated: 2026-10-17T14:05:00Z_
