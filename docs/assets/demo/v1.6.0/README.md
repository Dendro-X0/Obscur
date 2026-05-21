# v1.6.0 — Phase 2 governance projection

**Release line:** v1.6.0  
**Tester:** _____________ **Date:** _____________  
**Build:** Desktop PWA or Tauri shell at `1.6.0`

**Related:**
- **Phase 1 baseline:** [v1.5.7 manual matrix](../v1.5.7/README.md) (rename + expel)
- **v1.5.8 regressions:** [v1.5.8 README](../v1.5.8/README.md) (U4 publish copy)

---

## G2 — Governance projection (Phase 2)

| ID | Step | Expected | Pass |
|----|------|----------|------|
| G2-1 | Two devices in same community; Device A proposes rename (2+ active members) | Both see open proposal in Governance UI / banner | ☐ |
| G2-2 | Device B casts approving vote; quorum reached | Proposal moves to accepted; Device A applies descriptor (sealed `community.descriptor_updated`) | ☐ |
| G2-3 | After accept, reload both devices | Display name matches; ledger diagnostics show `governance_descriptor_accepted` (not plain `descriptor_updated`) on applying device | ☐ |
| G2-4 | Three-member community: propose expel of member C; approve on second device | C removed from active roster; applying device ledger shows `governance_member_expelled` | ☐ |
| G2-5 | Tie vote (equal approve/reject with even quorum) | Proposal closes **rejected**; descriptor unchanged | ☐ |

**Pass bar:** Governance read model survives tab reload (projection store + session cache); no duplicate descriptor apply toasts on replay.

---

## Sign-off

| Block | Date | Notes |
|-------|------|-------|
| G2 projection | | |
| G2 ledger tags | G2-3, G2-4 | |
