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
- Claiming invite Fixed without maintainer cut (L2 send/accept already Pass 2026-11-08)
- Soft L3 / Tor / Matrix

## Proof

| Layer | Claim |
|-------|-------|
| L1 | Candidate helper + dialog regression Pass |
| L2 | **Pass 2026-11-08** — dual CDP Soft L3; Team create → Invite Connections → Tester2 Accept; coordination `activeMemberPubkeys` includes both ([handoff](../../docs/handoffs/invite-fail-slice3-l2-soak-2026-11-08.md)) |
| Fixed | Maintainer cut call only — do not auto-promote from L2 |
