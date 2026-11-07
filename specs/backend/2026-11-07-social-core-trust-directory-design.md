# Design — Trust directory heal + leave deselect (2026-11-07)

```text
HANDOFF ATOMIC STEP: design Connections/Invite/Remove + leave residue
PAUSED: Soft L3 · Tor · Matrix · Continuity · A4
```

## Goals

1. After Accept (or evidence hydrate), peer is in **Connections** and Invite picker
2. Trusted peer shows Message / Remove (not Stranger + Connect disabled)
3. Leave group clears open thread when that group was selected

## Changes

### A. Peer trust read + write heal

1. **`acceptPeer` / hydrate merge**: always remove peer from `removedPeers` when adding to `acceptedPeers`
2. **`hydrateAcceptedPeersFromChatState`**: when merging evidence/projection peers, strip those peers from `removedPeers`
3. **`acceptedPeersForRead` (optional harden)**: never mask out a peer that is currently in projection-accepted / evidence-accepted set — prefer clear mask on write; add read-side heal if needed for one session

### B. Relationship actions (narrow)

If `requestProjection.state === "accepted"` and peer is in `acceptedPeers` after heal, existing resolver already returns Message/Remove. No Connect orphan path if heal works.

Optional safety: when projection accepted but not peerTrustAccepted, enable a **Heal / Connect** path that calls `acceptPeer` — only if heal-on-read is insufficient.

### C. Leave group

After `removeGroupConversation(conversationId)`, if `selectedConversation?.id === conversationId`, clear selection (`setSelectedConversation(null)` or equivalent).

## Proof

- L1: unit for removedPeers clear on accept/hydrate; leave clears selection → **21 Pass**
- L2: static-dev CDP `:9230` after rebuild `shell-2026-11-07T12:35:45Z`
  - Connections 1 · Tester2 TRUSTED · `removedPeers=0`
  - Profile Trusted + Message + Remove
  - Leave: L1 audit Pass · runtime leave re-drive optional
- Evidence: `docs/handoffs/social-core-trust-directory-heal-l2-2026-11-07.{md,json}`

## Out of scope

Soft L3, Tor Verified, Matrix promote, Continuity, A4 tag, local desktop:package
