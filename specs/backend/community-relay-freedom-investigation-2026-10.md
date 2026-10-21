# Investigation — CU-UX-5 Relay freedom

**Date (UTC):** 2026-10-21

## Gap

Charter already says Managed create on public defaults should be revised; code still hard-blocks:

- `resolveManagedWorkspaceRelayGate` → `relay_tier_insufficient` on `public_default`
- `assessWorkspaceCommunityTrust` → `public_relay_blocked`
- `resolveCommunityCreateRelayOptions` → public not selectable for managed

T0 already allows public + private. User ask: both interest and team may use trusted public **or** private, with honesty.

## Non-goals this slice

Team room switching / Spaces (SF-B). Steward L3 UI finish.
