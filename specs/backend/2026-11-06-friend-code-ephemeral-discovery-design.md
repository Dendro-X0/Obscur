# Design — Ephemeral discovery sockets for invite lookup (2026-11-06)

```text
HANDOFF ATOMIC STEP: cold-run beta.6 Add Friend vanity
PAUSED: Soft L3 · Tor · Matrix · Continuity promote
CANONICAL OWNER: relay-discovery-query
PROOF: L1 unit (sendToOpen + ephemeral ingest) · L2 Exact Match after reinstall/cut
```

## Contract

When `mode === "invite"`, `queryRelayProfiles`:

1. Keeps pool path: `addTransientRelay` → `sendToOpen(REQ)` → `subscribeToMessages`.
2. **Also** opens short-lived `WebSocket`s to `GLOBAL_DISCOVERY_RELAY_URLS`, same REQ/CLOSE lifecycle.
3. Merges EVENT frames from either path into one results map; finalize closes both.

## Invariants

- Ephemeral path is invite-only (no text scrape amplification).
- No new relay product surface — same hosts already in discovery set.
- Dial-cap / Quiet product pool cannot starve Exact Match for published `#d` / `#i` aliases.

## Proof

| Layer | Gate |
|-------|------|
| L1 | `relay-discovery-query.test.ts` — sendToOpen REQ; ephemeral EVENT ingest without pool messages |
| L2 | Install build with this change; Exact Match for `OBSCUR-Z8V4YD` / `OBSCUR-RU8ZL8` |
| L3 | Operator cold-run Add Friend on public desktop face |

## Ship note

beta.6 has sendToOpen only. Ephemeral requires the next public cut (beta.7) **or** local rebuild for smoke. Operator must leave the 17:21 pre-hotfix `E:\Obscur` binary either way.
