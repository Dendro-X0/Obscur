# Design — Leave peer visibility Slice 2 (2026-11-07)

```text
Charter: specs/backend/2026-11-07-social-relationship-lifecycle-unified-design.md Slice 2
Investigation: specs/backend/2026-11-07-leave-peer-visibility-investigation.md
PAUSED: Soft L3 · Tor · Matrix · Continuity · A4
```

## Behavior

| Event | Peer (remaining member) |
|-------|-------------------------|
| Gossip removes include peer P | `markMembersLeft(P)` → terminal `leftMemberPubkeys` sticky + shrink `memberPubkeys` |
| Gossip removes include self | existing `applyLocalLeaveFromRelay` (unchanged) |
| Coordination `leave` delta for P | directory materialization (existing) **and** mirror P into terminal membership cache |
| Actor leave UI | existing leave outbox + deselect L1 (no change) |

Contract alignment (lifecycle charter):

```text
Wire leave evidence → Peer sticky apply (terminal left) → UI reads terminal ∪ directory
Hydrate must not resurrect active roster for terminal-left peers
```

## Owners

| Concern | Owner |
|---------|-------|
| Gossip decode → roster mutations | `applyCommunityMembershipIngress` |
| Terminal left sticky write | `persistTerminalPeerLeftEvidence` (same cache as invite MEM-005) |
| Bus → apply binder | thin binder called from `LegacyGroupProvider` |
| Coordination directory | existing materializer; add terminal mirror on leave deltas |
| Ledger / leave publish | unchanged (`community-membership-mutation-owner` · leave outbox) |

## Explicit non-goals

- New relay publish path
- Claiming leave Fixed without L2 dual CDP
- Soft L3 / Tor / Matrix
- Replacing REL-005 membership write owner

## Files

- `apply-community-membership-ingress.ts` (+ tests) — `markMembersLeft`
- `community-invite-terminal-membership.ts` — `persistTerminalPeerLeftEvidence`
- `bind-community-membership-ingress-apply.ts` — subscribe + apply wiring helpers
- `group-provider-legacy.tsx` — mount binder
- `community-coordination-membership-directory-store.ts` — mirror leave → terminal cache when group/relay known
- Handoff next atomic → Slice 3 invite Fail

## Proof

| Layer | Command / claim |
|-------|-----------------|
| L1 | vitest apply-ingress mark-left · terminal peer left · binder unit |
| L2 | optional dual CDP A leave → B roster excludes A (not required to land) |
| Fixed | only after L2 Pass per charter |
