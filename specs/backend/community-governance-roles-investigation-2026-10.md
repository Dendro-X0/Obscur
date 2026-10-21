# Investigation — CU-UX-4 Governance roles L1

**Date (UTC):** 2026-10-20  
**Charter:** [community-dual-tier-ux-charter-2026-08.md](../../docs/program/community-dual-tier-ux-charter-2026-08.md) — T1 Roles / admin = Steward + member

---

## 1. What exists

- Create seeds creator into `stewardPubkeys` for `managed_workspace`.
- `resolveCommunityStewardPolicy` gates direct descriptor / expel for designated stewards.
- Descriptor merge preserves steward lists (`mergeDescriptorStewardPubkeys`).
- Members panel: mute + vote/expel only — no Steward badge, no promote/demote.

## 2. Gap

Steward list is write-once at create. Operators cannot add a second steward or demote without raw descriptor hacks. Charter beta bar is incomplete for T1.

## 3. Blast radius

- `community-steward-policy.ts` (+ tests)
- `group-management-dialog.tsx` (handler)
- `members-panel.tsx` (badge + menu)
- `updateMetadata` path (already accepts `GroupMetadata.stewardPubkeys`)

## 4. Non-goals

- SF-B Spaces / pagination
- T0 steward designation
- New governance vote type for role changes
- Wire `promoteUser` / `demoteUser` NIP-29 stubs (unused; use descriptor steward list)
