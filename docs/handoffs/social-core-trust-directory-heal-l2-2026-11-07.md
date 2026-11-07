# L2 re-soak — Trust directory heal (2026-11-07)

- **Verdict:** **Pass** on repaired Fail/Blocked surfaces (Connections · Trusted/Remove). Leave residue: code + L1 audit landed; create-group UI not re-driven this pass.
- **Shell:** rebuild `shell-2026-11-07T12:35:45Z` · `pnpm dev:desktop -- --skip-build` · CDP `:9230` Tester1
- **Specs:** `specs/backend/2026-11-07-social-core-trust-directory-{investigation,design}.md`
- **Prior soak:** [`social-core-flows-l2-soak-2026-11-07.md`](./social-core-flows-l2-soak-2026-11-07.md) (Partial)

## L1

- `use-peer-trust.test.ts` + `community-leave-path-audit.test.ts` → **21 Pass**
  - acceptPeer clears stale `removedPeers` when already accepted
  - hydrate from `acceptSeen` lifts `removedPeers`
  - leave page / main-shell deselect audits

## L2 matrix (repair targets)

| # | Flow | Prior | Re-soak | Evidence |
|---|------|-------|---------|----------|
| 4 | Invite / Connections directory | **Fail** (Connections 0 · Invite empty) | **Pass** | After reload: `acceptedPeers=1`, `removedPeers=0`; Network **CONNECTIONS 1** · Tester2 **TRUSTED**. Invite dialog reads same `peerTrust.state.acceptedPeers`. |
| 6 | Remove contact UI | **Blocked** (Stranger · Connect disabled) | **Pass** | `/network/profile?pubkey=3db055…` → **Trusted Connection** · Message · **Remove** (not Stranger) |
| 5 | Leave thread residue | **Partial** | **Implemented** · L1 audit Pass | `clearSelectedIfLeavingGroup` on leave/purge · main-shell clears selected group missing from `createdGroups`. Runtime leave re-drive deferred (no live group this pass). |

## Root cause (confirmed)

Stale `removedPeers` masked projection/stored accepts after re-accept; hydrate could re-add accepted without clearing the mask; `acceptPeer` early-returned before clearing mask.

## Claim language

- May say: trust-directory heal L1 Pass · L2 Pass for Connections/Trusted/Remove on static-dev after rebuild
- Must not say: Soft L3 · all six social-core flows Pass · leave residue L2 re-proven · packaged NSIS
