# Design — Invite Fail Slice 3 (2026-11-07)

```text
Charter: specs/backend/2026-11-07-social-relationship-lifecycle-unified-design.md Slice 3
Investigation: specs/backend/2026-11-07-invite-fail-slice3-investigation.md
PAUSED: Soft L3 · Tor · Matrix · Continuity · A4
```

## Verdict

Social-core **Invite Fail** is **classified / superseded** by trust-directory heal (L2 Pass). Slice 3 does **not** add a parallel invite path.

## Behavior (harden only)

| Surface | Rule |
|---------|------|
| Invite Connections candidates | Derived from `peerTrust.state.acceptedPeers` (read authority already healed) |
| Missing DM row | Still list peer (display name falls back) — invite must not require `createdConnections` |
| Empty list | Honest empty copy — connections required before invite |

## Owners (unchanged)

| Concern | Owner |
|---------|-------|
| Who can be invited | `usePeerTrust` / `acceptedPeersForRead` |
| Send invite DM | existing `GroupService.distributeRoomKey` + `commitOutgoingCommunityInviteDm` |
| Accept / join ledger | `community-membership-mutation-owner` |

## Files

- `resolve-invite-connection-candidates.ts` — pure list helper
- `invite-connections-dialog.tsx` — use helper
- L1 tests for acceptedPeers → rows · empty → empty
- Specs + handoff

## Explicit non-goals

- New invite publish owner
- Claiming invite Fixed without optional send/accept L2
- Soft L3 / Tor / Matrix

## Proof

| Layer | Claim |
|-------|-------|
| L1 | Candidate helper + dialog regression Pass |
| L2 | Optional A invite → B accept (not required to close Fail classification) |
| Fixed | Only after optional L2 send/accept |
