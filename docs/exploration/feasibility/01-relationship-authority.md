# Feasibility — Relationship authority (must not live on relays)

**ID:** F1  
**Status:** draft (maintainer-facing basics)  
**Date (UTC):** 2026-11-09  
**Charter:** `specs/backend/platform-feasibility-exploration-charter-2026-11-08.md`

## 1. Scope

- **In:** What a “contact / request / remove / TRUSTED / blocked” model must own; why Nostr/Matrix message history cannot be that owner; implications for Obscur’s platform goal.
- **Out:** Soft L3 soak procedures; UI layout; implementing a new graph this session.

## 2. Basics

A **relationship** is shared social state with explicit lifecycle (invite → pending → accept / decline → remove / block) that both parties can reason about.

A **message** is an encrypted (or clear) payload delivered over a transport.

Public store-and-forward protocols (especially Nostr) give you **events**. They do **not** give you a first-class contacts object. If the product treats “we exchanged ceremony messages” as “we are contacts,” lookback and relay history will keep resurrecting trust — that is protocol physics, not a missing if-statement.

Obscur’s Soft L3 contact failures were symptoms of this mismatch.

## 3. Capabilities map

| Need for Obscur | Can relays / DM history provide? | Notes |
|-----------------|----------------------------------|-------|
| Pending invite visible until user Accept | **No** (reliably) | History re-applies accept/cancel |
| Remove demotes peer without flap | **No** (reliably) | Cancel is another event among many |
| Same relationship on Nostr *or* Matrix | **No** if graph is Nostr-shaped | Need carrier-agnostic graph |
| Multiparty converge (A and B agree) | Only if graph syncs as data | Not via gift-wrap tags alone |

## 4. Fit to planes

| Plane | Fit | Notes |
|-------|-----|-------|
| Auth | N/A | Unlocks who may mutate local graph |
| Profile | Adjacent | Display names ≠ trust edges |
| Storage / DB | **Owner** | Graph rows live in account DB |
| Relationship | **This note’s subject** | Canonical |
| Message | Consumer | May reference peer ids; must not invent edges |
| Transport | Carrier only | Delivers intent envelopes; no CRM |

## 5. Libraries / stacks

Not a library pick yet. Candidates appear in F8 (DB) + carrier notes. Constraint: graph schema must not embed Nostr event ids as the only primary key for “is trusted.”

## 6. Feasibility verdict

**`fit-with-adapter`** — Feasible **only if** Obscur treats relationship graph as a **platform plane** and carriers as adapters that may *propose* intent (invite/accept/remove) without *authoring* TRUSTED from lookback.

**`reject-for-core`** — Building contacts exclusively as Nostr kind-4/1059 tag theater.

## 7. Risks / traps

- Inferring contacts from “any DM exists” (including historical ChatView auto-accept designs).
- Soft L3 / public relay lookback as source of truth for accept/remove.
- Claiming “multi-protocol contacts” while the graph is still Nostr event residue.
- Spending years migrating Nostr-shaped UI instead of defining the graph first.

## 8. Open questions

1. Sync model for graph: local-only sticky + outbox, CRDT, or server-assisted private DC?
2. What envelope do carriers publish for invite/accept/remove (opaque blob vs protocol-native)?
3. How do “multiple apps under one account” share one graph without sharing one carrier?

## 9. References

- Soft L3 contact Partial evidence: `docs/handoffs/p1-o4b-*-2026-11-08.md`
- Platform planes: `specs/backend/platform-rewrite-band-charter-2026-11.md`
- Production social gate (relationship as plane P1): `specs/backend/social-multiparty-sync-production-gate-design-2026-11-08.md`
- Prior “historical contacts as strangers” tension: `specs/backend/historical-contacts-as-strangers-design-2026-11.md`
