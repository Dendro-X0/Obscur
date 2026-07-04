# Conduit Mesh C6 — optional `nostr_ws` driver charter

**Status:** **Landed**  
**Last updated:** 2026-06-26  
**Parent:** [conduit-mesh-c5-pool-retirement-charter.md](./conduit-mesh-c5-pool-retirement-charter.md)  
**Package:** `@obscur/conduit-mesh` + `@obscur/conduit-mesh-contracts`

---

## Slice goal

Add an **optional** `nostr_ws` `ConduitDriverPort` for users who want NIP-01 wire compatibility. Headless proof uses an injectable wire port — **no live WebSocket**, **no legacy pool import**.

Mesh proof paths (C2–C5) remain valid with **zero** Nostr conduits.

---

## In scope

| Deliver | Detail |
|---------|--------|
| `NOSTR_WS_CONDUIT_WIRE_V1` | Wire contract: mesh envelope → `["EVENT", …]` + NIP-20 OK parse |
| `createNostrWsConduitDriver` | Publish + probe via injectable `NostrWsWirePort` |
| `createInMemoryNostrWsWire` | Headless relay simulator (OK / reject) |
| `createConduitDriverFromDescriptor` | `nostr_ws` dialect branch |
| Integration + contract tests | Lane switch with `nostr_ws` fallback |

## Out of scope

- Live `WebSocket` in browser/desktop
- Wiring `enhanced-relay-pool-legacy` sockets into mesh
- Changing default `urlsToConduitDescriptors` mapping (`wss://` stays `team_relay` until explicit descriptor)
- REQ/subscribe parity

---

## Proof

| Layer | Command |
|-------|---------|
| L1 | `pnpm verify:conduit-mesh-c6` |

---

## Next slice

**Maintainer band** — W53 smoke with optional `NEXT_PUBLIC_OBSCUR_CONDUIT_MESH_POOL=1`; mesh program C0–C6 headless gates complete.
