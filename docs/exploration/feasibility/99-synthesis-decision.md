# Feasibility — Synthesis decision (GO / NARROW / NO-GO)

**ID:** F9  
**Status:** draft (decision recorded)  
**Date (UTC):** 2026-11-09  
**Charter:** `specs/backend/platform-feasibility-exploration-charter-2026-11-08.md`  
**Parents:** F0–F8 · F-alt · F-hub · F-PSE · F-sync · F-gaps · 15b  
**Claim language:** **NARROW recorded** ≠ Cut 0 designed · ≠ Soft L3 Fixed · ≠ coding authorized without cut design · ≠ messaging Pass

## 1. Scope

- **In:** One maintainer-facing synthesis of the exploration shelf: is the platform concept feasible, and under what cuts? Name the **first rewrite cut** if not NO-GO.
- **Out:** Implementing Cut 0; Soft L3 contact Pass; Tor Verified; Matrix promote; full messaging/calls/notifications product specs (still owed as follow-on design).

## 2. Basics

Charter hinge:

> One Obscur account plane (**auth · profiles · database**) with **switchable carriers** — many protocols through one account, not “Nostr is the app.”

| Decision | Meaning (charter) |
|----------|-------------------|
| **GO** | Feasible under rewrite-band cuts; first cut named; Soft L3 stays paused |
| **NARROW** | Platform goal kept but carriers / features cut (e.g. private mesh first, Nostr secondary) |
| **NO-GO** | Concept not feasible as stated; archive or redefine |

### Verdict (this note)

# **NARROW**

The platform concept is **feasible**. Day-one **peer-equal multi-protocol hub** is **not**. Ship a **staged workspace** with **private-trust (S1) primary**, then additive carrier modules.

## 3. Capabilities map — shelf roll-up

| Charter need | Shelf answer | Tag |
|--------------|--------------|-----|
| Aggregator law | Protocols = adapters; one profile | F0.5 `fit-with-adapter` |
| Sticky CRM | Local graph; reject history-as-contacts | F1 `fit-with-adapter` |
| Nostr | Carrier only; T2 honesty; ≠ CRM/auth | F2 `fit-with-adapter` |
| Matrix | Strong group/HS pin; lab ≠ promote | F3 `fit-with-adapter` / lab today |
| Private home | Game-server DC/relay = private-trust backbone | F4 `fit-with-adapter` |
| E2EE | Tier policy; own DR/MLS path for T3/T4; NIP-17 ≠ Signal | F5 `fit-with-adapter` |
| Tor | Optional underlay; ≠ E2EE; ≠ Verified | F6 `fit-with-adapter` |
| Decentralization | Multi-mode S0–S5; S1 default; S6 later | F7 `fit-with-adapter` |
| Auth · profile · DB | 15b face · SQLite+vault · at-rest pick deferred | F8 `fit-with-adapter` |
| Hub end-state | Vault + sandbox + linked apps | F-hub |
| Near-term shape | **F staged ∩ C private-trust primary** | F-alt |
| Continuity | Sealed file + own DC + pair; reject custodial/lookback | F-sync |
| Auth face | Password-wrap + optional passkey/keystore | 15b |

**Nothing on the charter spine returned `reject-for-core` for the platform idea itself.** Rejects are for **false owners** (CRM-on-Nostr, OAuth root, Tor-as-product, peer apps day one, etc.).

## 4. Fit to planes — rewrite posture

| Plane | Cut posture |
|-------|-------------|
| **Auth** | Keep single-door + PDK; honor 15b; session orchestrator out of React |
| **Profile** | One `profileId` oracle; hard path isolation; linked identities as rows |
| **Storage / DB** | SQLite schema spine + vault envelopes; SQLCipher vs file-AEAD = Cut 1 |
| **Relationship** | Sticky local graph; Soft L3 Pass remains **paused** (proof debt, not architecture NO-GO) |
| **Message** | Canonical threads in workspace DB; carrier encode/decode; messaging UX exploration still thin (F-gaps) — does **not** reverse NARROW |
| **Transport** | Named homes; S1 primary; Nostr/Matrix/Tor as staged/optional |

## 5. Libraries / stacks (locked leans for cuts)

