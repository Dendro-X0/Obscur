# Investigation — Leave peer visibility Slice 2 (2026-11-07)

```text
HANDOFF ATOMIC STEP: Leave peer visibility (Slice 2)
Charter: specs/backend/2026-11-07-social-relationship-lifecycle-unified-design.md
PAUSED: Soft L3 · Tor · Matrix · Continuity · A4
CANONICAL OWNER: applyCommunityMembershipIngress · community-terminal-membership-cache
PROOF: L1 unit · L2 dual CDP optional (not required to land slice)
```

## Symptoms

| Surface | Observation |
|---------|-------------|
| Actor leave | Publish Pass · selection residue healed L1 (`clearSelectedIfLeavingGroup`) |
| Peer roster | Social-core L2 leave Partial — remaining member can still see leaver / lag |
| Gossip ingress | Bridge publishes `community-membership-ingress`; apply helper never shrinks peer roster |

## Evidence (code)

1. `applyCommunityMembershipIngress` only `widenRoster` on adds; removes apply **local** leave only when local pubkey is in `removes`. No `markMembersLeft` / shrink for peer pubkeys.
2. `subscribeCommunityMembershipIngress` exists; **no production caller** wires it to `applyCommunityMembershipIngress` (bridge comment expects GroupProvider).
3. Coordination leave path **does** fold `action: "leave"` into directory `leftMemberPubkeys` (`applyCoordinationMembershipDeltasToMaterialization`).
4. Group home merges terminal cache + sealed `leftMembers` + coordination directory for exclusions — but coordination leave **does not** write terminal membership cache, so sticky survive-hydrate depends on directory remaining warm.
5. Sealed community hook is a visual stub; `groupState.leftMembers` stays empty unless another owner fills it.

## Root cause (working)

Peer leave visibility is incomplete on the gossip apply boundary (**widen-only**) and the ingress bus is **unpublished to UI mutations**. Coordination materialization can hide a leaver while directory is live, but peer apply is not sticky the way contact-remove / invite-terminal left evidence is — hydrate or empty sealed state can resurrect roster rows.

## Non-causes

- Soft L3 / Tor / Matrix
- Need for a new relay publish owner (leave outbox + coordination publish already exist)
- Actor deselect residue (already L1)

## Hypotheses ranked

| ID | Claim | Status |
|----|-------|--------|
| H1 | Gossip ingress never marks peer left / shrinks roster | **Confirmed** |
| H2 | Ingress subscribe→apply not wired in GroupProvider | **Confirmed** |
| H3 | Coordination leave not mirrored into terminal cache → hydrate resurrect | **Likely** |
| H4 | Leave publish failed on peer path | Unlikely when actor publish Pass |

## Next

Design Slice 2: markMembersLeft + terminal sticky on gossip removes; wire ingress binder; mirror coordination leave into terminal cache; L1 tests. No new publish owner.
