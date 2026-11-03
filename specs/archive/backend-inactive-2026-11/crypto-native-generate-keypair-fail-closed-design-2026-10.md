# Design — Fail-closed native `generateKeyPair` (Track B3)

**Date (UTC):** 2026-10-15  
**Status:** Landed  
**Parent:** [crypto-native-dual-path-investigation-2026-10.md](./crypto-native-dual-path-investigation-2026-10.md)  
**Prior:** [crypto-native-fail-closed-design-2026-10.md](./crypto-native-fail-closed-design-2026-10.md)

```text
HANDOFF ATOMIC STEP: Track B3 — generateKeyPair fail-closed (no web fallback on Tauri)
PAUSED / CANCELLED: Soft L3 · remount · Step C · uncapped Quiet · community reopen
CANONICAL OWNER: Rust generate_native_nsec via NativeCryptoService
PROOF: native-crypto-service.test.ts (+ generateKeyPair fail-closed case)
```

## Choice

Continue B2 subtraction: on Tauri, `NativeCryptoService.generateKeyPair` must not fall back to `CryptoServiceImpl` / `@noble` when `generate_native_nsec` fails. Fail closed so identity never lands as a browser-held hex key under the native service.

Deferred: group encrypt · wholesale `get_session_nsec` subtract (export/portability still need it).

## Invariant

1. `generateKeyPair` → invoke `generate_native_nsec` only.
2. On failure: log `actionable` + **rethrow** (no `super.generateKeyPair()`).
3. Browser/`CryptoServiceImpl` path unchanged (PWA still uses JS keygen).

## Mutate

1. `native-crypto-service.ts` — remove web fallback in `generateKeyPair`.
2. `native-crypto-service.test.ts` — assert reject + no `super.generateKeyPair` call.

## Proof (executed)

| Layer | Command | Result |
|-------|---------|--------|
| L1 | `vitest run native-crypto-service.test.ts` | **7/7** |

## Non-goals

Group AES Rust · delete `get_session_nsec` · Soft L3 · Quiet

_Last updated: 2026-10-15T13:50:00Z_
