# Investigation: Community wait-ring orbit + delete hang (2026-08)

**Status:** Active  
**Surface:** Create Group overlay · Delete/Leave Community (`/groups/leave`)  
**Date:** 2026-08-22

## Evidence

1. **Unreadable create/leave wait UI:** `CommunityActionWaitRing` places step cards inside `.obscur-community-action-orbit`, which CSS-rotates the container 360°. Children use a *static* counter-rotate for initial placement only, so cards (and copy) spin with the orbit.
2. **Delete takes minutes:** `handleDeleteLocal` awaits `leaveManagedWorkspaceMembership` with **no** `withCommunityNetworkTimeout`. Inside that path, `publishRelayConfirmedCommunityLeave` **awaits** `refreshCoordinationMembershipDirectory({ forceFull: true })` after coordination leave — up to 64 paged fetches × 8s timeout. Sealed leave/disband then wait on relay publish. Copy already says local purge may proceed when relay proof fails; the await contradicts that.

## Not causes

- Local `forcePurgeCommunity` itself (sync ledger/sidebar) is not multi-minute.
- Orbit is not a Card `transform` on the delete form — the hang is the untimed network await while the form stays on screen.

## Contract (next: design)

- Motion: only a decorative ring may rotate; step copy stays upright.
- Delete: bound network leave, then always local purge.
