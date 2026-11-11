# Investigation — Unblock resurrects TRUSTED on public Default Stable (2026-11-08)

```text
HANDOFF ATOMIC STEP: P1-O1 public Block re-prove → Partial (noAutoAccept Fail)
PAUSED: Soft L3 Fixed · Tor · Matrix · claiming P1 Block public Pass
CANONICAL OWNER: network-profile-view unblock + use-peer-trust hydrate / removedPeers
PROOF: docs/handoffs/block-lifecycle-public-stable-l2-soak-2026-11-08.md
SURFACE: static-dev dual CDP · public wss relays
```

## Symptom

After Tester1 **Block** (local unaccept + blocklist) then **Unblock** on Public Default Stable:

1. Unblock click snip briefly shows **STRANGER**
2. Within ~2s, profile shows **TRUSTED CONNECTION** and `peer_trust` storage `acceptedPeers` again includes Tester2
3. Soft L3 Block L2 same day: Unblock left **STRANGER** (noAutoAccept Pass)

## Code facts

- `confirmBlock`: `addBlocked` + `peerTrust.unacceptPeer` + inbox remove + delete DM + `notifyPeerBlocked` (`network-profile-view.tsx`)
- `handleToggleBlock` Unblock: **only** `removeBlocked` + `notifyPeerUnblocked` — does **not** call `acceptPeer`
- `hydrateAcceptedPeersFromChatState`: merges chat/evidence peers into `acceptedPeers` but skips `removedPeers` (contact-remove sticky lesson)
- Therefore resurrect implies either:
  - **H1** `removedPeers` missing Tester2 after Block (unaccept did not stick / wrong profile key)
  - **H2** something other than hydrate writes accept (projection authority / relationship resolver) while storage snap still catches a later accept write
  - **H3** lab **seed** precondition left chat-state / request evidence that interacts badly with public relay backlog (accept tags replay) after unblock clears block gate
  - **H4** Soft L3 vs public timing: Soft L3 soak measured before async hydrate; public wait 2s exposed race

## Evidence

- Public soak JSON: `afterBlockT1.acceptedHasPeer=false`, `demoted=true`, `afterUnblockT1.acceptedHasPeer=true` + TRUSTED snip
- Soft L3 soak: `afterUnblockT1.acceptedHasPeer=false`

## Next (design before code)

1. Reproduce with **organic** mutual trust (no seed) on Soft L3 → switch Default Stable → Block/Unblock; compare `removedPeers` before/after unblock via CDP
2. If H1/H3 confirmed: design sticky — Unblock must not lift `removedPeers`; only explicit Connect/Accept may
3. Do not patch until design names owner + L1 unit for noAutoAccept after unblock

## Non-goals

- Soft L3 Fixed · packaged NSIS · kick/expel
