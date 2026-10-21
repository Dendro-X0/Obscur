# Design — Subtract NIP-96 `get_session_nsec` browser fallback (Track B4)

**Date (UTC):** 2026-10-15  
**Status:** Landed  
**Parent:** [crypto-native-dual-path-investigation-2026-10.md](./crypto-native-dual-path-investigation-2026-10.md)  
**Prior:** [crypto-native-generate-keypair-fail-closed-design-2026-10.md](./crypto-native-generate-keypair-fail-closed-design-2026-10.md)

```text
HANDOFF ATOMIC STEP: Track B4 — subtract NIP-96 get_session_nsec dual path (keep export UI)
PAUSED / CANCELLED: Soft L3 · remount · Step C · uncapped Quiet · community reopen
CANONICAL OWNER: Rust upload.rs NIP-98 for Tauri; browser path only with explicit hex
PROOF: nip96-upload-service.test.ts (no get_session_nsec on Tauri resolve)
```

## Choice

On Tauri, `Nip96UploadService.resolveFallbackPrivateKeyHex` must **not** invoke `get_session_nsec`. Native uploads already sign in Rust (`upload.rs`). Pulling session hex into JS only enabled browser CORS/dev fallbacks — dual authority after B2/B3.

Keep `get_session_nsec` for explicit export / portability / identity settings UI (out of scope).

## Invariant

1. If constructor `privateKeyHex` is valid hex → use it (PWA / explicit).
2. If Tauri and no valid constructor hex → return `null` (no native session key export).
3. Browser fallback / runtime-safety browser path without hex → existing errors (`AUTH_MISSING_KEY` / oversized message).
4. Non-Tauri: unchanged (no `get_session_nsec`).

## Mutate

1. Remove Tauri `get_session_nsec` branch from `resolveFallbackPrivateKeyHex`.
2. Add unit test: Tauri + null key → resolve returns null; `invokeNativeCommand` not called for `get_session_nsec`.

## Proof (executed)

| Layer | Command | Result |
|-------|---------|--------|
| L1 | `vitest run nip96-upload-service.test.ts` | **12/12** |

## Non-goals

Delete `get_session_nsec` IPC · change export UI · Soft L3 · Quiet · group encrypt

_Last updated: 2026-10-15T13:56:30Z_
