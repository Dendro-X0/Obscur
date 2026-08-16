# Conduit Mesh C9 — Tor host integration charter

**Status:** **L1 landed**  
**Last updated:** 2026-07-14  
**Parent:** [conduit-mesh-c3-tor-probe-integration.md](./conduit-mesh-c3-tor-probe-integration.md)  
**Spec:** C3 Tor probe integration (design landed)

---

## Slice goal

Wire desktop **`get_tor_status`** into Conduit Mesh **`getTorState`** — mesh fail-closed policy uses host Tor readiness, not a parallel pool.

---

## In scope

| Deliver | Detail |
|---------|--------|
| `conduit-mesh-tor-host-port` | Map `TorStatusSnapshot` → `MeshTorRuntimeState` |
| `createConduitMeshRelayPoolRuntime` | Accept `getTorState` → `createConduitMesh` |
| `useConduitMeshRelayPool` | Host `getTorState` + `tor-status` event refresh |
| Settings Conduits panel | Tor configured / ready badges |
| Headless C9 integration test | Relay pool runtime + mock `getTorState` |
| `verify:conduit-mesh-c9` | L1 gate |

## Out of scope

- SOCKS proxy on Nostr WebSocket / HTTP fetch (driver-level routing)
- Assigning `tor_required` to user relay URLs in Settings UI
- L3 maintainer Tor soak |

---

## Proof

| Layer | Command |
|-------|---------|
| L1 | `pnpm verify:conduit-mesh-c9` |
| L3 | Enable Tor → tor_required conduit publish — **not claimed** |

---

## Next slice

**C10 — team_relay pull/subscribe loop** for HTTP gateway receive path.
