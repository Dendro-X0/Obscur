# Design — Delete dead `shouldPreferBrowserUploadForRuntimeSafety` (Track B7)

**Date (UTC):** 2026-10-15  
**Status:** Landed  
**Parent:** [nip96-tauri-oversized-native-only-design-2026-10.md](./nip96-tauri-oversized-native-only-design-2026-10.md)

```text
HANDOFF ATOMIC STEP: Track B7 — remove always-false browser-prefer stub
PAUSED / CANCELLED: Soft L3 · remount · Step C · uncapped Quiet · community reopen
CANONICAL OWNER: media-upload-policy (subtract)
PROOF: media-upload-policy.test.ts · nip96-upload-service.test.ts
```

## Why

B5 forced `shouldPreferBrowserUploadForRuntimeSafety` → always `false`; B6 removed the last caller. The export is dead surface.

## Mutate

1. Delete export from `media-upload-policy.ts`.
2. Delete related policy tests.
3. Leave `MEDIA_RUNTIME_SAFETY_LIMITS.nativeDirectUploadBytes` (still used by cache/bypass helpers).

## Proof (executed)

| Layer | Command | Result |
|-------|---------|--------|
| L1 | `vitest run media-upload-policy.test.ts nip96-upload-service.test.ts` | **19/19** |

## Non-goals

Group encrypt · Soft L3 · Quiet

_Last updated: 2026-10-15T14:10:00Z_
