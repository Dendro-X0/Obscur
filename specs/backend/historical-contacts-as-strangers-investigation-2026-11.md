# Investigation — Months-old contacts treated as strangers (2026-11)

```text
HANDOFF ATOMIC STEP: A5 / continuity honesty after empty peerTrust
PAUSED / CANCELLED: Soft L3 · Tor · Matrix promote · Continuity promote
CANONICAL OWNER: peerTrust hydrate · stranger banner
PROOF: L1 extractAcceptedPeers recovers DM-thread peers · L2 Accept not required for residue threads
SURFACE: desktop TESTER1
```

## Symptom

After relay-disable → restore (backup empty of contacts), Tester1 sees:

- Network **All People** empty (groups still present).
- Open DM with Tester2 shows **“Message from a stranger”** / Connection pending — for a contact used for months.
- New DMs can appear in the thread while trust is missing.

## Cause

1. Local `peerTrust.acceptedPeers` was empty (sparse/empty encrypted backup; unlock does not auto-restore).
2. Hydrate deliberately recovers trust **only** from `connectionRequests.status === "accepted"` and request-flow `acceptSeen` — **not** from `createdConnections` (see contact-request-no-handshake Option B).
3. After wipe, request rows / evidence are often gone too, while **DM message residue** (or a reopened thread) remains → UI treats an established peer as a stranger.

## Non-fix (preserve)

Do **not** restore trust from `createdConnections` alone (handshake incomplete / request-only rows).

## Fix band

Recover accepted peers from **DM conversation IDs that already have persisted messages** (thread residue = prior relationship), union with existing accepted-request / evidence paths. Run the same recovery after encrypted backup apply when chat state materializes.

Operator workaround until build: tap **Accept** on the stranger banner (writes peerTrust again).
