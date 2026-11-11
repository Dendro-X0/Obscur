# Charter — Platform feasibility exploration & documentation standards (2026-11-08)

```text
HANDOFF ATOMIC STEP: PLATFORM FEASIBILITY EXPLORATION — docs only (no Soft L3 / contact Pass chase)
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity · packaged Pass ·
  Soft L3 contact rows Pass · UI migrate-as-salvage · “multi-protocol done”
CANONICAL OWNER: this charter · docs/exploration/feasibility/ · platform-rewrite-band-charter
PROOF BEFORE DONE: Feasibility dossier set + GO / NO-GO / NARROW decision recorded in handoff
```

## Why this exists

The Soft L3 contact loop showed a hard limit: **relationship CRM on Nostr message history is not a product foundation**. Continuing patches wastes time. Completing the **initial design concept** requires a **feasible** plan first:

> One Obscur account plane (auth · profiles · database) with **switchable carriers** for data transmission (Nostr, Matrix, private custom relays/servers, later Tor/P2P) — “many apps / protocols through one account,” not “Nostr is the app.”

**Aggregator law (maintainer, 2026-11-09):** Nostr and every other protocol are **adaptation layers**, not hard-coded kernel logic. The product is an **aggregator**: users manage account and data through a **single profile**, and switch / configure transmission protocols like multiple apps under that profile. Detail: `docs/exploration/feasibility/00-aggregator-adaptation-law.md`.

Parents (binding direction, not a claim of done):

- `specs/backend/platform-rewrite-band-charter-2026-11.md`
- `specs/backend/obscur-platform-service-vision-2026-10.md`
- `docs/exploration/00-methodology-and-synthesis-plan.md` (as-built code shelf — complementary)

## Non-goals during exploration

- No Soft L3 demote / Requests Pass soaks as the session goal
- No UI “migration” of current Nostr-shaped screens as proof of platform
- No implementation / mega-refactor / greenfield app until **GO** on a cut design
- No marketing claims (Tor Verified, multi-protocol shipping, unbreachable)

## Documentation standards (binding for this band)

Every exploration note under `docs/exploration/feasibility/` MUST use:

| Section | Required content |
|---------|------------------|
| **1. Scope** | What technology / library / protocol; in / out of scope |
| **2. Basics** | Plain-language model (what it is / is not) — for a non-expert maintainer |
| **3. Capabilities map** | What it can own vs cannot own for Obscur’s goal |
| **4. Fit to planes** | Auth · Profile · Storage · Relationship · Message · Transport |
| **5. Libraries / stacks** | Candidate libs (language, license, maturity, desktop/mobile fit) |
| **6. Feasibility verdict** | `fit` · `fit-with-adapter` · `lab-only` · `reject-for-core` + one-paragraph why |
| **7. Risks / traps** | Especially: confusing transport history with relationship state |
| **8. Open questions** | What must be answered before a rewrite cut |
| **9. References** | Specs, RFCs, official docs, in-repo evidence paths |

**Claim language:** “explored” ≠ “adopted” ≠ “implemented” ≠ “Pass.”

**One topic per note.** Do not mix Tor + Matrix + Nostr into one undifferentiated essay.

**English only.** Prefer short tables over narrative.

## Target architecture (feasibility question, not as-built)

```text
┌──────────────────────────────────────────────────────────┐
│  Shell (product apps / UI)                               │
├──────────────┬───────────────┬───────────────────────────┤
│ Auth (universal door) │ Profiles (hard isolation) │ DB/storage │
├───────────────────────┴───────────────────────────┴──────┤
│ Relationship graph (FIRST-CLASS — not inferred from DM)  │
├──────────────────────────────────────────────────────────┤
│ Carrier ports (send / list / sync hints / transport prefs)│
├──────────┬──────────┬──────────────┬─────────────────────┤
│ Nostr    │ Matrix   │ Private      │ Tor / P2P           │
│ adapter  │ adapter  │ relay/server │ (optional underlay) │
└──────────┴──────────┴──────────────┴─────────────────────┘
```

**Feasibility hinge:** Can relationship + auth + profile + DB stay carrier-agnostic while carriers remain replaceable? If no → NARROW or NO-GO.

## Exploration queue (ordered)

