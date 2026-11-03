# Design — Soft-lock drift slice 3 (passphrase reopens SQLite)

**Date (UTC):** 2026-10-13  
**Status:** Implemented · **L1 Pass** (2026-10-13) · L3 deferred (client unusable)  
**Parents:** [soft-lock-sqlite-shell-drift-design-2026-10.md](./soft-lock-sqlite-shell-drift-design-2026-10.md) · slice 2 · EG-LOG P5 blocked (`DbState.db = None`, keychain PDK `null`)

```text
HANDOFF ATOMIC STEP: Soft-lock slice 3 — passphrase on LockScreen must reopen SQLite (PDK unlock)
PAUSED / CANCELLED:  Shell-lag until end · M1–M3 · dialects · ASE-2 · SF-B · NIM until P0 · PB1-D A
CANONICAL OWNER:     native-storage-at-rest-service · main-shell handleUnlock · soft-lock unlock policy
PROOF BEFORE DONE:   L1 — activate checks invoke ok · storage-only unlock path when identity already unlocked
SURFACE:             LockScreen when nativeSqliteWriteBlocked
```

---

## Gap

Slice 2 shows LockScreen when SQLite writes are blocked while identity UI is unlocked. Operator enters passphrase, but:

1. `activateNativeStorageAtRestUnlock` does not check `desktop_storage_at_rest_unlock` result (silent fail).  
2. `handleUnlock` always runs full `unlockIdentity`, which on wrong password **re-locks** identity even when the user only needed storage reopen.  
3. Keychain PDK may be null after soft-lock — passphrase → PDK derive → native unlock is the recovery path.

## Contract

| Situation | Unlock path |
|-----------|-------------|
| Identity locked | Existing `unlockIdentity` + vault sync (must observe native unlock ok) |
| Identity unlocked + `nativeSqliteWriteBlocked` | **Storage-only:** `activateNativeStorageAtRestUnlock` → reprobe; do **not** call `unlockIdentity` |
| Native unlock fail | Stay on LockScreen; identity status unchanged if already unlocked |

## Wire

1. `activateNativeStorageAtRestUnlock` → `Promise<boolean>` (false when no key material or invoke `!ok`).  
2. Pure `resolveSoftLockUnlockMode({ identityStatus, nativeSqliteWriteBlocked })` → `identity` \| `storage_only`.  
3. `handleUnlock`: storage_only → activate + reprobe (no `unlockIdentity`).  
4. Identity passphrase unlock: `requireNativeOpen` so silent PDK fail cannot leave a false “unlocked + writable” story.  
5. Wrong-password while already unlocked: do not force re-lock (storage recovery recoverable).  
6. L1 tests for boolean activate + mode resolver.

## Non-goals

- Soft Lock menu / CDP wedge  
- L3 dual-profile P5 soak (shell still fragile)  
- Changing PDK derivation

## Proof

- **L1 Pass:** activate returns false when invoke fails; true when unlock ok · mode resolver storage_only vs identity · sqlite-gate suite green  
- **L3:** deferred until client usable (P5 group send after passphrase reopen)  

---

_Last updated: 2026-10-13_
