# Design — Block lifecycle Slice 1 (2026-11-07)

```text
Charter: specs/backend/2026-11-07-social-relationship-lifecycle-unified-design.md Slice 1
PAUSED: Soft L3 · Tor · Matrix · Continuity · A4
```

## Behavior

| Actor A blocks B | A | B (on wire apply) |
|------------------|---|-------------------|
| Local | `addBlocked(B)` + `unacceptPeer(B)` + inbox remove (+ optional delete DM) | — |
| Wire | `t=connection-block` best-effort | `unacceptPeer(A)` + inbox remove |
| Blocklist on B | — | **not** auto-added (being blocked ≠ blocking) |

| Actor A unblocks B | A | B |
|--------------------|---|---|
| Local | `removeBlocked(B)` | — |
| Wire | `t=connection-unblock` | no auto-accept |

## Dual blocklist (minimal subtract this slice)

- Canonical storage key: `obscur.blocklist.v1.{pubkey}` (network owner)
- Messaging `dweb.nostr.pwa.blocklist` → migrate-on-read into canonical; writes go to canonical
- `clearBlocklistStorage` clears both keys

## Files

- classifier + sandbox allowlist tags
- `requestTransport.notifyPeerBlocked` / `notifyPeerUnblocked`
- `applyIncomingContactLifecycle` (or sibling) for block/unblock
- `network-profile-view` confirmBlock / unblock
- L1: classifier + lifecycle + transport tags

## Proof

| Layer | Claim |
|-------|-------|
| L1 | Unit Pass (classifier + lifecycle + transport tags) |
| L2 | **Pass 2026-11-08** — Soft L3 dual CDP; A Block user → B demotes (no auto-block on B); A Unblock → no auto-accept ([handoff](../../docs/handoffs/block-lifecycle-l2-soak-2026-11-08.md)) |
| Fixed / packaged | Not claimed — NSIS CDP still debug-only |
