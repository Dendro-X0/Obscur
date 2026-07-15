# Conduit Mesh C8 — private mesh HTTP gateway charter

**Status:** **L1 landed**  
**Last updated:** 2026-07-14  
**Parent:** [conduit-mesh-c7-client-integration-charter.md](./conduit-mesh-c7-client-integration-charter.md)  
**Contract:** `@obscur/conduit-mesh-contracts` `CUSTOM_CONDUIT_HTTP_V1`

---

## Slice goal

Ship a **reference operator gateway** for the `team_relay` / `custom` HTTP dialect — so users can run **their own server** (no Nostr) while Obscur keeps E2EE on the client.

Headless handler in `@obscur/conduit-mesh`; optional HTTP listener in `apps/relay-gateway`.

---

## In scope

| Deliver | Detail |
|---------|--------|
| `handleMeshHttpGatewayRequest` | Pure handler: health, publish, pull |
| `createMeshHttpGatewayStore` | In-memory envelope store (reference only) |
| `apps/relay-gateway` mesh HTTP listener | `MESH_HTTP_PORT` (default 8788) |
| `resolveRelayPoolConduitDescriptors` | `http(s)://` → `team_relay` dialect |
| Settings copy | Team HTTP gateway URL hint in Conduits panel |
| `verify:conduit-mesh-c8` | L1 gate |

## Out of scope

- Production persistence / retention SLA
- Custom driver live subscribe/pull loop in PWA
- Tor SOCKS on HTTP fetch (C9)
- Relay-gateway WS proxy changes

---

## Operator contract (v1)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/mesh/v1/health` | Liveness + contract version |
| POST | `/mesh/v1/envelopes` | Accept opaque ciphertext envelope |
| GET | `/mesh/v1/envelopes` | Pull stored envelopes (reference store) |

Plaintext never stored — only `ciphertextBase64` + routing metadata.

---

## Proof

| Layer | Command |
|-------|---------|
| L1 | `pnpm verify:conduit-mesh-c8` |
| L3 | Desktop DM via `http://127.0.0.1:8788` team gateway — **not claimed** |

---

## Next slice

**C9 — Tor host integration** — wire `get_tor_status` into mesh `getTorState` + Settings Tor readiness.
