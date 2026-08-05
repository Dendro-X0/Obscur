# Soft L3 re-proof — Blocked (unlock hang)

**Date (UTC):** 2026-08-04  
**Parent:** [core-relay-operational-status-2026-08.md](./core-relay-operational-status-2026-08.md)  
**Command:** `pnpm verify:s-pool-delivery-l3`

---

## Result

**Blocked** — harness hung on Tester1 unlock; no Soft L3 Pass/Fail JSON written for this run.

| Check | Status |
|-------|--------|
| Preflight | **ok** · static `:1430` · CDP `:9230` · lab relay `:7000` accepting TCP |
| `openPeer` route | Retargeted to `/network/profile?pubkey=` (aligned with invite mesh) |
| Full Soft L3 | **Hung** ≥7m at `unlock wait: no auth gate yet` with probe `identityStatus: locked` + `hasDevLab: false` |
| Product claim | **No** Soft L3 Pass · **no** delivery-fixed claim |

Prior invite mesh L3 (`INV-MESH-msebc0ca`) remains the last Pass for invite→mesh publish. Soft L3 dual-profile DM is still unproven this session.

---

## Policy

Per handoff: **do not** Soft L3 patch loop. Unlock/native-rehydrate divergence already investigated in [soft-l3-locked-shell-false-positive-investigation-2026-08.md](./soft-l3-locked-shell-false-positive-investigation-2026-08.md).

**Next options for maintainer:**

1. Manual Soft L3 row B (Tester1+Tester2 unlock by hand, then re-run automation), or  
2. Pivot to ops: dial-down public remotes for lab-only Soft L3 Row A honesty, or  
3. P14 soak / VPS relay assessment per CURRENT.md — not Soft L3 harness churn.
