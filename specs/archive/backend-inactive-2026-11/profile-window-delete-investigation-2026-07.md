# Profile window delete — identity survives after wipe (2026-07)

## Symptom

After Settings → Identity → **Delete / reset profile window**, the shell returns to auth **Welcome back** and the user can still **Unlock** with the short device password. Expected: no local identity evidence; window removed or reset to greenfield.

## Root cause

`deleteCurrentProfileWindowCompletely` delegated identity removal to `identity.forgetIdentity()` with a **swallowed catch**. `forgetIdentity` runs **local storage / IndexedDB clear first**, then native keychain deletion. If durable storage clear throws, `forgetIdentity` aborts before `deleteNativeKey` / `logout_native`, leaving OS keychain + auth-assistant vault intact. Reload bootstraps from keychain → returning-user auth UX.

Secondary gaps:

- Device trust / remember-me artifacts not revoked on profile-window delete
- `endNativeDeviceSignInBestEffort` not guaranteed (only reached after storage clear in `forgetIdentity`)
- Archive-dialog reload without hard reset left in-memory identity owners warm until reload

## Canonical owner

`apps/pwa/app/features/profiles/services/purge-profile-window-identity.ts` (new) — called from `delete-current-profile-window.ts` before workspace wipe.

## Fix order (resilient)

1. `endNativeDeviceSignInBestEffort` (OS keychain)
2. `runAuthKernelSignOutCleanup` (auth-assistant vault)
3. `revokeDeviceTrust` + `clearDeviceTrustArtifacts`
4. `clearIdentityRecordsFromLocalStorage` + `clearProfileLocalData`
5. `clearStoredIdentity` (best-effort)
6. Workspace wipe + registry remove (existing)

## Proof

- L1: `purge-profile-window-identity.test.ts`, `delete-current-profile-window.test.ts`
- L2: `pnpm verify:engine-lab` slice if available
- L3: dev desktop — delete secondary window → auth shows **new user** path; default reset → greenfield; CodaCtrl digest after repro
