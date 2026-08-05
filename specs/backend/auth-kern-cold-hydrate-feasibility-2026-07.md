# Feasibility — AUTH-KERN cold hydrate (3× L3 Fail)

**Status:** Closed · device align + L3 Pass · 2026-07-31  
**Evidence:** [align](../../docs/handoffs/r-account-align-tester1-2026-07-31.md) · [cold L3 Pass](../../docs/handoffs/auth-kern-cold-hydrate-l3-2026-07-31.md) · [P2 Pass](../../docs/handoffs/r-account-p2-ui-soak-2026-07-31.md)  
**Design:** [auth-kern-cold-hydrate-design-2026-07.md](./auth-kern-cold-hydrate-design-2026-07.md)

---

## Session gate

```text
HANDOFF ATOMIC STEP:  AUTH-KERN cold hydrate (P2 Fail owner)
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab
RULE:                 rules/11 — ≥3 substantial iterations without progress → stop patches
```

---

## Iterations (code + L3)

| # | Change | L3 cold |
|---|--------|---------|
| 1 | A+B settle unsettled + cold await | **Fail** — gate · native unlocked |
| 2 | C wait always drives restore + seed before wait | **Fail** — same |
| 3 | D clear localStorage leases on cold | **Fail** — same |

Invariant every Fail: UI Welcome Back DemoUser · `get_session_status.is_active` · `auth_boot_snapshot.phase=unlocked` · `keychainPresent` · no `kernel_boot_restore_succeeded` in CDP digest sample.

---

## Constraint analysis

| Layer | Finding |
|-------|---------|
| Rust | Session active for pubkey `e07f67…ea56` |
| Local identity | DemoUser stored pubkey `6ca65b…bde8` (**different**) |
| Leases | Empty on Fail probe — **not** H5 |
| Boot owner | With `expectedPublicKeyHex` = stored → **`phase: mismatch`** → restore returns false (correct) |
| CDP soak boot | Called without expected pubkey → reports `unlocked` (misleading) |

**Invariant reclassified:** Welcome Back + native active is **slot/keychain mismatch**, not “JS forgot to consume unlocked.” A+B+C+D targeted the wrong owner.

---

## Outcome: stop hydrate patches · fixture / mismatch band

| Decision | |
|----------|--|
| Cold-hydrate wait/settle/lease patches | **Stop** — no further A–D iterations |
| Goal “consume matching native unlocked on cold” | Still valid **when pubkeys match**; not proven broken by this Fail |
| This Fail | Fix **device alignment** (clear wrong keychain/session or rebind identity) · optional mismatch UX · then re-soak |

**P2 next:** Align `default` stored identity with OS keychain/session (or clear both and unlock DemoUser/Tester1 cleanly), then re-run cold L3 + P2 matrix.

**Stop condition:** Do not claim cold hydrate fixed from this band. Do not patch boot owner for mismatch-as-hydrate.
