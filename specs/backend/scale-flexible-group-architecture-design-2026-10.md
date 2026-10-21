# Design — Scale-flexible group architecture

**Date (UTC):** 2026-10-11  
**Status:** Design accepted for sequencing · **no implementation while S2 / PB1-A open**  
**Canvas:** Cursor canvas `scale-flexible-group-architecture`  
**Parents:** [community-dual-tier-ux-design-2026-08.md](./community-dual-tier-ux-design-2026-08.md) · [pre-b2b-capability-design-2026-10.md](./pre-b2b-capability-design-2026-10.md) · [pre-b2b-capability-and-media-roadmap-2026-10.md](../../docs/program/pre-b2b-capability-and-media-roadmap-2026-10.md)  
**Business lock:** [ROADMAP.md](../../docs/business/ROADMAP.md) S2 · [STRATEGY.md](../../docs/business/STRATEGY.md) (no GTM “scale” language before V1)

---

```text
HANDOFF ATOMIC STEP:  Operator unlock Tester1 → P5 group live (PB1-A) — this design is parallel shelf
PAUSED / CANCELLED:   Dialects · M1–M3 impl · ASE-2 as GTM · discussion_workspace create UI
CANONICAL OWNER:      groups (communityMode / relay gates) · coordination · docs/program
PROOF BEFORE DONE:    Spec only this pass — L1 when a named slice is opened
SURFACE:              Architecture + honesty contracts; not homepage GTM
```

---

## 1. Goal

Keep GTM on the **niche private-trust cell**, while the **same client + mode system** can later host:

1. A **corporation / department workspace** (operator relay + coordination), and  
2. A **large operator-hosted discussion community** (partitioned rooms, moderation),  

…without claiming sealed E2EE megagroups on Quiet public relays, and without Discord/Telegram town-square positioning.

**Wedge ≠ ceiling.** Niche is who we sell to first; capacity is how modes and primitives compose.

---

## 2. Problem split (three bands)

| Band | Audience | Trust model | Obscur surface today | Target N (design) |
|------|----------|-------------|----------------------|-------------------|
| **Cell / niche** | Friends · ops cell | Sealed room · invite graph · scoped publish | `sovereign_room` (create default) | **2–20** members; UI excellence at **N≤12** |
| **Corporation / team** | Dept · company | Private/intranet relay + coordination directory + roles | `managed_workspace` (gated) | **20–2k seats** across rooms/spaces — not one flat roster |
| **Large discussion** | Forum · online community | Moderation · topics/channels · weaker full-room E2EE claims | **Design band only** (`discussion_workspace` *name reserved*) | **≫100 active writers**; search-first roster |

Do **not** ship a third create-wizard mode until cell + managed paths are boring. Large discussion reuses managed infra with partition + mod plane.

---

## 3. Invariants

| ID | Invariant |
|----|-----------|
| **SF1** | Mode badge always honest: sealed cell vs managed workspace vs (later) discussion — different promises |
| **SF2** | `public_default` Quiet relays never unlock managed/large claims (`resolveManagedWorkspaceRelayGate` / `assessRelayCapability` stay hard) |
| **SF3** | Large scale adds partition + moderation + SFU; it does **not** delete or weaken the sealed small-group path |
| **SF4** | GTM stays niche until cell loop is boring; capacity lives in architecture/roadmap — not Gift homepage fantasy |
| **SF5** | STRATEGY: do not use commercial “scale” language before V1 EG; this spec is eng capacity, not S3 pitch |
| **SF6** | ACC-02 roster display remains Accepted until a named corp-hardening slice; do not paper over with fake completeness |

---

## 4. Code anchors (already shipped)

| Concern | Owner |
|---------|--------|
| Mode type | `CommunityMode = "sovereign_room" \| "managed_workspace"` — `apps/pwa/app/features/groups/types/community-mode.ts` |
| Guarantees + caution | `COMMUNITY_MODE_DEFINITIONS` — `community-mode-contract.ts` |
| Relay tier → recommended mode | `assessRelayCapability` · tiers `unconfigured` → `public_default` → `trusted_private` → `managed_intranet` |
| Managed create gate | `resolveManagedWorkspaceRelayGate` · create dialog dual tier UI |
| Dual-tier UX contract | [community-dual-tier-ux-design-2026-08.md](./community-dual-tier-ux-design-2026-08.md) |

**Subtraction rule:** do not invent a parallel create engine or a third `CommunityMode` enum value until SF-D (discussion profile) is explicitly opened.

---

## 5. Capability matrix (honest ceilings)

