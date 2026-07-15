# Conduit Mesh C11 — mesh-native DM wire codec charter

**Status:** **L1 landed**  
**Last updated:** 2026-07-15  
**Parent:** [conduit-mesh-c10-http-pull-subscribe-charter.md](./conduit-mesh-c10-http-pull-subscribe-charter.md)  
**Concept:** [obscur-conduit-mesh-concept-2026-06.md](./obscur-conduit-mesh-concept-2026-06.md)

---

## Slice goal

Define and wire a **mesh-native DM wire codec** for HTTP `team_relay` / `custom` conduits so ciphertext is **not** required to be NIP-01 `["EVENT", …]` framing. The DM kernel still signs **NIP-04 kind-4 events**; C11 changes **transport framing** inside `MeshEnvelope.ciphertext` only.

C10 L3 proved HTTP-only DM using Nostr wire passthrough. C11 removes that coupling for the HTTP dialect while keeping **backward compatibility** (inbound accepts both wire shapes).

---

## Problem (C10 limitation)

| Issue | Impact |
|-------|--------|
| HTTP publish wraps `["EVENT", signedKind4]` | HTTP mesh path is Nostr-shaped despite zero `wss://` |
| Inbound bridge gates on `isNostrEventWirePayload` | Non-Nostr ciphertext dropped silently |
| Kind 31990 (`nostr_ws`) vs passthrough | Two Nostr-adjacent paths; HTTP should use native framing |

---

## In scope

| Deliver | Detail |
|---------|--------|
| `OBSCUR_MESH_DM_WIRE_V1` contract | JSON wire (`contractVersion: obscur_mesh_dm_wire_v1`): `{ contractVersion, event }` where `event` is the signed kind-4 object |
| Encode / decode helpers | `encodeMeshNativeDmWire` · `decodeMeshNativeDmWire` · `isMeshNativeDmWirePayload` |
| Nostr wire adapter | `meshNativeDmWireToNostrEventWire` · `nostrEventWireToMeshNativeDmWire` (roundtrip for existing DM pipeline) |
| HTTP publish partition | `publishViaMeshEnvelope` stores mesh-native wire for HTTP dialects (not Nostr array) |
| HTTP inbound bridge | Accept mesh-native **or** legacy Nostr wire; always call `bridgeInboundWire` with Nostr wire |
| `verify:conduit-mesh-c11` | L1 gate (contracts + integration + engine-lab contract) |

## Out of scope

- Replacing NIP-04 signing / DM decrypt (event object unchanged)
- Binary/non-JSON codec (future extension)
- WS `nostr_ws` dialect behavior (still NIP-01 / kind 31990 paths)
- C12 stream transport
- C13 Tor SOCKS
- L3 HTTP-only soak re-run (optional follow-on; C10 runbook still valid with legacy wire)

---

## Architecture

```text
Send (HTTP team_relay):
  DM pipeline → ["EVENT", signedKind4]  (unchanged)
       ↓ publishToUrls (HTTP targets)
  runtime: nostrEventWireToMeshNativeDmWire
       ↓
  MeshEnvelope.ciphertext = mesh-native JSON
       ↓ POST /mesh/v1/envelopes

Receive (HTTP pull):
  GET /mesh/v1/envelopes → MeshEnvelope
       ↓
  if mesh-native → meshNativeDmWireToNostrEventWire
  elif Nostr wire → passthrough
       ↓ bridgeInboundWire → DM subscribe path (unchanged)
```

Single owner for framing: `@obscur/conduit-mesh-contracts` · runtime only partitions encode/decode at HTTP boundary.

---

## Proof

| Layer | Command / evidence |
|-------|-------------------|
| L1 | `pnpm verify:conduit-mesh-c11` |
| L3 | Re-run C10 runbook with native wire observable in gateway POST body — **not claimed in C11 L1** |

---

## Dependencies

- **C10 L1 + L3** landed (HTTP pull + bridge exist)
- **C7** Nostr EVENT passthrough on WS unchanged

---

## Next slice after C11

**C12 — HTTP long-poll / SSE** ([charter](./conduit-mesh-c12-http-stream-charter.md)) — same pull items, faster receive.
