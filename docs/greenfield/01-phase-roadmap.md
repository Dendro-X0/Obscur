# Phase roadmap — greenfield

**Status:** Draft — concept phase  
**Last updated:** 2026-05-19 (security & scope pass)

---

## Overview

```text
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5
 charter      DM E2EE      groups       warnings     federation    ship path
 + tests      + courier    + roster     + WoT        adapters      + docs
```

**Gate rule:** No phase starts until the previous phase’s acceptance tests pass on **two physical or emulated devices** (not unit tests alone).

---

## Phase 0 — Charter & falsifiable tests (no product UI)

**Duration (indicative):** 2–4 weeks  
**Deliverables:**

- [Charter](./00-charter-sovereign-comms.md) frozen (this doc set).
- [Security & data classes](./05-security-data-classes.md) + [scope of responsibility](./06-scope-of-responsibility.md) reviewed.
- Threat model: scammer, broker, malicious courier, compromised device, state lawful access narrative.
- **10 acceptance tests** + security tests **S-1…S-5** (see [05](./05-security-data-classes.md)) written.
- Kill criteria document (when to stop or redesign).
- Privacy nutrition label draft (what C/D exposes if courier breached).

**Exit gate:** Maintainers agree tests are measurable; no implementation commitment beyond spike courier if needed.

### Phase 0 acceptance test catalog (draft)

| ID | Test |
|----|------|
| T0-1 | Airgapped install → create identity → export backup → restore on second device |
| T0-2 | Party A cannot DM Party B without B accepting an invite artifact |
| T0-3 | B blocks A → A’s subsequent envelopes not shown in B’s UI |
| T0-4 | Warning tier fires on fixture stream F-scam-01; does not fire on F-benign-01 |
| T0-5 | Warning fired → message still delivered (no covert drop) |
| T0-6 | Two clients, same rule pack version → identical tier for fixture stream |
| T0-7 | Group join → both devices show same roster within 5 min (Phase 2 placeholder) |
| T0-8 | Group leave → roster shrinks on both devices (Phase 2 placeholder) |
| T0-9 | New key cold-messaging 50 targets → rate limited within policy |
| T0-10 | Financial mention in cold-chat fixture → recipient warning ≥ `elevated` |

---

## Phase 1 — 1:1 E2EE core

**Duration (indicative):** 3–6 months (solo)  
**Scope:**

- Native shell (Tauri or mobile-first choice recorded in [architecture sketch](./04-architecture-sketch.md)).
- SQLite = UX source of truth.
- 1:1 E2EE, history, block list, safety numbers.
- **One courier implementation** (minimal: WebSocket or HTTPS sync) — documented self-host.
- TransportPort interface v0 (publish/subscribe envelopes only).

**Explicitly out of scope:** groups, Nostr, public relays, warning NLP, federation.

**Security:** Class A never leaves device; class B on courier only; **local FTS** for message search (no server index).

**Exit gate:** T0-1 through T0-3, T0-9 green on two devices; **S-1, S-2** where courier exists.

---

## Phase 2 — Small groups & membership authority

**Duration (indicative):** 6–12 months  
**Scope:**

- Group E2EE key rotation policy (documented).
- Signed membership ledger on courier (join / leave / invite).
- Group policies: admission rules object, signed by admin key.
- CI integration tests for roster convergence.

**Exit gate:** T0-7, T0-8 green; no UI freeze when relay adapter disabled; **S-3** green.

**Kill criterion:** If roster truth requires public relay gossip → **stop** and redesign directory owner.

---

## Phase 3 — Warning & trust layer

**Duration (indicative):** 3–6 months (can overlap late Phase 2)  
**Scope:**

- Versioned rule packs ([warning model](./02-warning-and-trust-model.md)).
- Metadata analyzers on courier/client boundary (minimal retention).
- Recipient-local analyzers for commerce-shaped conversation patterns.
- WoT / invite tree v0 ([identity doc](./03-identity-and-sybil.md)).
- Financial-activity warning policy (all motives, fiat + crypto mentions).

**Exit gate:** T0-4, T0-5, T0-6, T0-10 green; false-positive rate on benign fixtures documented.

---

## Phase 4 — Optional federation adapters

**Scope:**

- Nostr adapter (event bus only).
- Additional transports behind TransportPort.
- Adapters **cannot** become membership authority.

**Exit gate:** Adapter disabled → Phase 2 invariants still hold.

---

## Phase 5 — Distribution & honesty

**Scope:**

- Installer or store-ready build for **one** platform first.
- Maintainer setup guide (single happy path).
- Public safety page aligned with technical truth (no false moderation claims).
- Privacy nutrition label: what metadata couriers may see (classes C/D).
- Public safety page aligned with [06-scope-of-responsibility.md](./06-scope-of-responsibility.md).

**Exit gate:** Non-developer follows guide → T0-1 + T0-2 pass without IRC support.

---

## Obscur monorepo relationship

| Obscur asset | Greenfield use |
|--------------|----------------|
| PWA UI patterns / components | Reference or port selectively in Phase 1+ |
| `community-trust-policy` ideas | Inform rule pack, not copy-paste |
| Coordination worker | Pattern for signed directory only — simplify |
| v1.9.x Lane K program | **Not** greenfield schedule — do not merge roadmaps |

---

## Resource realism (solo maintainer)

| Phase | Solo realistic? |
|-------|-----------------|
| 0 | Yes |
| 1 | Yes (narrow scope) |
| 2 | Stretch — cut features |
| 3 | Stretch — rule packs before ML |
| 4–5 | Defer or partner |

Time-box: if Phase 2 gate fails twice with redesign, archive greenfield attempt without extending Obscur.
