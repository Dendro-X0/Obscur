# Conduit Mesh C10 — team_relay HTTP pull/subscribe charter

**Status:** **L1 landed**  
**Last updated:** 2026-07-14  
**Parent:** [conduit-mesh-c8-mesh-http-gateway-charter.md](./conduit-mesh-c8-mesh-http-gateway-charter.md)

---

## Slice goal

Enable **receive** on `team_relay` / `custom` HTTP gateways via **GET /mesh/v1/envelopes** pull loop — mesh `subscribeInbound` + client bridge for DM-shaped ciphertext.

---

## In scope

| Deliver | Detail |
|---------|--------|
| HTTP pull helper | Poll gateway, dedupe, map pull items → `MeshEnvelope` |
| `createCustomHttpConduitDriver.subscribe` | Start/stop pull loop with interests |
| `createConduitMesh.registerInboundInterests` | Fan-in driver inbound → `subscribeInbound` handlers |
| Relay pool runtime | Wire `deliverInbound` into HTTP drivers |
| Client bridge | HTTP inbound → `subscribeToMessages` when ciphertext is Nostr wire |
| `verify:conduit-mesh-c10` | L1 gate |

## Out of scope

- Long-poll / SSE stream endpoint
- Full DM decrypt pipeline for mesh-native ciphertext (bridge Nostr wire only)
- Persistent cursor across restarts |

---

## Proof

| Layer | Command |
|-------|---------|
| L1 | `pnpm verify:conduit-mesh-c10` |
| L3 | DM via HTTP gateway only — **not claimed** |

---

## Next slice

**C11 — mesh-native DM envelope codec** for non-Nostr HTTP receive.
