# Investigation — Profile-slot conflict vs “forgot DemoUser” unlock

**Date:** 2026-11-01  
**Trigger:** Lock-screen Advanced unlock showed slot-conflict UI while hero still named DemoUser; maintainer was not trying to switch accounts.  
**Status:** Investigation only — no code this pass.  
**Correction 2026-11-01 (maintainer runtime proof):** This window belongs to **Tester1**, not DemoUser. Prior “Auth hero is authoritative” claim is **wrong**.

## Observed (screenshot / runtime)

| Signal | Value |
|--------|--------|
| Bound pubkey (hero fragment + unlocked chrome) | `e07f67dc…c191ea56` |
| Unlocked chrome / truth | **Tester1** + same pubkey |
| Auth hero / Identity Locked chip | **DemoUser** (wrong label on same pubkey) |
| DemoUser passphrase | fails |
| DemoUser private key | derives `860b15c3…` → slot conflict (correct: not the occupant) |
| Tester1 private key | unlocks (matches `e07f67dc…`) |

Isolation on **pubkey** is correct. The bug is a **stale `IdentityRecord.username`** (`DemoUser`) glued onto Tester1’s pubkey/crypto material.

## Dual label — corrected ownership

| Layer | What it shows | Truth? |
|-------|----------------|--------|
| Crypto / slot occupant pubkey | `e07f67dc…` | Yes — unlocks with Tester1 key |
| Profile store / title-bar preview | Tester1 | Yes — matches unlock |
| `IdentityRecord.username` → Auth hero / conflict copy / Identity Locked chip | DemoUser | **No** — cosmetic poison |

AuthScreen path (`storedUsernameHint`):

```text
readIdentityRecordFromLocalStorage(profileId)?.username
  || identity.state.stored?.username
```

It never cross-checks profile-store username or validates the name against the pubkey. Conflict UI then says “local data for DemoUser” while the key that belongs here is Tester1’s.

## Why the three unlock attempts behave that way

1. **DemoUser password** — decrypts against wrapper for `e07f67dc` (Tester1 material) → fail.  
2. **DemoUser private key** → `860b15c3…` ≠ occupant → `blocked_different_account` (isolation OK; copy lies by naming DemoUser as occupant).  
3. **Tester1 private key** → matches occupant → unlock.

So “forgot DemoUser” was never the case: DemoUser was a **mispainted name** on Tester1’s slot. Intent-classification (wrong-key vs switch) remains a follow-on UX issue once naming is fixed.

## Design implication (later design spec — not approved impl)

1. **Single locked identity signal:** prefer profile-store / preview username for the bound pubkey; if `IdentityRecord.username` disagrees, treat identity username as stale (repair on unlock or hide until reconciled).  
2. Conflict / Auth hero must name the **pubkey occupant**, never a conflicting identity username.  
3. On successful Tester1 unlock, rewrite `IdentityRecord.username` to match profile username when they diverge (subtraction of poison).  
4. Keep slot isolation on pubkey; add `wrong_key_for_occupant` soft path once names are honest.

## Root split (three different problems in one dialog)

1. **Wrong-key while unlocking occupant** — user still wants DemoUser; Advanced key ≠ occupant pubkey.  
   Desired: soft error (“That key isn’t DemoUser”) + stay on passphrase / retry key; **no** Clear/Export primary actions.
2. **Intentional account switch in this window** — rare; keep Clear / Export+clear after explicit “I want a different account here.”
3. **Second account alongside** — recommended path already exists: open another profile window (Chrome-profile model).

Today `evaluateProfileSlotLoginAttempt` only returns `allowed | blocked_different_account`. Auth treats every Advanced mismatch as (2)/(3).

## Why it feels like Obscur “forgot” DemoUser

Likely stack (not mutually exclusive):

| Layer | Failure mode | User experience |
|-------|----------------|-----------------|
| Unlock material | Passphrase row missing / wrong / harvest miss → Advanced becomes the escape hatch | “I have to use a key” |
| Advanced UX | Key field not bound to occupant expectation until after submit | Easy to paste another account’s nsec |
| Conflict copy | Frames mismatch as switch | Feels like DemoUser was discarded |
| Sync / durability | Identity *name* + binding survive; passphrase wrapper or session may not | “Account remembered, unlock forgotten” |

Binding evidence still present (`getLastBoundAccountPublicKeyHex` / identity record) — DemoUser was **not** wiped. Unlock path and copy lied about intent.

## Sync / continuity (separate but related)

“Data synchronization” here is mostly **same-device continuity**, not multi-device cloud sync:

- Passphrase-wrapped key must stay recoverable for the bound pubkey after restart / data-root moves (existing harvest + repair paths in `identity-passphrase-unlock.ts` / `data-root-identity-repair.ts`).
- When continuity fails, surface **“Unlock DemoUser” recovery**, not account-switch machinery.
- Cross-device restore remains unified backup / recovery file (wallet-unlock band) — do not conflate with profile-slot wipe.

## Design direction (for later design spec — not approved impl)

1. **Classify Advanced unlock on occupied slot**  
   - Incoming pubkey === occupant → unlock.  
   - Incoming ≠ occupant → `wrong_key_for_occupant` (default) with Cancel / retry; optional collapse “Use a different account…” → existing switch actions.
2. **Keep Advanced demoted** when passphrase row exists; if Advanced opens, show expected account fragment in the key form (“Must unlock DemoUser”).
3. **Intentional switch** entry from Profiles / settings, not from failed unlock.
4. **Sync soak (L3):** lock → restart → passphrase unlock DemoUser without touching Advanced; if passphrase probe false, diagnose repair before offering key.

## Non-goals this band

- Soften isolation (never allow silent mix of two accounts in one window).
- OAuth / server “forgot password.”
- Full multi-device sync product.

## Proof when implemented

- **L1:** unit — wrong key on occupied slot → soft error; no clear/wipe paths in default branch.  
- **L2:** auth-screen vitest — DemoUser hero + wrong nsec → no “Clear this window” until explicit switch.  
- **L3:** desktop soak — DemoUser lock/unlock passphrase; Advanced wrong key recoverable without wipe.
