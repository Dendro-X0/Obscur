# Design — Single-door unlock (one secret to chat)

**Date:** 2026-11-01  
**Status:** Slice A+B+C **landed** (L1/L2) 2026-11-01 · optional L3 desktop soak  
**Parents:** auth-wallet-unlock-design · private-key-unlock-vault-gate · soft-lock slice 3  
**Sibling:** [auth-continuity-audience-deliberation-2026-11.md](./auth-continuity-audience-deliberation-2026-11.md) — three-plane model; this design is **Planes 1–2 only** (Daily unlock + Recovery). Plane 3 Continuity (cross-device history) is a separate band — do not mix Continuity honesty UI or BKP-2 into Slice A/B/C.  
**Problem:** Users still face **hex + device password** (or password after key) before chat. UI polish did not remove the second door.

## Product rule

> **One door per session.** Opening Obscur to chat must never require both a 64-char key and a password in the same unlock path.

Cryptographic root stays the keypair. Daily face stays a **device password**. Hex is **recovery**, not a second concurrent gate.

## Why the double door exists today

| Layer | Secret | Opens |
|-------|--------|-------|
| Identity wrap | Device passphrase (or raw key) | Signing / “logged in” |
| At-rest PDK | Same passphrase (or OS keychain copy of PDK) | SQLite / chat writes |

Advanced **key** unlock opens identity only. PDK still needs passphrase **or** keychain restore. Soft-lock honesty made that second prompt clearer — it did not remove it.

Wallet design deferred **keychain silent restore as gate**. That deferral is now the convenience cliff.

## Chosen approach: Single Door = Device Password (+ keychain PDK)

```text
Daily:     password → identity + PDK (+ write PDK to keychain)
Restart:   password → both  OR  stay-signed-in session + keychain PDK restore → both (no UI)
Recovery:  Advanced key → MUST complete “Device password for this computer” once
           → wrap/repair identity + activate PDK + keychain  → thereafter daily password only
Never:     key + password every launch
```

### Slice A — Kill double prompt after key recovery (P0)

1. After successful Advanced key unlock, if `ensureNativeSqliteOpenForWrites` fails:  
   **do not** drop into soft-lock Identity/Local-data as a second product.  
   Stay on Auth with one step: **Set / enter device password for this computer** (copy: “Opens chat data on this device. Next time, only this password.”).  
2. Submit → `activateNativeStorageAtRestUnlock` + optional re-wrap identity if needed → Welcome Back **once**.  
3. Soft-lock LockScreen remains a **fallback** if shell drifts mid-session, still password-only (never ask for hex).

### Slice B — Make daily password actually sufficient (P0)

1. Diagnose Tester1 path: passphrase unlock must open PDK in the same call (`requireNativeOpen` already on passphrase path).  
2. If users land on Advanced because password “fails” due to wrong label / wrong secret (DemoUser poison): display sync (landed) + repair on unlock.  
3. Prefer passphrase primary; Advanced stays collapsed.

### Slice C — Keychain PDK restore after any identity unlock (**landed** L1/L2)

1. After passphrase **or** key identity unlock, always attempt PDK open via `syncNativeVaultEncryptionSessionAfterIdentityUnlock` (activate and/or `restoreNativeVaultEncryptionSessionIfNeeded`).  
2. Auth Advanced key path: restore-first; if restore succeeds → Welcome Back (no bind UI).  
3. Wallet design amended: keychain silent restore **allowed for PDK only** (not identity silent unlock without consent).

### Explicitly rejected

| Idea | Why not |
|------|---------|
| Derive PDK from private key for existing envelopes | Existing SQLite ciphertext is passphrase-PDK; key-derived PDK won’t decrypt without re-encrypt migration |
| Drop at-rest encryption | Violates storage honesty |
| OAuth / server unlock | Forbidden |
| Keep hex as daily primary | Wallet decision stands |

## Proof

| Layer | Check |
|-------|--------|
| L1 | After key unlock + vault fail → Auth `device_password_bind`; keychain restore success → Welcome Back without bind |
| L2 | auth-screen + `native-storage-at-rest-service.sqlite-gate` Slice C cases Pass |
| L3 | Desktop: Advanced key once → set device password → lock → password only → chat; restart with keychain PDK (optional soak) |

## Non-goals this band

OAuth · Soft L3 · changing Argon2 PDK params · mnemonic seed · Plane 3 Continuity UI · BKP-2 (backup publish from SQLite) · cross-device history claims

## Scope boundary (Planes 1–2)

| In scope (A/B/C) | Out of scope (sibling Continuity) |
|------------------|-----------------------------------|
| One door per session on **this** device | New-device conversation restore honesty states |
| Device-password bind after Advanced key | Encrypted account backup body completeness (BKP-2) |
| Keychain PDK restore after identity unlock | Relay replay / empty-inbox messaging |

Audience stance and Continuity state enum (`empty | replaying | restored_partial | restored_full`): see sibling deliberation.

## Maintainer decision needed

1. Accept [auth-continuity-audience-deliberation-2026-11.md](./auth-continuity-audience-deliberation-2026-11.md).  
2. Approve **Slice A+B** (single door after recovery + passphrase primary honesty), with **Slice C** as immediate follow-on for restart without typing when keychain holds PDK.
