# Design — Tauri oversized upload stays native (Track B5)

**Date (UTC):** 2026-10-15  
**Status:** Landed  
**Parent:** [nip96-session-nsec-fallback-subtract-design-2026-10.md](./nip96-session-nsec-fallback-subtract-design-2026-10.md)

```text
HANDOFF ATOMIC STEP: Track B5 — oversized-video upload native-only on Tauri
PAUSED / CANCELLED: Soft L3 · remount · Step C · uncapped Quiet · community reopen
CANONICAL OWNER: Rust nip96_upload_v2 / upload.rs
PROOF: media-upload-policy.test.ts · nip96-upload-service.test.ts
```

## Why

After B4, `shouldPreferBrowserUploadForRuntimeSafety` still steered large Tauri files onto `uploadViaBrowser`, which needs a hex key. With no `get_session_nsec`, that path fails with a misleading “too large” error instead of using native upload.

## Invariant

1. `shouldPreferBrowserUploadForRuntimeSafety` → always `false` (browser divert removed).
2. Tauri oversized video/audio/file → native `nip96_upload_v2` path.
3. Browser/PWA upload policy unchanged (function was native-only gate).

## Mutate

1. `media-upload-policy.ts` — fail-closed return `false`; document B4/B5.
2. Flip policy + nip96 tests that expected browser for oversized native.

## Proof (executed)

| Layer | Command | Result |
|-------|---------|--------|
| L1 | `vitest run media-upload-policy.test.ts nip96-upload-service.test.ts` | **19/19** |

## Non-goals

Stream/chunk redesign · Soft L3 · Quiet · group encrypt · delete `get_session_nsec`

_Last updated: 2026-10-15T14:00:00Z_