| Area | Lean | Deferred |
|------|------|----------|
| Kernel / UI | Rust kernel · TS UI · modular · SQLite (F-stack) | Full crate split schedule |
| Auth | Password-wrap + OS keystore; passkeys optional | OPAQUE/SVR |
| DB at-rest | PDK-wrapped DB key (SQLCipher **or** file AEAD) | Pick in Cut 1 design |
| Crypto | Tier labels; private-trust aim T3/T4 via own DR/MLS | E2 before public-carrier promote |
| Continuity | M1 file · M2 own DC · M4 pair | Live multi-device CRDT |
| Tor / Matrix | Optional / lab until explicit promote cut | Tor Verified · Matrix promote |

## 6. Feasibility verdict

### Decision: **NARROW**

**Why not NO-GO:** Auth · profile · SQLite · vault · sticky CRM · switchable carriers are coherent and already partially as-built. Private homes, Continuity, and aggregator law close the conceptual gaps that made Soft L3 unfixable by patches alone.

**Why not full GO (peer hub day one):** F-alt scorecard and F7/F2/F3 honesty show that shipping equal Nostr+Matrix+… apps, full E2EE marketing, and Tor Verified in one band recreates boil-the-ocean and false security labels. Soft L3 CRM-on-history remains a paused proof band — architecture must not wait on that Pass to choose a narrower cut.

**What NARROW means in product language:**

```text
End-state (kept):     hub · vault · sandbox · linked-identity apps · multi-carrier
v1 rewrite face:      staged workspace · private-trust (S1) primary · one CRM · one unlock
Additive later:       Nostr module · Matrix module · Tor underlay · richer Continuity
Still paused:         Soft L3 Fixed · Tor Verified · Matrix promote · UI migrate-as-salvage
```

### First rewrite cut (named)

**Cut 0 — Universal account spine (no new carrier product):**

1. **One profile-id owner** (oracle) + hard isolation paths  
2. **Session orchestrator** out of React (auth door Planes 1–2 per 15b)  
3. **Schema spine** in SQLite: `relationship_edge` · `home` · `linked_identity` · conversation/message stubs · vault index  
4. **Vault envelopes kept**; inbound sandbox ownership stays platform  
5. **Carrier ports** exist as adapters only — **private-trust home (H-relay / H-dc)** is the default enabled surface; public Nostr/Matrix not peer-equal in Cut 0

**Cut 0b (same band or immediately after):** secrets/tokens → keychain/kernel; no Matrix (or other) session in plain localStorage as workspace truth.

**Cut 1 (after Cut 0 design):** at-rest DB encryption pick + Continuity sealed snapshot includes SQLite bodies (F-sync / F8).

**Not in Cut 0:** Soft L3 Pass · Tor Verified · Matrix promote · peer-app hub UX · novel group ratchet · cloud Postgres workspace · OAuth root.

### Coding gate

Exploration docs-only rule **lifts only after** a **Cut 0 design spec** exists under `specs/backend/` (contracts + invariants + L1–L4 proof plan). F9 **NARROW** authorizes *planning* that cut — it does **not** itself authorize product/impl diffs.

## 7. Risks / traps

- Reading **NARROW** as “abandon hub” → no; hub is end-state, staged.  
- Reading **NARROW** as “Nostr-primary forever” → no; private-trust primary; Nostr is a module.  
- Starting Cut 0 impl from chat without cut design.  
- Re-opening Soft L3 Fixed under “relationship schema landed.”  
- Shipping Cut 0 with plaintext SQLite and calling Continuity done.  
- Messaging/calls gap unexplored → do a thin messaging plane note before Cut 0 message tables freeze.

## 8. Open questions

**Tier A resolved (F-confirm 2026-11-09):** messaging skim first · thin H-dc · compose later · **T3** launch · at-rest encrypt **same band as spine** · keychain secrets · lab without public carrier · zaps non-goal. See `23-cut0-confirmation-gate.md` + `24-messaging-plane-skim.md`.

Remaining before/during Cut 0 design:

1. B6: SQLCipher vs whole-file AEAD (now in Cut 0 band).  
2. B3: single vs split SQLite files.  
3. Thin H-dc receive MVP: push vs poll.  
4. T3 multi-device enroll before launch vs single-device first.  
5. When does Matrix leave lab — after S1 messaging soak, or parallel Cut?

## 9. References

- Charter decision gate — `specs/backend/platform-feasibility-exploration-charter-2026-11-08.md`  
- F-alt staged ∩ private-trust — `13-architecture-alternatives-hub-critique.md`  
- F0.5–F8 shelf — `docs/exploration/feasibility/README.md`  
- Auth face — `15b-auth-schemes-solution-record.md`  
- Gaps — `21-design-coverage-gap-inventory.md`  
- Continuity — `20-cross-device-profile-sync-e2ee.md`  
