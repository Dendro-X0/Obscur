# Design — Subtract Tauri NIP-96 browser fallback (Track B6)

**Date (UTC):** 2026-10-15  
**Status:** Landed  
**Parent:** [nip96-tauri-oversized-native-only-design-2026-10.md](./nip96-tauri-oversized-native-only-design-2026-10.md)

```text
HANDOFF ATOMIC STEP: Track B6 — subtract remaining tauri_browser_fallback
PAUSED / CANCELLED: Soft L3 · remount · Step C · uncapped Quiet · community reopen
CANONICAL OWNER: Rust nip96_upload_v2
PROOF: nip96-upload-service.test.ts (+ native-fail no browser call)
```

## Why

After B4/B5, `uploadViaTauriWithFallback` still attempts browser NIP-98 when native fails **if** constructor hex exists. On desktop identity the key is `NATIVE_KEY_SENTINEL` → resolve returns null → fallback never runs. The branch is leftover dual-path surface.

## Invariant

1. Tauri production path: native only — on failure, log + rethrow (no `uploadViaBrowser`).
2. Remove dead `preferBrowserForRuntimeSafety` branch (always false since B5).
3. Keep optional `shouldPreferBrowserPathInDev` (env-gated) for local CORS experiments — still needs constructor hex after B4.
4. PWA/browser path unchanged.

## Mutate

1. Collapse `uploadViaTauriWithFallback` → native try/log/throw (delete browser branch + helpers only used there).
2. Delete dead runtime-safety browser branch in `uploadFile`.
3. L1: native fail does not call `uploadViaBrowser`.

## Proof (executed)

| Layer | Command | Result |
|-------|---------|--------|
| L1 | `vitest run nip96-upload-service.test.ts media-upload-policy.test.ts` | **20/20** |

## Non-goals

Group encrypt · Soft L3 · Quiet · delete `get_session_nsec` IPC

_Last updated: 2026-10-15T14:08:30Z_
