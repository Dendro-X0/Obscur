# Design — Private-key unlock must open local storage (or gate honestly)

**Date:** 2026-11-01  
**Parent:** soft-lock-sqlite-shell-drift-slice3 · unlock display sync  
**Symptom:** Advanced key unlock → “Welcome Back!” → Identity Locked asking for password (`nativeSqliteWriteBlocked`).

## Contract

1. PDK / at-rest SQLite still requires device passphrase (or keychain restore). Private key alone does not derive PDK.  
2. After **successful** private-key identity unlock, Auth must either:  
   - restore/open vault (keychain / assistant / ensureNativeSqliteOpenForWrites), **or**  
   - stay on Auth with a **Unlock local data** password step — **no** Welcome Back until storage opens.  
3. Soft-lock LockScreen when `identity unlocked + sqlite blocked` must use **storage** copy (not “Identity Locked” / reset-account).

## Wire

| Piece | Change |
|-------|--------|
| AuthScreen key unlock | After `unlockBoundProfileWithPrivateKeyHex`, `ensureNativeSqliteOpenForWrites`; if false → `importKeyGuideStep = unlock_local_data` |
| unlock_local_data | `activateNativeStorageAtRestUnlock` then Welcome Back |
| LockScreen | `storageOnly` prop from main-shell when soft-lock |

## Proof

- L1: unit/helper for “vault gate after key unlock” decision if extracted  
- L2: auth-screen — key unlock with blocked sqlite stays on unlock_local_data (mock ensure false)  
- L3: optional desktop — key unlock then device password once, no double Identity Locked framing