| Capability | Cell (`sovereign_room`) | Corp (`managed_workspace`) | Large discussion (future) |
|------------|-------------------------|----------------------------|---------------------------|
| E2EE default | Sealed room key — strong | Sealed where possible; operator recovery/backup story explicit | TLS + optional sealed subgroups; **no** “full-room E2EE at 10k” claim |
| Membership | Invite graph | Coordination directory + roles | Directory + applications + mods |
| Roster UI | Full list OK at N≤20 | Paginated / search | Search-first; never render 10k avatars |
| Message sync | CM scoped store ≠ DM Quiet | Same + operator hide / broadcast backups when relay supports | Partition by channel/topic; catch-up indexes |
| Realtime media | Voice notes · 1:1; M2 N≤4 later | Scheduled huddles; SFU per site | Webinar/SFU product line (M3+) |
| Relay posture | Cell VPS / localhost / Quiet with honesty ack | Intranet / trusted private only | Operator cluster; Quiet pool ≠ this band |

---

## 6. Scale-invariant vs scale-variant

### Invariant primitives (keep strengthening)

1. Scoped publish (community store ≠ DM Quiet pool)  
2. Membership ledger + directory evidence (widen-only roster session)  
3. Relay capability tiers + managed gate  
4. Role / invite / leave as signed control events  
5. Client list virtualization + search (UI scale)

### Variant modules (plug later — do not stub now)

| Module | Band | Pattern (inspiration only) |
|--------|------|----------------------------|
| Spaces / teams grouping | Corp | Element Spaces |
| Topic / stream partition | Discussion | Zulip streams |
| Moderation queue + rate limits | Discussion | Discourse / Matrix mod |
| SFU conference | Corp + Discussion | LiveKit / MatrixRTC — after M2 |
| Presence / read-receipt budgets | Corp | Slack presence — budgeted |

---

## 7. Phased work (post–PB1-A)

| Phase ID | Work | Unlocks | Gate |
|----------|------|---------|------|
| **SF-0** | This design + canvas | Shared vocabulary | Done this pass |
| **SF-A** | PB1-A cell group live (P5) · managed create on private relay · ACC-02 honesty | Niche + first team demos | S2 / Track L |
| **SF-B** | Corp hardening: directory-backed roster · roles · paginated members · Spaces-like grouping | Dept / company workspace | After SF-A; named design before code |
| **SF-C** | Discussion profile: topics/channels · mute/follow · mod tools · virtualized history | Large operator-hosted communities | After SF-B; new mode or workspace profile — design first |
| **SF-D** | Media scale: M2 N≤4 → M3 SFU | All-hands shaped calls | Post-v2 media roadmap; not while S2 open |

---

## 8. Product copy (say / don’t say)

### Say (capacity, not town-square GTM)

- Stand up a private-trust cell on your relay.  
- Small sealed groups that actually deliver.  
- Same stack grows into your team workspace when you run the infra.

### Do not say (yet)

- Replace Discord for public communities.  
- Unlimited E2EE megagroups on Quiet relays.  
- Enterprise Zoom + Slack day one.

---

## 9. Non-goals (this shelf)

- Implementing `discussion_workspace` enum / create UI  
- Softening managed gates to make public Quiet look “enterprise”  
- Stretching one sealed megagroup to “corp + Reddit”  
- Opening M1–M3 or dialects under this design’s cover  
- Homepage “scale to Fortune 500” messaging before V1 EG  

---

## 10. Next design slices (when opened)

Open **one** investigation/design before any SF-B code:

| Slice | Spec name (suggested) | Question |
|-------|----------------------|----------|
| **SF-B1** | `corp-directory-roster-design` | How does coordination membership evidence drive paginated UI without lying on ACC-02? |
| **SF-B2** | `workspace-spaces-grouping-design` | Org → space → room hierarchy; storage shape; no second create engine |
| **SF-C1** | `discussion-workspace-profile-design` | Mode vs profile flag; guarantee text; mod plane ownership |

---

## 11. Proof (when a slice is implemented)

| Layer | Expectation |
|-------|-------------|
| **L1** | Mode/gate unit tests; no public-default managed create without honesty path |
| **L2** | Typecheck / package tests for groups + coordination |
| **L3** | Dual-profile: cell create/invite/send; managed path on private relay only |
| **L4** | Optional: N≈50 synthetic members — paginated roster, no UI freeze |

Claim language: design accepted ≠ implemented ≠ verified.

---

## 12. Stop condition (this pass)

- Spec committed under `specs/backend/`  
- Linked from pre-B2B roadmap  
- Canvas updated with SF-B/C next pointers  
- **No** product code; handoff atomic step remains P5 unlock  

---

_Last updated: 2026-10-11_
