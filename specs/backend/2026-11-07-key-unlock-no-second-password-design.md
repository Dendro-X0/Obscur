# Design — Key unlock without second password (2026-11-07)

```text
HANDOFF ATOMIC STEP: key login must not require password again
PAUSED: Soft L3 · Tor · Matrix · Continuity promote
```

## Rule

After a successful private-key identity unlock for a returning account, enter the shell with Welcome Back. Do **not** set `devicePasswordBindPending` / bind UI.

## Behavior

1. Unlock identity with key (unchanged).
2. Best-effort PDK: restore keychain / ensure SQLite open.
3. Always clear bind-pending and show Welcome Back — even if PDK reopen fails.
4. Optional: first-time import may still offer optional device-password setup with Skip (unchanged).
5. Mid-session soft-lock / write-blocked honesty remains available later without blocking the key door.

## Proof

- L1: Advanced key unlock with closed storage → Welcome Back, no `auth-device-password-bind`
- L1: keychain restore success path still Welcome Back (regression)
- Keep remount FM1 test for module-pending recovery (other callers)

## Out of scope

Soft L3, derive PDK from nsec, Continuity, OAuth
