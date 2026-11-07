# Design — Contact remove permanence + peer demote (2026-11-07)

```text
HANDOFF: contact remove E2E repair (after key-unlock ship)
PAUSED: Soft L3 · Tor · Matrix · Continuity · A4
Investigation: specs/backend/2026-11-07-contact-remove-e2e-investigation.md
```

## Goals

1. Local Remove is sticky: peer leaves Connections + chat and stays out until a **new Accept** (`acceptPeer` / wire `connection-accept`).
2. Stale `connectionRequests status=accepted` or leftover `acceptSeen` must not undo Remove via hydrate.
3. Keep wire path: A's Remove still calls `notifyPeerConnectionEnded` (`connection-cancel`); B's ingest still demotes via `applyIncomingContactLifecycle`.

## Non-goals

- Soft L3 / Tor / Matrix
- Changing Accept ceremony
- Deleting message history beyond existing `deleteConversation` on Remove

## Changes

### A. Hydrate must respect `removedPeers` (subtraction of heal overreach)

In `hydrateAcceptedPeersFromChatState`:

- Recovered peers from chat/evidence **must not** be merged if they are already in `prev.removedPeers`.
- Do **not** strip `removedPeers` based on silent hydrate recovery.
- `acceptPeer` and wire accept already clear the mask — that remains the only lift path for a previously removed peer.

This undoes the part of trust-directory heal that made Remove non-sticky, while keeping `acceptPeer` clear-on-write for intentional re-accept.

### B. Scrub chat `connectionRequests` on inbox remove (always)

`use-requests-inbox.remove`:

- When dropping a peer, call `persistChange(next, { force: true })` (or equivalent) so `connectionRequests` no longer lists that peer as `accepted`, even when `shouldWriteLegacyContacts` is false.

### C. Unaccept already clears evidence + CONTACT_REMOVED

No change required beyond A/B; keep `requestFlowEvidenceStore.clear/reset` on unaccept/remove.

## Invariants

| # | Invariant |
|---|-----------|
| I1 | After `unacceptPeer(P)`, `isAccepted(P)` is false until `acceptPeer(P)` or wire accept. |
| I2 | Hydrate with stale accepted `connectionRequests` for P does not clear `removedPeers` or re-add P. |
| I3 | Wire `connection-cancel` still calls `unacceptPeer` + inbox remove. |
| I4 | Chat DM rows still gated by `isPeerAccepted`. |

## Proof

- **L1:** `use-peer-trust` — unaccept then hydrate from stale accepted chat row → peer stays removed; acceptPeer after remove restores. Existing accept/hydrate tests that assumed silent lift of `removedPeers` from evidence alone must be updated to require `acceptPeer` (or wire accept).
- **L1:** `use-requests-inbox` / remove force-persist if covered.
- **L2 (optional):** dual CDP A Remove → B demotes; B Remove → A gone from B Connections/chat.

## Claim language

- L1 green → **implemented** / **L1 Pass**
- Dual CDP → **L2 Pass** for E2E demote
- Do not claim Fixed without named L2 when asserting peer-visible remove
