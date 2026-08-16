# Conduit Mesh C14 — SSE on mesh HTTP stream charter

**Status:** **L1 landed**  
**Last updated:** 2026-07-15  
**Parent:** [conduit-mesh-c12-http-stream-charter.md](./conduit-mesh-c12-http-stream-charter.md)  
**Design:** [conduit-mesh-c14-sse-stream-design.md](../../specs/backend/conduit-mesh-c14-sse-stream-design.md)

---

## Slice goal

Ship **SSE** (`Accept: text/event-stream`) on `GET /mesh/v1/stream` so HTTP mesh receive can stay open instead of repeating long-poll waits. Long-poll (C12) remains the fallback when SSE is unavailable.

---

## In scope

| Deliver | Detail |
|---------|--------|
| Health | `capabilities` includes `sse` (+ existing `pull`, `long_poll`) |
| Gateway SSE | Continuous `text/event-stream` with `event: envelope` + `id: <cursor>` |
| Client | Prefer SSE over long-poll over timer pull |
| Transport | `fetch` + ReadableStream parse (works with C13 SOCKS-routed fetch) |
| `verify:conduit-mesh-c14` | L1 gate |

## Out of scope

- Browser `EventSource` only (no custom fetch / SOCKS)
- Persistent Last-Event-Id across app restarts
- L3 latency soak
- Changing C11 wire codec or C13 Tor policy

---

## Negotiation

```
GET /mesh/v1/health → capabilities: ["pull","long_poll","sse"]

Driver subscribe:
  sse advertised → SSE loop
  else long_poll → C12 loop
  else → C10 timer pull
```

---

## Proof

| Layer | Command |
|-------|---------|
| L1 | `pnpm verify:conduit-mesh-c14` |
| L3 | Not claimed |

---

## Dependencies

- C12 long-poll L1
- C13 optional (SSE uses same routed fetch)
