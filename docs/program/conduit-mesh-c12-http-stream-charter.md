# Conduit Mesh C12 — HTTP long-poll / SSE stream charter

**Status:** **L1 landed** — long-poll on `/mesh/v1/stream`  
**Last updated:** 2026-07-15  
**Parent:** [conduit-mesh-c10-http-pull-subscribe-charter.md](./conduit-mesh-c10-http-pull-subscribe-charter.md)  
**Design:** [conduit-mesh-c12-http-stream-design.md](../../specs/backend/conduit-mesh-c12-http-stream-design.md)  
**Contract hook:** `CUSTOM_CONDUIT_HTTP_PATHS.stream` → `/mesh/v1/stream`  

---

## Slice goal

Replace or complement the C10 **timer poll** (`GET /mesh/v1/envelopes` every 3s) with a **push-ish receive path** on the mesh HTTP gateway — long-poll or SSE — without changing ciphertext or evidence semantics.

---

## Problem (C10 limitation)

| Issue | Impact |
|-------|--------|
| Fixed 3s poll interval | Up to 3s+ DM receive latency |
| Poll when idle | Wasted requests on quiet threads |
| Battery / metered networks | Periodic wake on mobile (future) |

C10 L1 is correct; C12 optimizes **timeliness and efficiency** of the same inbound fan-in.

---

## In scope

| Deliver | Detail |
|---------|--------|
| Contract v1 extension | `GET /mesh/v1/stream` — SSE (`text/event-stream`) **or** long-poll JSON (single response after timeout or first item) |
| Gateway handler | `handleMeshHttpGatewayRequest` + `relay-gateway` server support for stream route |
| Driver subscribe mode | `createCustomHttpConduitDriver`: prefer stream when probe advertises capability; fall back to C10 poll |
| Interest filtering | Same `MeshInterest` matching as C10 pull |
| Dedupe + cursor | Reuse C10 `seenEnvelopeIds`; optional `Last-Event-Id` / cursor header for SSE resume |
| `verify:conduit-mesh-c12` | L1 gate (headless stream + inbound bridge) |

## Out of scope

- WebSocket upgrade on HTTP gateway (separate dialect if ever needed)
- Full DM decrypt for mesh-native ciphertext (C11)
- Tor SOCKS routing (C13)
- Persistent cursor across app restarts (backlog) |

---

## API sketch (draft — finalize in design spec)

### Option A — SSE (preferred for desktop)

```
GET /mesh/v1/stream?interests=<base64-json>
Accept: text/event-stream
Last-Event-Id: <cursor>

→ event: envelope
  data: {"contractVersion":"custom_conduit_http_v1","envelopeId":"...","...}
```

### Option B — long-poll

```
GET /mesh/v1/stream?cursor=0&timeoutMs=30000
→ 200 { items: [...], cursor }  (empty items after timeout)
```

**Negotiation:** health response advertises `capabilities: ["pull", "sse"]` or `["pull", "long_poll"]`.

---

## Architecture

```text
C10 (today):
  driver.subscribe → setInterval → GET /mesh/v1/envelopes → onInbound

C12:
  driver.subscribe → EventSource or long-poll loop → GET /mesh/v1/stream → onInbound
                     ↘ fallback to C10 poll if stream unavailable
```

Single owner: `createCustomHttpConduitDriver.subscribe` — no parallel client poll path.

---

## Proof

| Layer | Command / evidence |
|-------|-------------------|
| L1 | `pnpm verify:conduit-mesh-c12` |
| L3 | C10 L3 runbook repeated with stream enabled; receive &lt; 5s p95 — **not claimed** |

---

## Dependencies

- **C10 L1** landed (inbound fan-in exists)
- **C11** optional — stream carries same pull items; Nostr wire bridge unchanged

---

## Next slice after C12

**C13 — Tor SOCKS on HTTP/WS drivers** (or parallel if maintainer prioritizes privacy lane)
