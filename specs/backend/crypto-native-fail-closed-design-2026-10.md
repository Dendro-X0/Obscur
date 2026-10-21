# Design — Fail-closed native identity crypto (Track B2)

**Date (UTC):** 2026-10-15  
**Status:** Landed  
**Parent:** [crypto-native-dual-path-investigation-2026-10.md](./crypto-native-dual-path-investigation-2026-10.md)

```text
HANDOFF ATOMIC STEP: Track B2 — crypto dual-path one-slice design + mutate
PAUSED / CANCELLED: Soft L3 · remount · Step C · uncapped Quiet · community reopen
CANONICAL OWNER: Rust wallet::* for NATIVE_KEY_SENTINEL ops
PROOF: native-crypto-service.test.ts (fail-closed) · no product regress contract if present
```

## Choice

**Slice A — fail-closed** (not group encrypt). Subtraction: stop pulling session `nsec` into JS via `resolveFallbackPrivateKey` + `super.*` when the identity sentinel is used.

Group encrypt (slice B) needs new Rust commands — defer.

## Invariant

When `privateKey` / sender / recipient is `NATIVE_KEY_SENTINEL`:

1. Invoke Rust only (`sign_event_native`, `encrypt_nip04/44`, `decrypt_*`, `encrypt/decrypt_gift_wrap`).
2. On failure: **rethrow** — do not call `get_session_nsec` / `super.*`.
3. Real hex keys (ephemeral gift-wrap, etc.) still use `CryptoServiceImpl` unchanged.
4. `resolveIdentityPrivateKeyForSigning` remains the **explicit** opt-in for JS-only coordination signing.

## Mutate

1. `native-crypto-service.ts` — remove sentinel → `resolveFallbackPrivateKey` → `super.*` catch paths for sign / DM / NIP-44 / gift-wrap.
2. Flip `native-crypto-service.test.ts` expectations from “falls back to JS” → “rejects / does not call super”.
3. Leave `generateKeyPair` web fallback (bootstrap before session) out of this slice.

## Proof (executed)

| Layer | Command | Result |
|-------|---------|--------|
| L1 | `vitest run native-crypto-service.test.ts` | **6/6** |

## Non-goals

Delete `CryptoServiceImpl` · group AES Rust · Soft L3 · Quiet

_Last updated: 2026-10-15T17:02:00Z_
