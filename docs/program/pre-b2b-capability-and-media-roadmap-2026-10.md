# Pre-B2B capability · ASE · realtime media — roadmap

**Status:** Active design shelf (2026-10-10)  
**Band:** Does **not** replace business **S2** or un-pause dialects  
**Parents:** [../business/ROADMAP.md](../business/ROADMAP.md) (locked) · [../business/PRODUCTIZATION.md](../business/PRODUCTIZATION.md) · [antisocial-engineering-contract.md](./antisocial-engineering-contract.md) · [CURRENT.md](../CURRENT.md)

**Design specs:**

- [pre-b2b-capability-design-2026-10.md](../../specs/backend/pre-b2b-capability-design-2026-10.md)
- [ase-post-v2-design-2026-10.md](../../specs/backend/ase-post-v2-design-2026-10.md)
- [realtime-media-post-v2-design-2026-10.md](../../specs/backend/realtime-media-post-v2-design-2026-10.md)
- [scale-flexible-group-architecture-design-2026-10.md](../../specs/backend/scale-flexible-group-architecture-design-2026-10.md) — niche wedge · corp/managed · large-discussion capacity (shelf; no impl while S2 open)

---

## 0. North star (routing)

```text
Commercial wall (unchanged): Your VPS · your keys · private group live.
Pre-B2B eng = make T1 demoable + hitchable on clearnet (Tor OFF).
Post-v2 eng = ASE depth + staged realtime media (video → conference).
```

| Rule | Meaning |
|------|---------|
| **R1** | No S3 without S2 — this roadmap does not invent a new XOR |
| **R2** | Dialects / new transport methods stay **PAUSED** |
| **R3** | ASE is **recipient-local defense**, not “anti-scam chat” GTM |
| **R4** | Conference video is a **product line**, not a pre-lead sprint |
| **R5** | One implementation band at a time; exit with **V** or **A** |

