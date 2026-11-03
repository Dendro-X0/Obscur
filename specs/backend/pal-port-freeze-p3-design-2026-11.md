# Design — P3 PAL port freeze (2026-11)

**Status:** Design + L1 freeze contract · not multi-protocol Verified  
**Parent:** [platform-rewrite-band-charter-2026-11.md](./platform-rewrite-band-charter-2026-11.md)  
**Related:** [platform-boundary-map-2026-11.md](./platform-boundary-map-2026-11.md) (K1–K2)

```text
HANDOFF ATOMIC STEP: P3 PAL port freeze
CANONICAL OWNER:     ProtocolAdaptationLayer (`protocol-adaptation/layer.ts`)
PROOF BEFORE DONE:   L1 contracts; no “multi-protocol done” claim
```

## 1. Frozen surfaces

| Surface | Owner | Use |
|---------|-------|-----|
| Platform canonical | `listConversations` · `listMessages` · `sendMessage` | New protocol-neutral shell |
| Obscur-Nostr rich | `listDm*` · `sendDm` | Existing messaging shell |
| Always-Nostr wire | `sendDmNostrOnly` | Delete / offline retry (K1) |
| Adapter leaf | `protocol-adaptation/nostr/*` · `matrix-adapter` | Layer-only imports |

Named catalog: `port-surfaces.ts` → `@obscur/protocol-nostr` port id constants.

## 2. Freeze rules (L1)

1. Features outside `protocol-adaptation/` must not import `nostr-adapter` or `matrix-adapter`.
2. Messaging send/delete/retry must call layer (`sendDm` / `sendDmNostrOnly`), not adapter leaves.
3. Auth / Profiles / Storage UI must not import adapter leaves (spot-check + contract).

## 3. Deferred (not this freeze)

- Erasing NostrEvent types from messaging internals (strangler residue).
- Matrix promotion / Olm.
- Tor Verified.

## 4. Status

- Design: **written**
- L1 freeze contract: **landed** with this cut (`platform-p3-pal-port-freeze.contract.test.ts`)
