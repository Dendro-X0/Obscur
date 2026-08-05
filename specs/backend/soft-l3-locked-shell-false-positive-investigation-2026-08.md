# Investigation — Soft L3 blocked on locked session / chrome false positive

**Date (UTC):** 2026-08-04  
**Evidence:** `test-results/s-pool-delivery-l3-2026-08-04.json` — `fatalError: Tester1 shell not unlocked on CDP after unlock attempt`  
**Probe:** `identityStatus: locked`, `unlockedPublicKeyHex: null`, `phase: auth_required`, `hasDevLab: false`, URL `/settings`

---

## Session header

```text
NEXT ATOMIC STEP:     Maintainer choose Soft L3 re-proof OR native invite smoke
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION · groups/**
CANONICAL OWNER:      Soft L3 harness (scripts/s-pool-delivery-l3-desktop.mjs + dev-lab-playwright-auth.mjs)
PROOF BEFORE DONE:    Soft L3 Pass with fAck — or Blocked with clear unlock diagnosis
OUT OF SCOPE:         W66 delete · product auth redesign · groups/**
```

---

## Findings

1. CDP probe (2026-08-04): URL `/settings`, session `locked`+null pubkey, **but** full Settings chrome (Relays/Identity/…) and **no** password field. Native rehydrate divergence — not LockedIdentityView.
2. `hasDevLab: false` — DevLab unlock unavailable.
3. Treating `identityStatus===locked` alone as lock surface caused Soft L3 to spin unlock forever / false-timeout while chrome was already usable.
4. True lock surface = LockedIdentityView copy + passphrase/`IdentityCard` password field.
5. Prior `submitAuthForm` assumed username+password; IdentityCard is passphrase-only (still needed when real lock UI appears).

---

## Fix (harness only)

1. `isLockedIdentitySurface` / Soft L3 `isShell`: require passphrase UI copy — not session status alone.
2. Passphrase-only unlock path when password field exists.
3. Evaluate timeouts so CDP hangs cannot stall Soft L3 unlock loops.
4. Re-run Soft L3.

---

## Status

**Harness corrected for rehydrate divergence** → Soft L3 retry
