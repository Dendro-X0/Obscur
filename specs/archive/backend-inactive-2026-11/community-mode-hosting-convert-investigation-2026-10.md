# Investigation — CU-UX-6 Mode & hosting convert (existing groups)

**Date (UTC):** 2026-10-21  
**Status:** Investigation complete — design next  
**Charter:** [community-dual-tier-ux-charter-2026-08.md](../../docs/program/community-dual-tier-ux-charter-2026-08.md)  
**Prior:** CU-UX-5 create-time relay freedom · CU-UX-4 steward roles L1  
**Not SF-B:** Corp directory / Spaces remains out of scope (roadmap SF-B).

---

## 1. Maintainer ask (paraphrase)

1. Edit **existing** groups: convert interest (T0 / `sovereign_room`) ↔ team/business (T1 / `managed_workspace`).
2. Team path should support **configurable roles** (stewards already exist; do not invent megagroup RBAC in this slice).
3. Admins may **toggle hosting infrastructure**: public Quiet · VPN / custom wss · private DC / operator — with honesty, not silent upgrade of guarantees.

---

## 2. Current state (evidence)

| Surface | Today |
|---------|--------|
| Create | T0/T1 chooser · host catalog · CU-UX-5 honesty on public Quiet for both tiers |
| Manage General | Name / about / avatar / access / bots — **does not edit** `communityMode`, `relayUrl`, or `hostingTier` |
| Manage save | `updateMetadata` **copies** existing `communityMode` + `hostingTier` from state (immutable in UI) |
| Stewards | CU-UX-4 promote/demote on **managed_workspace** only |
| Archive plan | Explicit **“Change mode”** flow called out as P2+ ([community-system-implementation-and-ui-plan](../../docs/archive/program/inactive-2026-06/community-system-implementation-and-ui-plan.md) §7) |

**Gap:** Mode and hosting are create-time only. Growing an interest group into a team (or downshifting) requires recreate or hand-edit storage.

---

## 3. Risks / constraints

| Risk | Mitigation in design |
|------|----------------------|
| Changing `relayUrl` orphans unread history on old host | Explicit confirm · keep prior URL in honesty copy · no silent multi-relay fanout claim |
| T0→T1 without coordination | Block unless coordination gate satisfied (same as create) |
| T1→T0 while claiming directory | Honesty ack that directory / steward tooling go read-only or inactive |
| “Multiple configurable roles” | **L1 roles = steward + member** (CU-UX-4). Custom role matrix / Spaces = later |
| Multi-member mode flip without consent | Steward/admin only; if room requires member vote for sensitive actions, mode+host changes use same proposal path when already required |
| Confusion with SF-B | Document: same community id, no Spaces/room switch |

---

## 4. Recommended slice id

**CU-UX-6** — Manage: Change mode + Change hosting (honesty-gated).

---

## 5. Proof layers (planned)

- **L1:** Policy unit tests for convert allow/deny · hosting tier remap · steward seed/clear rules  
- **L1 UI:** Manage panel shows controls · ack required · submit updates metadata fields  
- **L3 (optional later):** Dual-profile observe mode badge + steward UI after convert  

---

_Last updated: 2026-10-21_
