# Design — AUTH-KERN cold hydrate (consume native unlocked on process start)

**Status:** L3 Pass after device align · 2026-07-31  
**Evidence:** [cold L3](../../docs/handoffs/auth-kern-cold-hydrate-l3-2026-07-31.md) · [align](../../docs/handoffs/r-account-align-tester1-2026-07-31.md)  
**Feasibility:** [auth-kern-cold-hydrate-feasibility-2026-07.md](./auth-kern-cold-hydrate-feasibility-2026-07.md) — prior Fail×3 was pubkey mismatch

---

## Session gate

```text
HANDOFF ATOMIC STEP:  AUTH-KERN cold hydrate (from P2 Fail owner)
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNER:      auth-kernel-boot-owner + ensureInitialized cold await (keep-set only)
PROOF BEFORE DONE:    L1 kern-1..4 + new cold-hydrate contract · L3 cold relaunch release CDP
OUT OF SCOPE:         AUTH-SESSION-1 · community · slot DemoUser→Tester1 migration · F5 re-litigation unless regress
```

---

## Goal

On **cold process start**, when Rust `auth_boot_snapshot` reports `phase: unlocked` + `keychainPresent` for the window profile, JS identity must reach **unlocked shell** without device password — same product promise as F5 restore, via the **existing** boot owner (not a second path).

| May claim after L3 | |
|--------------------|--|
| AUTH-KERN cold hydrate fixed | Cold relaunch → shell; digest `auth.kernel_boot_restore_succeeded` (or equivalent unlocked apply) |
| P2 package verified | **Only** after re-running P2 matrix Pass (fixture-aligned) |
| AUTH-KERN-1 F5 | Remains Pass — must not regress |

---

## Mental simulation (pass)

1. Kill Obscur → launch release exe (cold).
2. Stored identity present; keychain present; native session active or force-restorable.
3. Boot owner runs; JS applies unlocked from native probe.
4. Main shell (Chats) — not Welcome Back.
5. Optional: password form unused.

**Fail closed:** `phase: mismatch` · manual lock · no keychain · true cross-window lease → stay Welcome Back with honest diagnostics (no silent unlock of foreign account).

---

## Changes (smallest keep-set)

### A. Cold await parity (`ensureInitialized`)

When `bootRestoreEnabled` and stored identity exists, **await** `waitForAuthKernelBootRestore` on cold as well as reload (same timeout), then:

- if unlocked → return;
- else existing locked/keychain/mismatch branches.

Do **not** invent a gateway-side restore loop.

### B. Settle flag init (`auth-kernel-boot-owner`)

Initialize `bootRestoreSettled` so **cold native** also starts unsettled until `runAuthKernelBootRestore` finishes (or policy disabled), matching F5. Prevents waiters treating cold as “already settled” before the first restore flight.

### C. Boot owner unlocked short-circuit (optional if A+B insufficient)

After successful `readBootSnapshot` with `phase === "unlocked"` and keychain + not manual lock: call `retryAuthKernelNativeSessionUnlock` once; if still locked, log `native_unlock_failed` with boot phase (already present). Prefer fixing unlock apply (lease) over duplicating `setIdentityState` in boot owner.

### D. Lease on cold (only if H5 confirmed in next L3)

If digest shows lease `"inactive"` while single window: treat **same-window / same-profile** active lease as non-blocking on cold restore (keep-set lease evaluator), **without** clearing multi-window protection. Spec amend + unit before behavior change.

### Forbidden

- AUTH-SESSION-1 / gateway passwordless invent
- Clearing all leases to “fix” unlock
- Claiming P2 from L1 alone
- Changing Welcome Back copy as the fix

---

## Proof plan

| Layer | Command / surface |
|-------|-------------------|
| L1 | `pnpm -C apps/pwa exec vitest run` auth-kernel-kern-1..4 + new cold-hydrate contract (mock: cold nav → wait restore → unlocked) |
| L2 | Existing auth-kernel authority parity if touched |
| L3 | Release exe + CDP `:9230` — kill process → relaunch → shell without password when native unlocked; digest + `get_session_status` / `auth_boot_snapshot` |
| P2 re-soak | After L3 Pass: [r-account-p2-ui-soak-design](./r-account-p2-ui-soak-design-2026-07.md) with fixture = occupant identity (or Tester1 rebound) |

**Claim language:** implemented (L1) ≠ verified ≠ fixed (L3 cold) ≠ P2 package verified.

---

## Implement order

1. L1 contract for cold await + settle init (red).
2. Apply A + B.
3. Re-run kern contracts green.
4. L3 cold soak evidence under `docs/handoffs/`.
5. If still Fail with lease `"inactive"` → D design amend + slice.
6. Checkpoint → P2 re-soak or hold.

---

## Next atomic step after this design

**L3 cold relaunch soak** (release exe + CDP) — then P2 re-soak if Pass. L1 A+B implemented.
