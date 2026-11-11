# Design — Unblock must not resurrect TRUSTED (2026-11-08)

```text
Investigation: specs/backend/block-unblock-trust-resurrect-investigation-2026-11-08.md
Parent: specs/backend/2026-11-07-block-lifecycle-design.md
PAUSED: Soft L3 Fixed · Tor · Matrix · packaged Pass
```

## Goal

After **Block** then **Unblock**, actor stays **STRANGER** until explicit Connect/Accept. Matches Soft L3 L2 Pass and lifecycle charter (“Unblock does not auto-accept”).

## Invariant

```text
Block(A→B):
  addBlocked(B) ∧ unacceptPeer(B)  // B ∈ removedPeers ∧ B ∉ acceptedPeers
Unblock(A→B):
  removeBlocked(B) only
  // must NOT acceptPeer(B)
  // must NOT clear B from removedPeers
  // may re-assert unacceptPeer(B) for sticky (idempotent)
Peer wire connection-unblock:
  evidence reset only (already) — no acceptPeer
Lift B from removedPeers:
  acceptPeer / Connect Accept only
```

## Root class (from public Partial)

Public Default Stable soak: Unblock click briefly STRANGER → ~2s TRUSTED + `acceptedPeers` contains peer again. Soft L3 same-day soak kept STRANGER.

Likely: delayed hydrate / residual handshake evidence / projection lag writing accept after `removeBlocked`, while `removedPeers` sticky was weak or raced. Lab seed precondition may amplify residue (H3) — proof requires **organic** re-soak.

## Implement slice (smallest)

1. **Actor Unblock** (`network-profile-view` `handleToggleBlock`): after `removeBlocked`, call `peerTrust.unacceptPeer({ peer })` again (idempotent sticky) + inbox remove.
2. **Read mask** (`use-peer-trust` `acceptedPeersForRead`): always exclude `removedPeers`.
3. **Wire accept vs mask (H5):** `applyIncomingContactLifecycle` `connection-accept` must **not** call `acceptPeer` when peer ∈ `removedPeers` (stale public-relay accept must not lift Block/Remove). Local Connect Accept via `requestTransport` still calls `acceptPeer` directly and lifts the mask.
4. **L1**: unaccept sticky + wire accept ignored while removed + local acceptPeer restores.
5. **L2**: public Default Stable dual CDP → Block → Unblock → STRANGER at t+5s (`removedPeers` sticky).

## Non-goals

- Soft L3 Fixed · Tor · kick/expel · packaged NSIS
- Changing peer-side `connection-unblock` (already no auto-accept)

## Claim language

| Phrase | When |
|--------|------|
| Unblock sticky **designed** | This doc |
| Unblock sticky **L1 Pass** | Named vitest |
| P1-O1 Block public **Pass** | Organic public L2 noAutoAccept Pass |

## Handoff next

```text
NEXT: implement slice → L1 → organic public Block re-soak
```
