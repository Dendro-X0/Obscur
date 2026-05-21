# v1.7.x — Phase 3 managed workspace relay gate

**Release band:** **v1.7.x** (patch tags e.g. `v1.7.1` after matrix Pass)  
**Environment:** [verification-environment.md](../verification-environment.md) — **Tester 1 (A, dark)** + **Tester 2 (B, light)**, desktop, two profile windows  
**Date:** _____________ **Build:** Desktop Tauri at current `main` / tag  

**Related:** [v1.6.0 governance matrix](../v1.6.0/README.md) · [2.0 milestone roadmap](../../../program/obscur-2.0-milestone-roadmap.md)

---

## P3.1 — Relay gate (Managed Workspace)

Prerequisite: a community created or marked **Managed Workspace** on a private/trusted relay, then test with **only public default relays** enabled in Settings → Relays (`nos.lol`, `relay.damus.io`, etc.).

| ID | Step | Expected | Pass |
|----|------|----------|------|
| P3-1 | Open Management on a Managed Workspace community | Rose banner on every tab: relay tier insufficient; copy mentions Settings → Relays | ☐ |
| P3-2 | **General** tab | Name/about/access/avatar save disabled; Save / Propose disabled | ☐ |
| P3-3 | **Members** tab | Invite disabled; Vote to remove disabled | ☐ |
| P3-4 | **Settings** tab | Rotate room key + Share invite disabled; Leave / Export still available | ☐ |
| P3-5 | **Governance** tab | Can still vote on **existing** open proposals; empty state notes new proposals need trusted relays | ☐ |
| P3-6 | Re-enable a private/custom relay; reload management | Banner gone; General save works again | ☐ |
| P3-7 | **Sovereign Room** on public relays | No gate banner; settings behave as before | ☐ |

**Pass bar:** No managed-workspace coordination action succeeds without trusted/private relay baseline; sovereign mode unchanged.

---

## P3.2 — Steward model

| ID | Step | Expected | Pass |
|----|------|----------|------|
| P3-8 | Create **Managed Workspace** on private relay | Creator is initial steward; metadata includes `stewardPubkeys` |
| P3-9 | As steward with 3+ members: rename in General | Saves **without** governance proposal (direct descriptor) |
| P3-10 | As steward: remove another member | Applies **without** governance proposal |
| P3-11 | As non-steward member in same community | Save creates governance proposal; removal uses vote/expel proposal |

---

## P3.3 — Directory honesty (group home)

| ID | Step | Expected | Pass |
|----|------|----------|------|
| P3-12 | Open group home on public relays | Sky honesty banner under title; Participants bento uses “best-effort” copy |
| P3-13 | Open Participants modal | Subtitle reflects non-authoritative directory when applicable |

---

## Sign-off

| Block | Date | Notes |
|-------|------|-------|
| P3.1 relay gate | | |
| P3.2 stewards | | |
