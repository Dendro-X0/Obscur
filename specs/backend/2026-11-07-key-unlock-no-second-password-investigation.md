# Investigation — Private key unlock still demands device password (2026-11-07)

```text
HANDOFF ATOMIC STEP: key login must not require password again
PAUSED: Soft L3 · Tor · Matrix · Continuity promote
CANONICAL OWNER: AuthScreen handleLoginFinal (returning key) · device-password-bind-pending
PROOF: L1 auth-screen vitest
```

## Symptom

User logs in with private key (Import Key / Advanced), then is required to enter a device password before the profile/shell unlocks.

## Evidence

- Returning-key path in `auth-screen.tsx`: after `unlockBoundProfileWithPrivateKeyHex`, if `restoreNativeVaultEncryptionSessionIfNeeded` / `ensureNativeSqliteOpenForWrites` fail → `setDevicePasswordBindPending(true)` + bind UI (Slice A).
- `AuthGateway.isShellReady = unlocked && !bindPending` blocks shell until password bind.
- Product rule from single-door design: never require key **and** password in the same unlock path.
- Maintainer direction (2026-11-07): private-key login must not require password again.

## Root cause

Slice A treated closed PDK after key unlock as a mandatory second door. That reintroduces the double door the single-door band forbade for one session.

## Non-causes

- Soft L3 / Tor
- Continuity restore
