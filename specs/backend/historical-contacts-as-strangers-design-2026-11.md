# Design — Recover trust for historical contacts after peerTrust wipe (2026-11)

**Parent:** [historical-contacts-as-strangers-investigation-2026-11.md](./historical-contacts-as-strangers-investigation-2026-11.md)

```text
HANDOFF ATOMIC STEP: A5 / continuity — stranger banner false positive
PAUSED / CANCELLED: Soft L3 · Tor · Matrix promote
CANONICAL OWNER: peerTrust hydrate · ChatView residue accept
PROOF: L1 use-peer-trust tests · ChatView auto-accept when local messages exist
```

## Rules

1. Do **not** trust bare `createdConnections` with empty preview (handshake incomplete).
2. Do recover from:
   - `connectionRequests.status === "accepted"`
   - request-flow `acceptSeen`
   - DM `messagesByConversationId` residue (account key required)
   - `createdConnections` with **non-empty** `lastMessage` and **no** pending request
   - native SQLite DM evidence on encrypted backup apply
3. ChatView: if a DM thread has hydrated local messages, is not in sandbox/outgoing-request mode, and peerTrust says not accepted → call `onAcceptPeer` once (live SQLite residue after native strip).

## Proof

| Layer | Command |
|-------|---------|
| L1 | `pnpm exec vitest run app/features/network/hooks/use-peer-trust.test.ts` (apps/pwa) |
