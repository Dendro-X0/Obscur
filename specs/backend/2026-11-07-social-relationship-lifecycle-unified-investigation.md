# Investigation — Unilateral social actions (remove / leave / block / join) (2026-11-07)

```text
HANDOFF ATOMIC STEP: contact remove E2E sticky L1 · user expands to unified social lifecycle
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote · Continuity · A4 tag
CANONICAL OWNERS (domain):
  DM trust: request-transport + use-peer-trust + incoming-lifecycle
  Community membership writes: community-membership-mutation-owner (+ leave outbox)
  Block: use-blocklist (network) · dual messaging blocklist (debt)
PROOF BEFORE DONE: inventory + design charter (this band) · per-slice L1/L2 later
SURFACE: desktop Tauri / static-dev dual CDP
```

## Product statement

Actions that change a **relationship** (contact, membership, block) must not be **local-only UI commits**. Each action needs:

1. **Local sticky commit** (survives hydrate / remount)
2. **Wire notify** (best-effort via existing DM tags or membership/relay path — not a new parallel publish owner)
3. **Peer/apply path** that demotes or updates the other side’s view
4. **Honest UI** when notify is pending / failed (outbox), without resurrecting via stale caches

## Current inventory (code-backed)

| Action | Local commit | Wire notify | Peer apply | Sticky vs hydrate | Status |
|--------|--------------|-------------|------------|-------------------|--------|
| Remove contact | `unacceptPeer` + inbox `remove` + delete DM | `notifyPeerConnectionEnded` → `t=connection-cancel` | `applyIncomingContactLifecycle` cancel → unaccept | Fixed L1 2026-11-07 (hydrate no longer lifts `removedPeers`) | **Partial E2E** — L2 dual CDP still open |
| Decline / cancel request | inbox + unaccept | decline/cancel tags | lifecycle | Present | OK pattern to reuse |
| Accept / Connect | `acceptPeer` + evidence | accept tag | lifecycle accept | Present | OK |
| Block | `blocklist.addBlocked` (localStorage only) | **none** | **none** | Local only; dual stores (network + messaging) | **Unilateral** |
| Unblock | `removeBlocked` | **none** | **none** | Local only | **Unilateral** |
| Leave group | ledger leave + leave outbox + sidebar refresh | leave publish / coordination | membership ingest / directory | Leave outbox exists; L2 leave residue **Partial** (sidebar deselect heal landed) | **Partial** — peer roster lag / residue |
| Join / invite accept | membership mutation owner | invite/join publish | joiner ingest | COM-MEM / REL-005 write funnel exists | **Partial** — invite Fail in social-core L2 |
| Kick / expel | governance / ledger | roster signals | directory materialization | Complex; dual read models | **Partial** |

## Root pattern (not one bug)

Symptom class: **UI writes a local store and assumes the social world updated**. Peers keep stale trust/membership until they independently act — or local hydrate/resurrect undoes the actor’s own action.

Contact-remove sticky fix addresses one resurrect path. It does **not** create a platform-wide lifecycle bus.

## Parallel / dual-owner risks (do not invent a third)

| Risk | Evidence |
|------|----------|
| New relay publish path | Studio `stop-writing-here` on community/relay dual-owner publish modules |
| Dual blocklist | `2026-11-06-contact-delete-block-reconnect-design.md` already flags network vs messaging blocklist |
| Membership read vs write | REL-005 write owner exists; read convergence still multi-surface |
| relationship-sync experiment | Drift detector / experiment only — not a live mutation owner |

## Hypotheses for remaining Fail/Partial

### H1 — Block never wires

Block is pure localStorage. Peer still sees actor as contact and can message until local gates fire. **Confirmed by code.**

### H2 — Leave publishes but peer roster UI lags / local residue

Leave outbox + ledger exist; social-core L2 leave Partial + prior leave-deselect heal. Peer “still in group” may be directory lag or unread selection residue — needs L2 classify per community.

### H3 — Join/invite path incomplete on wire or inbox

Social-core L2 invite Fail — separate from remove sticky.

## Non-causes for “unify everything in one PR”

- Soft L3 / Tor / Matrix
- Replacing REL-005 membership write owner
- Building a second EVENT publish stack

## Next

Design charter: one **lifecycle contract** (intent → local sticky → wire → apply → outbox honesty) with **domain adapters**, sequenced slices starting with Block notify+apply, then leave peer visibility, then invite Fail.
