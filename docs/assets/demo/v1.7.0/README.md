# v1.7.0 — Phase 3 managed workspace relay gate

**Release line:** v1.7.0 (in development)  
**Tester:** _____________ **Date:** _____________  
**Build:** Desktop PWA or Tauri shell at `1.7.0`

**Related:** [v1.6.0 governance matrix](../v1.6.0/README.md) · [v1.5.8 U4 copy](../v1.5.8/README.md)

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

## Sign-off

| Block | Date | Notes |
|-------|------|-------|
| P3.1 relay gate | | |