Inspiration (patterns only): [Flowsint](https://github.com/reconurge/flowsint) deploy/ethics/local-first · [public-apis](https://github.com/public-apis/public-apis) opt-in link reputation — not OSINT enrichers / Web3.

---

## 1. Phase board

| Phase | Name | When | Exit |
|-------|------|------|------|
| **PB0** | Specs (this shelf) | Now | Specs linked + CURRENT pointer |
| **PB1** | Pre-B2B polish | Parallel to S2; eng only if serves T1 wall | Proof pack path + SOP draft + voice honesty |
| **PB2** | Link-safety (opt-in) | After PB1 or with residual energy | Design implement + L1 + L3 consent honesty |
| **V2+** | ASE depth | After v2.0 gate / maintainer open | ASE-2 slices Verified or Accepted |
| **M1** | DM video (1:1) | Post-v2 | Audio path extended; demo honesty updated |
| **M2** | Small-group voice | After M1 | N≤4 on operator path |
| **M3** | Conference video | After M2 charter | Self-hostable SFU story + E2EE plan |

**Forbidden while S2 open:** M1–M3 implementation · ASE-2 as GTM spine · new dialects.

---

## 2. PB1 — Pre-B2B (ordered)

| ID | Work | Owner | Done when |
|----|------|-------|-----------|
| **PB1-A** | Self T1 proof pack (clearnet) | Operator / EG-LOG | Notes · limits · DM + small group live · Tor OFF |
| **PB1-B** | Deploy / standup SOP draft | [t1-private-trust-standup-sop-draft-2026-10.md](./t1-private-trust-standup-sop-draft-2026-10.md) + [self-hosted-relay notes](./self-hosted-relay-vps-operator-notes-2026-08.md) · linked from PRODUCTIZATION §4–§5 | **L1** path linked (2026-10-13); L3 dry-run when client usable |
| **PB1-C** | 1:1 voice reliability + failure honesty | messaging / WebRTC | **L1** invite/fail cards + connect-timeout honesty + **incoming ring timeout** (2026-10-13); L3 when shell usable |
| **PB1-D** | Gift / positioning honesty | website + V2 copy · [checklist](./pb1d-positioning-honesty-checklist-2026-10.md) | **L1** checklist green (2026-10-13); **A** presenter accept still operator |

Detail contracts: [pre-b2b-capability-design-2026-10.md](../../specs/backend/pre-b2b-capability-design-2026-10.md).

---

## 3. PB2 — Link safety (optional before leads)

| ID | Work | Done when |
|----|------|-----------|
| **PB2-A** | Opt-in URL reputation before open | **L1 Pass** (2026-10-13) · setting default-off · labeled consent · URLHaus URL-only · [design](../../specs/backend/pb2-link-safety-design-2026-10.md) |
| **PB2-B** | Wire into ASE L1–L2 only | Result dialog = L1 banner; local confirm remains L2; no body upload |

Pairs with ASE contract SE4. Not a Flowsint enricher suite.

---

## 4. Post-v2 — ASE depth

Keep ASE-1 floor (dm-kernel trust · attack-mode · shared-intel). ASE-2+ after v2:

| Slice | Focus |
|-------|--------|
| ASE-2a | Stronger locale packs + cold-contact bundles |
| ASE-2b | Step-up on export / nsec patterns (L3–L4) |
| ASE-2c | Optional link-safety default-on for “strict” attack profile |

Spec: [ase-post-v2-design-2026-10.md](../../specs/backend/ase-post-v2-design-2026-10.md).

---

## 5. Post-v2 — Realtime media (staged)

| Stage | Scope | Non-goals |
|-------|--------|-----------|
| **Today (shipped)** | Voice notes · **1:1 voice call** (DM Voice call path) | Video UI · multiparty rooms |
| **M1** | 1:1 **video** on existing invite/WebRTC path | SFU · groups |
| **M2** | Small-group **voice** (N≤4) | Large webinars |
| **M3** | **Conference video** + operator SFU option | Twilio-as-landlord · dark-web branding |

Spec: [realtime-media-post-v2-design-2026-10.md](../../specs/backend/realtime-media-post-v2-design-2026-10.md).  
Prior media constraints: [media-device-consent-design-2026-08.md](../../specs/backend/media-device-consent-design-2026-08.md) (camera ≠ conferencing until M1).

---

## 6. Implementation readiness

| Band | Ready to implement? | Gate |
|------|---------------------|------|
| PB0 | **Done** (docs) | — |
| PB1-A/B | Yes (ops/docs) | Does not require dialect un-pause |
| PB1-C | Yes (harden only) | No new call type |
| PB2 | **L1 Pass** (B/C wired) | L3 consent honesty when shell usable |
| ASE-2 / M1+ | **No** until post-v2 open | Explicit handoff atomic step |

**Next engineering atomic (when maintainer picks):** pre-B2B shelf L1 complete for PB1/PB2 — pick outside parked bands; not M1 / ASE-2.

---

## 7. Scale capacity (architecture shelf)

Niche GTM stays; capacity is dual-mode + future discussion band — see [scale-flexible-group-architecture-design-2026-10.md](../../specs/backend/scale-flexible-group-architecture-design-2026-10.md).

| Phase | When | Note |
|-------|------|------|
| **SF-A** | With PB1-A | Cell group live + managed create honesty — eng status [sf-a-managed-create-honesty-status-2026-10.md](./sf-a-managed-create-honesty-status-2026-10.md) |
| **SF-B** | After SF-A | Corp directory / Spaces — design before code |
| **SF-C** | After SF-B | Discussion profile — not a third create wizard yet |
| **SF-D** | Post-v2 M2→M3 | SFU / conference — media roadmap |

Does **not** authorize GTM “scale” language before V1 (STRATEGY) or M1–M3 while S2 open.

---

## 8. Kill / park

- Anti-scam “clean chat” as product mission  
- OSINT username/breach/wallet enrichers in-app  
- Conference video as launch / S2 blocker  
- Mass consumer video GTM vs Zoom/Meet  
- Sealed E2EE megagroup on Quiet relays as corp/forum story  

---

_Last updated: 2026-10-11_
