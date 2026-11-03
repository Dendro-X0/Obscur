# Design — Unlock display sync + wrong-key UX

**Date:** 2026-11-01  
**Investigation:** `specs/backend/profile-slot-unlock-intent-investigation-2026-11.md`  
**Owner:** AuthScreen display + `evaluateProfileSlotLoginAttempt` surfacing

## Problem

1. `IdentityRecord.username` can say DemoUser while bound pubkey + profile store are Tester1 → Auth / conflict / Identity Locked lie.  
2. Pasting another account’s key on an occupied unlock screen opens a narrow, wipe-forward conflict stack (wrong intent).

## Contracts

### C1 — Unlock display name

Resolve once for Auth hero, conflict occupant label, LockScreen chip:

```text
profileStore.username (scoped)
  ?? identityRecord.username
  ?? keyFragment(pubkey)
  ?? profileLabel
```

Pubkey remains the isolation key. Username is display-only and must not invent a different account.

On successful unlock, if `identity.username` ≠ profile-store username (case-insensitive trim), rewrite identity username to profile-store value (poison repair).

### C2 — Wrong key while unlocking occupant

When slot has an occupant pubkey and Advanced key derives a **different** pubkey:

- Default: soft error (`auth.login.wrongKeyForOccupant`) — no Clear / Export / Open window primary.  
- Optional: “Use a different account in this window…” expands existing switch actions.

Do **not** auto-open full switch UI from the live keystroke effect.

### C3 — Intentional switch UI

When user expands switch: conflict card is full-width of the auth card, short copy, primary = open another window; destructive actions demoted. Not a second nested skinny column.

## Proof

- **L1:** `resolveUnlockAccountDisplayName` unit — profile wins over stale identity username.  
- **L2:** auth-screen — hero shows Tester1 when profile store says Tester1; wrong key → soft error, no Clear button until expand.  
- **L3:** optional desktop soak (not this slice).

## Non-goals

Soften pubkey isolation · OAuth · multi-device sync product.
