# Conduit Mesh C3 — Tor policy charter

**Status:** **Active**  
**Last updated:** 2026-06-26  
**Parent:** [obscur-conduit-mesh-concept-2026-06.md](./obscur-conduit-mesh-concept-2026-06.md) · [conduit-mesh-c2-runtime-charter.md](./conduit-mesh-c2-runtime-charter.md)  
**Integration spec:** [conduit-mesh-c3-tor-probe-integration.md](./conduit-mesh-c3-tor-probe-integration.md)

---

## Slice goal

Pin **Tor as conduit network policy** in headless mesh: `tor_required` fail-closed, `tor_preferred` fallback viable, snapshot reflects `torReady`. Document desktop probe mapping — **no live SOCKS I/O in this slice**.

---

## In scope

| Deliver | Detail |
|---------|--------|
| `MeshTorRuntimeState` + policy helpers | `@obscur/conduit-mesh-contracts` |
| Runtime wiring | `createConduitMesh({ getTorState })` filters + snapshot |
| Blocked conduit health | `tor_required` + Tor down → `blocked` / `tor_unreachable` |
| Integration spec | Map `get_tor_status` → `MeshTorRuntimeState` |

## Out of scope

- Real SOCKS/WebSocket over Tor
- Tauri invoke wiring (C4+ desktop host port)
- Performance benchmarks

---

## Proof

| Layer | Command |
|-------|---------|
| L1 | `pnpm verify:conduit-mesh-c3` |

---

## Next slice

**C4** — wire real `team_relay` + `coordination` adapters against `apps/coordination`.
