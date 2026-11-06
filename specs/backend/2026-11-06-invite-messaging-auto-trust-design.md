# Design — Invite traffic must not mint TRUSTED contacts (2026-11-06)

```text
CANONICAL OWNER: use-peer-trust extractAcceptedPeersFromPersistedChatState
PROOF: L1 unit · L2 DemoUser All People empty after invite-only until Accept
```

## Invariant

A peer enters `acceptedPeers` / All People **TRUSTED** only after an explicit handshake completion signal:

- `connectionRequests.status === "accepted"`, or
- request-flow `acceptSeen === true` (Accept tapped or `connection-accept` received).

**Not** from: sending/receiving `connection-request`, sandbox QnA, or any other DM residue alone.

## Change

In `extractAcceptedPeersFromPersistedChatState`:

1. Keep `acceptedFromRequests` (status accepted).
2. Remove `acceptedFromMessageThreads` and `acceptedFromThreadPreviews` recovery paths (Nov historical over-reach).
3. Keep `extractAcceptedPeersFromRequestEvidence` (`acceptSeen`) as the wipe/restart recovery path.

Historical “months-old contact looks like stranger after peerTrust wipe” → Accept on stranger banner / restore with accept evidence — do **not** re-open invite auto-trust.

## Tests

- Invite-only outgoing message residue → `[]`
- Preview with lastMessage but no accepted request → `[]`
- Accepted request still recovers
- acceptSeen evidence still recovers
- Existing “createdConnections empty preview” still `[]`
