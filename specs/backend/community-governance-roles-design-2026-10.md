# Design — CU-UX-4 Governance roles L1

**Date (UTC):** 2026-10-20  
**Investigation:** [community-governance-roles-investigation-2026-10.md](./community-governance-roles-investigation-2026-10.md)

---

## 1. Goals

1. Designated stewards on `managed_workspace` can promote/demote members via descriptor `stewardPubkeys`.
2. Members list shows Steward badge.
3. Never leave managed workspace with zero stewards.
4. T0 / sovereign: no promote/demote UI.

## 2. API

```ts
type StewardRoleMutationAction = "promote" | "demote";
type StewardRoleMutationReason =
  | "allowed"
  | "not_managed_workspace"
  | "not_steward"
  | "target_not_member"
  | "already_steward"
  | "not_steward_target"
  | "last_steward";

resolveStewardRoleMutation({
  communityMode, stewardPubkeys, actorPublicKeyHex,
  targetPublicKeyHex, action, activeMemberPubkeys,
}): { allowed: boolean; nextStewardPubkeys: PublicKeyHex[]; reasonCode: StewardRoleMutationReason }
```

| Rule | Result |
|------|--------|
| Mode ≠ managed_workspace | `not_managed_workspace` |
| Actor not designated steward | `not_steward` |
| Target not in active members | `target_not_member` |
| Promote + already steward | `already_steward` |
| Demote + not steward | `not_steward_target` |
| Demote + sole steward | `last_steward` |
| Else | `allowed` + next list |

Persist via existing `updateMetadata({ ...metadata, stewardPubkeys: next })` when actor has `canDirectDescriptorUpdate`.

## 3. UI

- Badge `data-testid="member-steward-badge"` when pubkey ∈ stewards.
- Menu: Make steward / Remove steward when `canManageStewards`.
- Disable demote with last-steward copy when `last_steward`.

## 4. Proof (L1)

- Unit: promote, demote, last_steward, T0 reject, non-steward actor.
- Members panel: badge present; promote invokes callback (optional light test).

## 5. Subtraction

- Do not wire legacy `promoteUser`/`demoteUser` stubs.
- Do not add role vote proposals.
