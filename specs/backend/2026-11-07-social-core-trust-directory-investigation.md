# Investigation — Social core trust directory empty (2026-11-07)

```text
HANDOFF ATOMIC STEP: investigate Network Connections 0 / Invite empty after accept
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote · Continuity · A4 tag
CANONICAL OWNER: use-peer-trust · resolveContactRelationshipActions · leaveGroup
PROOF: L1 unit · L2 dual CDP re-soak of invite + Remove + leave residue
```

## Symptoms (L2 Partial)

1. After Tester2 Accept + DM Pass, Tester1 Network **Connections 0** · Invite Connections **No connections found**
2. Connection Profile: **Stranger** + **Connect disabled** (requestProjection `accepted`) · no Remove
3. Leave group: publish Pass · open thread still shows group with **0 members**

## Evidence

- Invite/Network list = `peerTrust.state.acceptedPeers` (`invite-connections-dialog`, `network-dashboard`)
- Trusted UI = `resolveContactRelationshipActions` requires **both** `peerTrustAccepted` and `requestProjection.state === "accepted"`
- Connect disable when `requestProjection.state === "accepted"` && `!isTrusted` → dead end
- `acceptedPeersForRead` **filters out** `stored.removedPeers`
- `hydrateAcceptedPeersFromChatState` can merge peers into `acceptedPeers` **without clearing** `removedPeers`
- Prior L2 remove left peers in `removedPeers`; re-accept must clear that mask

## Root cause (working)

Stale **`removedPeers` negative mask** survives re-accept / evidence hydrate, so read path reports zero connections while handshake evidence says accepted → Stranger + Connect stuck + Invite empty.

Leave residue: `leaveGroup` removes from sidebar list but does not clear `selectedConversation` when it is the left group.

## Non-causes

- Soft L3 / Tor
- Relay damus 503 alone (accept/DM still delivered)
