# Design — Unified social relationship lifecycle (2026-11-07)

```text
HANDOFF: social relationship lifecycle charter (rewrite band)
Investigation: specs/backend/2026-11-07-social-relationship-lifecycle-unified-investigation.md
PAUSED: Soft L3 · Tor · Matrix · Continuity · A4
```

## Goal

Every user-facing **relationship mutation** follows the same contract, carried on **existing** transport/membership owners — not a new mega-module and not unilateral localStorage.

## Contract (all domains)

```text
User intent
  → Local sticky commit (survives remount/hydrate; negative masks honored)
  → Wire intent (best-effort; tagged DM or membership leave/join publish)
  → Peer apply (idempotent demote/promote)
  → Outbox / honesty if wire pending or failed
  → UI reads one authority per domain (no silent resurrect from stale caches)
```

| Rule | Meaning |
|------|---------|
| R1 Local first | Actor’s UI updates immediately and sticks |
| R2 Wire best-effort | Failure must not roll back local sticky commit |
| R3 Peer apply sticky | Same resurrect rules as actor (no hydrate undoing apply) |
| R4 One write owner per domain | No parallel ledger writers |
| R5 No new publish owner | Route through request-transport / membership mutation + existing leave outbox / transport-kernel |

## Domain adapters (do not collapse into one store)

| Domain | Write owner | Wire | Apply | Read authority |
|--------|-------------|------|-------|----------------|
| DM contact | `use-peer-trust` + inbox + account projection | `requestTransport` lifecycle tags (`connection-*`) | `applyIncomingContactLifecycle` | peerTrust (+ projection when cutover) |
| Block | **single** blocklist owner (subtract dual) | New tag e.g. `connection-block` / `connection-unblock` via `requestTransport.sendDm` customTags | Incoming classifier → blocklist + optional unaccept | blocklist |
| Community membership | `community-membership-mutation-owner` | Existing leave outbox + join/invite publish | Sealed/community ingest + directory | ledger + directory (drift via relationship-sync experiment only) |

## Sequenced slices (one atomic step each)

### Slice 0 — Landed / in flight

- Contact remove sticky hydrate (L1 Pass) — commit pending
- Contact remove already has notify+apply; optional L2 dual CDP

### Slice 1 — Block/unblock lifecycle (next product slice)

1. Subtract dual blocklist → one owner (prefer network `use-blocklist`, migrate messaging readers)
2. `confirmBlock` / unblock: local commit + `notifyPeer` with `connection-block` / `connection-unblock`
3. Classifier + apply: peer marks blocked locally (and demotes trust on block)
4. L1 unit · L2 dual CDP optional

**Honesty:** Block is recipient-local defense; peer need not “agree,” but **must observe** the relationship end (same as remove). Wire notify is for demote/stop messaging UX, not consensus.

### Slice 2 — Leave peer visibility

1. Prove whether peer still sees leaver because publish failed, directory lag, or UI residue
2. Harden leave outbox honesty in chat chrome (already partially present)
3. Ensure peer apply of leave does not get undone by membership hydrate (mirror remove sticky lesson)
4. L2 leave residue Pass required before Fixed claim

### Slice 3 — Join / invite Fail

1. Re-drive social-core invite Fail with evidence
2. Stay inside membership mutation owner + invite DM publish — no new path

## Explicit non-goals

- Soft L3 / Tor Verified / Matrix promote
- Single global “relationship event log” replacing account projection + membership ledger
- New relay publish dual-owner under groups/relays stop-writing list
- Claiming all-six social-core Pass from this charter alone

## Proof language

| Claim | Requires |
|-------|----------|
| Charter written | This design + investigation committed |
| Slice N implemented | Spec slice + code |
| Slice N Fixed | Named L1 + L2 for that action (dual CDP for peer-visible) |

## Handoff next atomic step (after this charter)

```text
NEXT: commit contact-remove sticky + this charter · then Slice 1 Block lifecycle design→impl
```