| ID | Topic | Deliverable path |
|----|--------|------------------|
| F0 | This charter + standards + index | this doc · `docs/exploration/feasibility/README.md` |
| F1 | **Relationship authority** (what must not live on relays) | `feasibility/01-relationship-authority.md` |
| F2 | **Nostr** basics + limits as a carrier | `feasibility/02-nostr-carrier.md` |
| F3 | **Matrix** basics + Olm/Megolm honesty | `feasibility/03-matrix-carrier.md` |
| F4 | **Private custom relays / DC servers** | `feasibility/04-private-relay-server.md` |
| F5 | **E2EE** models (what Obscur must own vs reuse) | `feasibility/05-e2ee-models.md` |
| F6 | **Tor** as underlay (not product identity) | `feasibility/06-tor-underlay.md` |
| F7 | **Decentralization** spectrum (sovereign vs federated vs P2P) | `feasibility/07-decentralization-spectrum.md` |
| F8 | **Universal auth · profile · DB** candidates | `feasibility/08-universal-auth-profile-db.md` |
| F-stack | **Ideal stack thought experiment** (Rust kernel · TS UI · modular crates · SQLite · no bridge tax) | `feasibility/09-ideal-stack-thought-experiment.md` |
| F-sources | **External sources** (E2EE · Nostr crypto · MLS/Signal/Matrix/SimpleX) — bibliography for F2/F3/F5 | `feasibility/10-external-e2ee-protocol-sources.md` |
| F-PSE | **Performance · security · encryption standards** (tiers T0–T4 · invariants · anti-bridge-tax) | `feasibility/11-performance-security-encryption-standards.md` |
| F-hub | **Hub workspace** (one profile/DB · encrypted vault · sandbox · linked-identity protocol apps) | `feasibility/12-hub-workspace-vault-adapters.md` |
| F-alt | **Architecture alternatives** (critique of peer-app hub · staged workspace + private-trust primary) | `feasibility/13-architecture-alternatives-hub-critique.md` |
| F-auth-profile | **Auth & Profile improvements** (as-built critique · P0–P3 cuts · hub vocabulary) | `feasibility/14-auth-profile-improvement-exploration.md` |
| F-auth-schemes | **Auth schemes beyond raw keypairs** (password-wrap · passkeys · OPAQUE · threshold · reject IdP root) | `feasibility/15-auth-schemes-beyond-raw-keypairs.md` |
| F-auth-schemes-solution | **Auth face solution record** (direction — not impl) | `feasibility/15b-auth-schemes-solution-record.md` |
| F-rel-discover | **Relationship discovery & sync** (no central CRM · invite/intent model · reject Nostr contacts) | `feasibility/16-relationship-discovery-decentralized-sync.md` |
| F-discover-methods | **Discovery methods catalog** (as-built + community/interest candidates) | `feasibility/17-discovery-methods-catalog.md` |
| F-groups | **Community / group systems** (public·private · pinned protocol · trusted DC/VPS) | `feasibility/18-community-group-systems.md` |
| F-netconfig | **Network / protocol configuration UX** (profiles · protocol apps · named homes · underlay) | `feasibility/19-network-protocol-configuration-ux.md` |
| F-sync | **Cross-device profile sync** (sealed backup · own DC · device pair · reject custodial/lookback) | `feasibility/20-cross-device-profile-sync-e2ee.md` |
| F-gaps | **Design coverage gap inventory** (explored vs owed vs unexplored modules) | `feasibility/21-design-coverage-gap-inventory.md` |
| F9 | **Synthesis** — GO / NARROW / NO-GO + first rewrite cut | `feasibility/99-synthesis-decision.md` |

Do **F1 before F2–F7** so carrier notes answer the relationship question instead of re-deriving “contacts from DMs.”  
**F-stack** may run in parallel with carrier notes; it does **not** authorize coding.

## Decision gate (after F9)

| Decision | Meaning |
|----------|---------|
| **GO** | Feasible under rewrite-band cuts; first cut named; Soft L3 contact Pass stays paused |
| **NARROW** | Platform goal kept but carriers / features cut (e.g. private mesh first, Nostr secondary) |
| **NO-GO** | Initial concept not feasible as stated; archive or redefine product |

No coding of platform rewrite until F9 records one of the three.

## Agent rules

1. Exploration sessions: **docs only** unless maintainer explicitly opens a cut design + impl.
2. Refuse Soft L3 Fixed / contact Pass claims; refuse UI migrate-as-salvage.
3. Correct misconceptions in writing (e.g. Nostr has no contacts object) — do not silently implement around them.
4. Prefer subtraction of false owners over new bridges.

## Status

- **F0:** Landed this doc (2026-11-08)
- **F1–F8:** Draft notes on shelf (`docs/exploration/feasibility/`)
- **F9:** **NARROW** recorded (2026-11-09) — staged workspace · private-trust primary · Cut 0 = account spine
- **Cut 0 design:** opened `specs/backend/cut0-account-spine-design-2026-11-09.md` — impl gated on maintainer ACK (slice 0.0)
