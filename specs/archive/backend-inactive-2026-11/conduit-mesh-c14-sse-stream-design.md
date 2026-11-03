# Design — C14 SSE on mesh HTTP stream

**Date:** 2026-07-15  
**Charter:** [conduit-mesh-c14-sse-stream-charter.md](../../docs/program/conduit-mesh-c14-sse-stream-charter.md)  
**Status:** Approved for L1 implementation

---

## Wire

### Request

```
GET /mesh/v1/stream?cursor=<n>&recipientPublicKeyHex=<hex>
Accept: text/event-stream
```

`Last-Event-Id` header (optional) overrides `cursor` query when present.

### Response

```
HTTP/1.1 200
Content-Type: text/event-stream
Cache-Control: no-cache

id: 1
event: envelope
data: {"envelopeId":"...","messageScope":"dm",...}

: keepalive

id: 2
event: envelope
data: {...}
```

Each `data` line is one `CustomConduitPullItem` JSON object (not the pull envelope array).

---

## Store

Extend `MeshHttpGatewayStore` with:

```ts
subscribeAppend(listener: () => void): () => void
```

`append` notifies subscribers (same set used by `waitForList`).

SSE session loop:

1. Emit backlog items from `list({ cursor, recipient… })` as SSE events; advance cursor.
2. On notify: list again; emit new items.
3. On abort/close: stop.
4. Optional keepalive comment every 15s while idle.

---

## Client (`sseHttpMeshEnvelopes` / driver)

1. `fetch(streamUrl, { headers: { Accept: "text/event-stream", ...(cursor && Last-Event-Id) }, signal })`
2. Read body as text stream; parse SSE frames.
3. On `event: envelope`, convert item → same deliver path as pull.
4. Track last `id` as cursor for reconnect.

Preference in `subscribe`: **sse → long_poll → pull**.

---

## Gateway / test fetch

| Surface | Behavior |
|---------|----------|
| `relay-gateway` | If `Accept` contains `text/event-stream`, open SSE writer (not JSON long-poll) |
| `createMeshHttpGatewayFetch` | Same Accept branch → `ReadableStream` body |
| Sync `handleMeshHttpGatewayRequest` | Unchanged for SSE (async-only) |

---

## Tests

| Case | Expect |
|------|--------|
| Health lists `sse` | capability present |
| SSE stream emits backlog then live append | two events |
| Driver prefers SSE when advertised | no long-poll while SSE open |
| Fallback when no `sse` | long_poll path (C12) |

---

## Out of scope

- Compressing SSE
- Multiplex interests in one connection beyond recipient query filter
