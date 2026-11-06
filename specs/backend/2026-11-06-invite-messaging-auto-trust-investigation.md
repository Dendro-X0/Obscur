# Investigation — Invite / messaging auto-trusts contacts (2026-11-06)

```text
HANDOFF ATOMIC STEP: cold-run beta.7 Exact Match (adjacent public-face trust)
PAUSED: Soft L3 · Tor · Matrix · Continuity promote
CANONICAL OWNER: use-peer-trust extractAcceptedPeersFromPersistedChatState
PROOF: L1 invite-only residue must NOT enter acceptedPeers · L2 DemoUser All People empty until Accept
SURFACE: packaged desktop · DemoUser ↔ Tester1
```

## Operator evidence

- DemoUser invited Tester1 (`OBSCUR-Z8V4YD`); Tester1 did not Approve in Invitations.
- DemoUser **All People** shows Tester1 as **TRUSTED**; profile shows **TRUSTED CONNECTION** + Message enabled.
- Both sides exchange ordinary DMs (`cheat` / `choat`). Tester1 thread also shows plaintext **Accepted** (default accept notification text).

## Root cause

`extractAcceptedPeersFromPersistedChatState` (Nov historical-contacts recovery) promotes any peer with **DM message residue** or **non-empty `createdConnections.lastMessage`** into `acceptedPeers`, unless `connectionRequests` still lists that peer as `pending`.

Connection invite transport **is itself a DM** (`t=connection-request`, plaintext intro / `"Connection request"`). That residue is enough to recover trust when:

1. Pending is missing from persisted `connectionRequests` (inbox-only pending, stale release, never mirrored), or
2. Pending was cleared while handshake messages remain.

Network **All People** lists `peerTrust.state.acceptedPeers` and stamps them **TRUSTED** — so invite traffic alone can populate the address book.

Separately: explicit Accept still sends plaintext `"Accepted"` via `connection-accept`. That is correct trust on the acceptor; the bug is promoting trust **without** Accept from invite/QnA residue.

## Related specs

- `contact-request-no-handshake-investigation-2026-08.md` — address-book-only must not trust (Option B landed).
- `historical-contacts-as-strangers-investigation-2026-11.md` — message residue recovery (over-broad; conflicts with invite DM).

## Non-goals

Soft L3 · Tor · Continuity · changing Accept plaintext branding in this slice (optional follow-up).
