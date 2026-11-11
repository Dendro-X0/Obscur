# Feasibility — Relationship discovery & multiparty sync (no central social server)

**ID:** F-rel-discover  
**Status:** draft  
**Date (UTC):** 2026-11-09  
**Charter:** `specs/backend/platform-feasibility-exploration-charter-2026-11-08.md`  
**Parents:** F1 · F-hub · F-alt · F-PSE · F-auth-schemes-solution · `social-multiparty-sync-production-gate-design-2026-11-08.md` · Soft L3 contact failure evidence  
**Claim language:** **explored** ≠ Soft L3 Fixed · ≠ WoT shipped · ≠ “contacts on Nostr”

## 1. Scope

- **In:** How users **discover** and **agree** relationships in a social app **without** a mainstream central graph server; how to keep **peer E2EE / P2P intent** while **synchronizing social behavior** across devices/users; explicit **decoupling** from Nostr “contacts / strangers / web-of-trust” as protocol primitives.
- **Out:** Soft L3 Pass soaks; implementing CRM this phase; adopting Signal-style phonebook PSI as default (needs a large directory operator).

## 2. Basics

### What failed before

Nostr (and similar public event logs) has **messages**, not a first-class **relationship object**. Mapping “DM history / follow lists / kind theater” → TRUSTED / Requests / strangers / WoT **cannot** be made reliable: lookback rewrites social state. That path is **set aside** (F1 · Soft L3 pause).

### What a social app still needs

| Need | Meaning |
|------|---------|
| **Discovery** | How Alice finds a way to address Bob (invite, code, link, proximity, shared intro) |
| **Agreement** | How both sides converge on the same edge state (pending / trusted / removed / blocked) |
| **Sync** | How that agreement survives offline, multi-device, and adversarial reordering of transport events |
| **Privacy** | How discovery does not upload the user’s entire social world to a curious operator |

### Hard constraint (Obscur)

No product-central “contacts API.” Relays / homeservers / private DC are **carriers or optional infra**, not the CRM authority. Mainstream methods (upload address book → server returns matches) are **not** the default architecture.

### Mental model (decoupled)

```text
┌─────────────────────────────────────────────┐
│  Relationship plane (local SQLite / vault)  │
│  edge id · lifecycle · tombstones · clock   │
└──────────────────┬──────────────────────────┘
                   │ sync envelopes (authenticated, preferably E2EE)
                   ▼
┌─────────────────────────────────────────────┐
│  Discovery / delivery adapters              │
│  invite QR · link · private relay outbox    │
│  optional Tor · later PSI/dead-drop research│
│  Nostr/Matrix = transport of envelopes only │
└─────────────────────────────────────────────┘
```

**Peers interact end-to-end** on relationship *intents*. **Carriers only move bytes.** **Truth is the pairwise (or small-group) agreed state**, persisted locally on each workspace.

## 3. Capabilities map

| Capability | Central-app method (rejected as default) | Decentralized Obscur candidates |
|------------|------------------------------------------|--------------------------------|
| Find friends on the network | Phonebook upload + PSI/hash directory | Out-of-band invite; introduction by mutual; private discovery service (opt-in); research: DNS dead-drops / Arke-class |
| Show “pending request” | Server row | Local outbox + peer ack; sticky until Accept/Decline |
| Both see TRUSTED | Server push | Dual local commit after mutual Accept intents |
| Remove / block sticks | Server delete | Local tombstone + signed revoke envelope; **ignore** older transport noise |
| Multi-device same user | Server account | Continuity/backup of **graph DB** (Plane 3) — not relay lookback |
| Cross-protocol same edge | N/A | One graph row; multiple linked carrier addresses |

### Discovery modes (tiered — honest UX)

| Tier | Mode | Feasibility | Privacy | UX |
|------|------|-------------|---------|-----|
| **D0** | **Out-of-band invite** (QR / link / code / file) | High | High | Familiar for private-trust |
| **D1** | **In-app intro** (C introduces A↔B with consent) | Medium | High | Social, no global directory |
| **D2** | **Private operator directory** (community DC opt-in) | Medium | Operator-trust | Closest to “find coworkers” without public Nostr CRM |
| **D3** | **Privacy-preserving discovery protocols** (PSI, UDM, Arke, PROUD-style dead drops) | Low–Med research | Designed high | Not Cut 0 |
| **D✗** | Infer contacts from public Nostr follows / DM history | — | Poor / wrong | **Reject** |

### Sync modes (agreement without a central CRM)

