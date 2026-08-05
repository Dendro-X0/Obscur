# Investigation — Different private key in occupied profile window (warning gap)

**Status:** Investigation complete · 2026-07-30  
**Trigger:** P2 soak DemoUser gate + user: Import Key (Tester1) while window shows DemoUser → confusing Incorrect password / password-change fail  
**Related:** [r-account-p2-ui-soak-2026-07-30.md](../../docs/handoffs/r-account-p2-ui-soak-2026-07-30.md)

---

## Session gate

```text
NEXT ATOMIC STEP:     Maintainer: AUTH-KERN hydrate · or community · or hold (user now charters slot-conflict warn UX)
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · R-RELAY rewrite · Dev Lab
CANONICAL OWNER:      profile-slot-login-guard + ProfileSlotAccountConflictInline
PROOF BEFORE DONE:    L1 unit/contract · auth-screen behavior for different-key → conflict panel
OUT OF SCOPE:         AUTH-SESSION-1 silent unlock · community · claiming P2 hydrate fixed
```

User request aligns with P2 Fail root UX (DemoUser vs Tester1) — not a PAUSED band.

---

## Observed

| Path | Behavior today |
|------|----------------|
| Import Key → `runAuthKernelBoundProfileImport` | Calls `assertAccountUnlockAllowedAsync` → can throw `ProfileSlotAccountConflictError` → auth-screen shows `ProfileSlotAccountConflictInline` |
| Import Key guide (`needsDevicePasswordSetupGuide` + key ≠ stored) | **Short-circuits** to `auth.error.privateKeyMismatch` — **no** conflict panel / new-window / clear actions |
| Log In password on DemoUser with Tester1 password | `Incorrect password` — correct for DemoUser secret; does not explain “wrong account in this window” |
| Conflict panel copy | Hardcoded English; pubkey prefixes; actions exist (new window / clear / export) |

---

## Root gap (not missing owner)

Canonical owner already exists:

- `evaluateProfileSlotLoginAttempt` / `ProfileSlotAccountConflictError`
- `ProfileSlotAccountConflictInline` (open another window · clear · export+clear)

**Gap:** early Import Key validation treats “different key” as private-key mismatch instead of **slot occupancy conflict**, so users never see the recommended actions.

---

## Mental simulation

**Sender:** On Welcome Back **DemoUser**, opens Import Key, pastes Tester1 hex, continues.  
**Expect:** Clear warning — this window already holds DemoUser; open a new profile window or reset this window’s local data, then import.  
**Today:** “Private key does not match this profile” or Incorrect password on Log In — no recovery actions.

**Neighbor must not regress:** Same-key unlock/import · cross-profile lease (`AccountActiveInOtherProfileWindow`) · AUTH-SESSION-1 still cancelled.

---

## Next

Design: early surface conflict panel when decoded import key ≠ occupant; improve copy; L1 tests.
