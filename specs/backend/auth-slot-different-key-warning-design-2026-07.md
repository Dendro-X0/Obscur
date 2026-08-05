# Design — Different-key occupied-window warning

**Status:** Implemented · L1 Pass · 2026-07-30  
**Investigation:** [auth-slot-different-key-warning-investigation-2026-07.md](./auth-slot-different-key-warning-investigation-2026-07.md)

---

## Session gate

```text
NEXT ATOMIC STEP:     Slot-conflict early warn (user-chartered) — reuse ProfileSlotAccountConflictInline
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNER:      profile-slot-login-guard + auth-screen + ProfileSlotAccountConflictInline
PROOF BEFORE DONE:    L1: login-guard + auth-screen test for different-key → conflict region
OUT OF SCOPE:         New unlock stack · AUTH-KERN hydrate repair · community
```

---

## Target (subtract, don’t invent)

1. When Import Key material decodes to pubkey **≠** slot occupant → set `accountConflict` + `pendingAuthAction` via `evaluateProfileSlotLoginAttempt` (same shape as thrown conflict).
2. Do **not** only set `privateKeyMismatch` for that case.
3. Show existing `ProfileSlotAccountConflictInline` with clearer i18n:
   - Title: account already in this window/device
   - Body: name occupant label when known; suggest **new profile window** (recommended) or **reset this window’s local data** (clear / export+clear)
4. Optional proactive: when `importCandidatePublicKeyHex` becomes a different account, surface conflict before submit (same helper).

---

## Forbidden

- Parallel “warning dialog” owner beside `ProfileSlotAccountConflictInline`
- Silent wipe / AUTH-SESSION-1
- Changing `evaluateProfileSlotLoginAttempt` allow rules

---

## Proof

| Layer | Command |
|-------|---------|
| L1 | `pnpm -C apps/pwa exec vitest run app/features/profiles/services/profile-slot-login-guard.test.ts app/features/auth/components/auth-screen.test.tsx` (targeted cases) |
| L3 | Manual optional: DemoUser gate → paste Tester1 key → see conflict panel |

---

## Claim

| May say | When |
|---------|------|
| Implemented | Diff matches this design |
| Verified | L1 Pass |
| Fixed (P2 hydrate) | **No** — separate AUTH-KERN band |
