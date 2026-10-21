# Design: Upright wait steps + bounded community delete (2026-08)

**Pairs:** [community-wait-ring-and-delete-hang-investigation-2026-08.md](./community-wait-ring-and-delete-hang-investigation-2026-08.md)

```text
HANDOFF ATOMIC STEP: none — dogfood UX/perf
PAUSED / CANCELLED:   COM-RUN-02 · COM-RUN-01 roster parity · Tor Verified · AUTH-SESSION
CANONICAL OWNER:      CommunityActionWaitRing · publishRelayConfirmedCommunityLeave · /groups/leave
PROOF BEFORE DONE:    L1 wait-ring upright · L1 skip directory refresh on leave · L1 delete uses timeout then purge
```

## Contracts

### Wait ring

1. Step cards render as a **vertical list** (readable, balanced).
2. Only an empty dashed hub ring uses `rotate` animation.
3. `prefers-reduced-motion` / desktop-safe-ui must not rotate text.

### Delete / leave network

1. After a successful coordination leave delta, **do not await** `forceFull` directory rebuild (fire-and-forget incremental refresh, or skip).
2. `handleDeleteLocal` wraps leave in `withCommunityNetworkTimeout` (12s), then **always** `forcePurgeCommunity` (matches honesty copy).
3. Show the wait ring while purge/leave is in flight so the form is not “stuck idle.”

## Non-goals

- COM-RUN-01 roster parity, COM-RUN-02 restore, new groups/** owners.
