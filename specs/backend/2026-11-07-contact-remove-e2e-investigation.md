# Investigation — Contact remove not end-to-end (2026-11-07)

```text
HANDOFF ATOMIC STEP: key unlock landed · user reports remove contact E2E broken
  (supersede rewrite band allows social-core product repair)
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote · Continuity · A4 tag
CANONICAL OWNER: use-peer-trust · request-transport.notifyPeerConnectionEnded ·
  applyIncomingContactLifecycle · use-requests-inbox.remove
PROOF BEFORE DONE: L1 unit (unaccept sticky vs stale hydrate) · L2 dual CDP optional
SURFACE: desktop Tauri / static-dev
```

## Observed vs expected

| | |
|---|---|
| **Observed** | A removes B → B gone from A's Connections/chat. A still TRUSTED on B. B then Remove A → A remains on B's contact list and chat. |
| **Expected** | A's Remove notifies B (`connection-cancel`) and B demotes A. Either side's local Remove permanently drops the peer from Connections + chat until a new Accept. |
| **Started** | After 2026-11-07 trust-directory heal (`hydrate` lifts `removedPeers` when chat/evidence still say accepted). |

## Architecture

| Concern | Owner |
|---------|--------|
| Local trust mask | `use-peer-trust` (`acceptedPeers` + `removedPeers`) |
| Wire end notify | `requestTransport.notifyPeerConnectionEnded` → `t=connection-cancel` |
| Peer apply | `applyIncomingContactLifecycle` (`connection-cancel` → `unacceptPeer` + inbox `remove`) |
| Chat visibility | `useFilteredConversations` filters DMs by `isPeerAccepted` |
| Stale recovery source | `extractAcceptedPeersFromPersistedChatState` reads `connectionRequests status===accepted` |

UI Remove (`network-profile-view.confirmRemove`) already: notify → `unacceptPeer` → inbox `remove` → `deleteConversation`.

## Hypotheses

### H1 — Hydrate resurrects after unaccept (primary)

- **Mechanism:** Trust-directory heal made `hydrateAcceptedPeersFromChatState` merge chat/evidence peers and **strip them from `removedPeers`**. After Remove, `connectionRequests` can still list the peer as `accepted` (especially when `shouldWriteLegacyContacts` is false and `remove` skips `persistChange`). Next hydrate re-accepts the peer and clears the mask → Remove looks irreversible on that device (matches B's second symptom; also undoes wire cancel on B).
- **Falsify:** After `unacceptPeer`, force hydrate with persisted `connectionRequests: [{id: peer, status: "accepted"}]` — if peer returns to `acceptedPeers` and leaves `removedPeers`, H1 confirmed.

### H2 — Notify never delivered / not classified

- **Mechanism:** `notifyPeerConnectionEnded` fails relay or cancel not routed into `applyIncomingContactLifecycle`.
- **Falsify:** Wire unit already expects cancel → `unacceptPeer`. L2 would show no cancel ingest on B. Does not explain B's own Remove failing.

### H3 — Chat list ignores trust

- **Falsify:** `useFilteredConversations` gates on `isPeerAccepted` — if trust demotes, DM row hides. Chat residue without trust is secondary.

## Working root cause

**H1 confirmed by code review:** heal + stale `connectionRequests` make Remove non-sticky. A's local Remove can look fine if A's request row was scrubbed; B keeps A because either cancel never sticks or B's Remove is undone by the same hydrate.

## Non-causes

- Soft L3 / Tor / Matrix
- Key-unlock / device-password bind
- Missing Remove UI path (confirmRemove already notifies)

## Next

Design: hydrate must not lift `removedPeers` from stale chat/evidence; only explicit `acceptPeer` / wire accept clears the mask. Scrub persisted `connectionRequests` on remove even when legacy writes are off.
