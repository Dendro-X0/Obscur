# Conduit Mesh C2 — headless runtime charter

**Status:** **Active**  
**Last updated:** 2026-06-26  
**Parent:** [obscur-conduit-mesh-concept-2026-06.md](./obscur-conduit-mesh-concept-2026-06.md) · [conduit-mesh-c1-contracts-charter.md](./conduit-mesh-c1-contracts-charter.md)  
**Package:** `@obscur/conduit-mesh`

---

## Slice goal

Headless **MeshPort** runtime with in-memory evidence ledger, mock `team_relay` + `custom` drivers, and **lane promotion** on publish failure. **No Nostr**, no UI, no SQLite.

---

## In scope

| Deliver | Detail |
|---------|--------|
| `createConduitMesh` | Implements `MeshPort` |
| Evidence ledger | In-memory append + subscriber fanout |
| `buildMeshSnapshot` | Single snapshot owner from conduit runtime state |
| `createMockConduitDriver` | Test/production injection surface for C3+ |
| Lane switch | Primary conduit fail → try next candidate by priority |

## Out of scope

- Real HTTP/WebSocket I/O
- Tor injection
- Nostr dialect
- React / Tauri
- `verify:engine-lab` wiring (C2 has dedicated gate)

---

## Proof

| Layer | Command |
|-------|---------|
| L1 | `pnpm verify:conduit-mesh-c2` |
| L2 | `pnpm verify:conduit-mesh-c1` (contracts unchanged) |

---

## Next slice

**C3** — Tor policy + native probe integration spec (design); optional mock Tor gate in headless runtime.