| Mode | Idea | Fit |
|------|------|-----|
| **S0 Sticky local + signed intents** | Each edge has state machine; carrier delivers `invite/accept/decline/remove/block` envelopes; receiver applies if signature + monotonic rule OK; **never** rebuild from full history scan | **Primary — Cut 0** |
| **S1 Pairwise CRDT / version vector** | Concurrent edits on same edge | If multi-device races appear |
| **S2 Private sync mirror** | Optional user-owned relay stores **encrypted graph blobs** (not plaintext contacts) | Continuity assist |
| **S✗ History reconstitution as CRM** | Soft L3 path | **Reject** |

**Synchronization across users** means: after Accept, both local graphs show TRUSTED for that edge id — achieved by **explicit dual commit**, not by “both saw the same Nostr events.”

## 4. Fit to planes

| Plane | Rule |
|-------|------|
| Auth | Only unlocked workspace may mutate local graph / emit intents |
| Profile | Graph is per workspace; hard isolation |
| Storage | Canonical edges + tombstones in encrypted SQLite |
| Relationship | **Owner of discovery outcomes and sync state** |
| Message | May open threads *after* edge allows; must not create TRUSTED |
| Transport | Delivers opaque or typed **intent envelopes**; interchangeable |

## 5. Libraries / stacks

| Area | Notes |
|------|-------|
| Local graph | SQLite in kernel (F-stack / F-hub) |
| Intent crypto | Same tier policy as messaging (F-PSE); relationship intents should be ≥ T2 when on public carriers |
| Research discovery | PSI literature, UDM, Arke, PROUD — **bibliography only** until F9 narrows |
| Forbidden owner | Nostr kind lookback, Matrix membership alone as TRUSTED |

## 6. Feasibility verdict

`fit-with-adapter` — Decentralized relationship **discovery + sync** is feasible if Obscur:

1. Treats **D0/D1** (invite + intro) as the product-default discovery,  
2. Uses **S0** (sticky local graph + signed intents) for multiparty agreement,  
3. Allows **D2** private directories only as opt-in operator infra,  
4. Keeps **D3** research off the critical path,  
5. **Never** re-binds CRM to Nostr/Matrix history.

This is **better** than WoT-on-Nostr for security (no global graph leak by default), UX (pending/accept behave like a real app), and feasibility (implements a state machine, not protocol archaeology).

`reject-for-core` — contacts/strangers/WoT as **Nostr-native** roles; central phonebook upload as **required** discovery.

### Recommended product loop (E2EE peer social)

```text
Alice creates invite (local edge: outbound_pending)
  → envelope E2EE to Bob via chosen carrier / QR
Bob receives → local edge: inbound_pending (Requests)
Bob Accept → local TRUSTED + signed accept envelope
Alice applies accept → local TRUSTED
Either Remove/Block → tombstone + revoke envelope; ignore older invites
```

Carriers may duplicate, delay, or reorder envelopes; **tombstones and monotonic edge versions** make social behavior converge.

## 7. Risks / traps

- Reintroducing “strangers” as a Nostr follow-graph concept.  
- Using gift-wrap DMs as the only Accept signal (lookback returns).  
- Merging discovery with messaging (“first DM = friend”).  
- Building D3 PSI before D0 invite UX works.  
- Assuming private DC is “centralization betrayal” — **user/operator-owned** sync is allowed; **Obscur-as-Facebook-graph** is not.  
- Multi-device without Continuity of the **graph DB** → split-brain TRUSTED.

## 8. Open questions

1. Edge identity: opaque UUID vs hash(invite material) — stable across carriers?  
2. Introductions (D1): does C learn that A↔B accepted?  
3. Block propagation: must Bob learn he is blocked, or only silent drop?  
4. Group relationships vs 1:1 edges — same machine or later?  
5. When (if ever) to charter an optional encrypted graph mirror on private relays?

## 9. References

### In-repo

- `docs/exploration/feasibility/01-relationship-authority.md`  
- `docs/exploration/feasibility/15b-auth-schemes-solution-record.md`  
- `specs/backend/social-multiparty-sync-production-gate-design-2026-11-08.md`  
- `specs/backend/historical-contacts-as-strangers-design-2026-11.md`  
- Soft L3 handoffs under `docs/handoffs/p1-o4b-*`

### External (discovery research — not adoption)

- Signal-class PSI contact discovery (operator directory) — e.g. academic “PSI Meets Signal”  
- UDM — private user discovery with minimal disclosure  
- Arke — BFT privacy-preserving contact discovery  
- PROUD — DNS dead-drop style friend discovery without revealing the social graph to one app operator  
