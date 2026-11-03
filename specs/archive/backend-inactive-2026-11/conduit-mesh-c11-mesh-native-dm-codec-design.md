# Design — C11 mesh-native DM wire codec

**Date:** 2026-07-15  
**Charter:** [conduit-mesh-c11-mesh-native-dm-codec-charter.md](../../docs/program/conduit-mesh-c11-mesh-native-dm-codec-charter.md)  
**Status:** Approved for L1 implementation

---

## Wire contract (`obscur_mesh_dm_wire_v1`)

UTF-8 JSON object stored in `MeshEnvelope.ciphertext` (before gateway base64):

```json
{
  "contractVersion": "obscur_mesh_dm_wire_v1",
  "event": {
    "id": "<hex>",
    "pubkey": "<hex>",
    "created_at": 1234567890,
    "kind": 4,
    "tags": [["p", "<recipient>"]],
    "content": "<nip04 ciphertext>",
    "sig": "<hex>"
  }
}
```

| Field | Rule |
|-------|------|
| `contractVersion` | Must equal `obscur_mesh_dm_wire_v1` |
| `event` | Full signed Nostr kind-4 object (same shape DM pipeline already produces) |
| No `["EVENT", …]` wrapper | Distinguishes mesh-native from NIP-01 wire passthrough |

---

## API surface (`@obscur/conduit-mesh-contracts`)

| Export | Purpose |
|--------|---------|
| `OBSCUR_MESH_DM_WIRE_V1` | Version constant |
| `MeshNativeDmWireBody` | TypeScript type |
| `isMeshNativeDmWirePayload(payload: string)` | Detect native wire in decoded ciphertext string |
| `encodeMeshNativeDmWire(event: NostrEvent)` | Serialize native wire |
| `decodeMeshNativeDmWire(payload: string)` | Parse + validate; throw/Result on failure |
| `nostrEventWireToMeshNativeDmWire(nostrWire: string)` | Extract event from `["EVENT", e]` → native wire |
| `meshNativeDmWireToNostrEventWire(nativeWire: string)` | Native → `["EVENT", e]` for existing bridge |

---

## Runtime changes (`conduit-mesh-relay-pool-runtime.ts`)

### Publish (`publishViaMeshEnvelope`)

When building envelope from string payload:

1. If `isNostrEventWirePayload(payload)` → rewrite to mesh-native via `nostrEventWireToMeshNativeDmWire` before `TextEncoder.encode`.
2. If already mesh-native → store as-is.
3. Opaque non-DM payloads unchanged (presence / pool broadcast).

WS passthrough path unchanged.

### Inbound (`subscribeInbound` → `bridgeInboundWire`)

After `TextDecoder.decode(envelope.ciphertext)`:

1. If `isMeshNativeDmWirePayload` → convert to Nostr wire, then bridge.
2. Else if `isNostrEventWirePayload` → bridge (legacy C10).
3. Else skip (unchanged).

---

## Backward compatibility

| Scenario | Behavior |
|----------|----------|
| Gateway stores legacy Nostr wire from pre-C11 clients | Inbound path 2 still works |
| C11 client sends to C10-only gateway | Gateway stores native JSON; any C11+ receiver decodes |
| Mixed pool HTTP + WS | HTTP native; WS still Nostr wire passthrough |

---

## Tests (L1)

| File | Cases |
|------|-------|
| `mesh-dm-wire.contract.test.ts` | Roundtrip native ↔ Nostr wire; reject invalid version |
| `conduit-mesh.c11.integration.test.ts` | HTTP publish stores native; pull + bridge delivers Nostr wire to client |
| `conduit-mesh-c11.contract.test.ts` | Charter + runtime grep anchors |

---

## Mental simulation (one send)

1. Tester1 sends DM → pipeline builds signed kind-4 → `["EVENT", …]` to pool.
2. HTTP-only pool → `publishToUrls([http://127.0.0.1:8788], nostrWire)`.
3. Runtime converts to mesh-native JSON → POST gateway.
4. Tester2 pull receives envelope → decode native → emit `["EVENT", …]` on bridge.
5. DM receive pipeline decrypts as today.

---

## Out of scope (explicit)

- Removing NIP-04 from event object (true binary mesh ciphertext)
- Changing gateway HTTP API (`CUSTOM_CONDUIT_HTTP_V1` unchanged)
- Composer / UI changes
