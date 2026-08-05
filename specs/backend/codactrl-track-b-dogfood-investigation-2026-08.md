# Investigation — CodaCtrl Track B dogfood (post R0–R4)

**Date (UTC):** 2026-08-02  
**Handoff:** Demo exit residual · CodaCtrl dogfood  
**Parent:** [production-truth-release-recovery-2026-08.md](../../docs/program/production-truth-release-recovery-2026-08.md)  
**Findings log:** [codactrl-improvement-findings-2026-07.md](../../docs/program/codactrl-improvement-findings-2026-07.md)

---

## Session header

```text
NEXT ATOMIC STEP:     CodaCtrl dogfood (maintainer chose)
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab as ship proof · AUTH-SESSION
CANONICAL OWNER:      user-codactrl-studio MCP · .codactrl/verify (tooling, not Obscur product)
PROOF BEFORE DONE:    Dogfood round matrix vs recovery § CodaCtrl coverage goals · append findings
OUT OF SCOPE:         Obscur product patches · O-2 repair · AUTH-SESSION · COM-RUN · v1.9.15 tag
```

---

## Pass contract (Track B soak)

Exercise recovery coverage goals against live prod-parity desktop + R0–R4 evidence. Record Works / Partial / Fail per primitive. **No Obscur product code** unless a finding is falsely attributed to Obscur.

| # | Goal | Probe |
|---|------|-------|
| 1 | No-CDP honesty / static `:1430` ready | `client_dev_environment_get` · `client_session_plan` · `client_stack_preflight` |
| 2 | Fail-class taxonomy | Soft L3 / R2 / R4 reports expose F-* · Studio labels if any |
| 3 | Hypothesis without session | `client_investigation_chain_append` without live session |
| 4 | Handoff-bound pathway | `studio_pathway` / salvage vs `current-session.md` |
| 5 | Soft L3 scenario pack | `sandbox_catalog_list` · `stress.obscur.soft_l3.public_dm@1` |
| 6 | Signal extract ACK gap | register / rollup for publish-ledger stamp residual |

**Claim:** Dogfood Pass = matrix completed + findings appended. ≠ Obscur R1 Soft L3 re-claim.
