# Investigation — Invite Fail Slice 3 (2026-11-07)

```text
HANDOFF ATOMIC STEP: Slice 3 Join / invite Fail
Charter: specs/backend/2026-11-07-social-relationship-lifecycle-unified-design.md
PAUSED: Soft L3 · Tor · Matrix · Continuity · A4
CANONICAL OWNER: peerTrust.acceptedPeers (picker) · invite DM publish (wire, unchanged)
PROOF: L1 invite-dialog candidate regression · optional L2 invite send soak
```

## Symptom (social-core L2)

Invite to group **Fail**: Invite Connections dialog showed **No connections found**; Network Connections **0** while DM thread existed.

## Evidence re-drive

| Source | Finding |
|--------|---------|
| `social-core-flows-l2-soak-2026-11-07.md` | Fail = empty Connections / Invite picker — not accept/join wire failure |
| `social-core-trust-directory-investigation.md` | Same root: stale `removedPeers` mask → `acceptedPeersForRead` empty |
| `social-core-trust-directory-heal-l2-2026-11-07.md` | **Pass** — `acceptedPeers=1`, Connections 1, Trusted/Remove restored; Invite dialog reads same list |
| `invite-connections-dialog.tsx` | Candidates = `peerTrust.state.acceptedPeers` only (DM row optional for display name) |

## Root cause (classified)

**H3 from lifecycle charter was mis-aimed as invite wire.** Observed Fail was the **trust-directory empty picker** (same class as Remove Blocked). Invite DM publish / membership mutation owners were not exercised in that soak because no invitee could be selected.

Wire invite path remains L1-covered elsewhere (invite dialog · DM invite pipeline · membership join tests in social-core L1 101).

## Non-causes

- Soft L3 / Tor / Matrix
- Need for a new invite publish owner
- Membership mutation owner gap for this Fail row

## Residual risk

Optional L2: after Connections Pass, actually Send Invites A→B and prove accept/join surfaces. Not required to close the Fail classification.

## Next

Design: document supersede + L1 regression that invite candidates follow `acceptedPeers` (including when `createdConnections` lacks a DM row).
