# Investigation — Decline still connected; re-add treated as permanent reject (2026-11-06)

```text
HANDOFF ATOMIC STEP: invite auto-trust fix (adjacent handshake lifecycle)
PAUSED: Soft L3 · Tor · Matrix · Continuity promote
CANONICAL OWNER: request-transport-service · contact-request-incoming-lifecycle · peerTrust · request-flow-evidence
PROOF: L1 decline clears trust · remove clears acceptSeen · declined→SEND_REQUEST → pending
```

## Operator evidence

- B declined A’s invitation; both sides still exchanged DMs afterward.
- After remove on both accounts, re-add treated prior rejection as permanent (Connect/accepted sticky).

## Causes

1. **Decline does not `unacceptPeer`** — `declineIncomingRequest` / incoming `connection-decline` set inbox `declined` and reset evidence, but leave `acceptedPeers` intact. Combined with prior invite-DM auto-trust, DMs stay open.

2. **Remove does not clear `acceptSeen`** — `confirmRemove` → `unacceptPeer` + `requestsInbox.remove` only. `requestFlowEvidenceStore.acceptSeen` can remain. `deriveRequestProjection` treats `acceptSeen` as **accepted** → primary Connect disabled / “already connected”.

3. **`resolveEffectiveContactRequestStatus`** forces `accepted` whenever `isPeerAcceptedByTrust` — stale trust after decline overrides explicit declined inbox rows.

## Fix

- Decline paths: `unacceptPeer` + evidence reset.
- Remove / unaccept: clear request-flow evidence for peer.
- Effective status: explicit `declined`/`canceled` must not be overwritten by trust alone (trust must be cleared on decline).
