# Design — C12 HTTP long-poll stream

**Date:** 2026-07-15  
**Charter:** [conduit-mesh-c12-http-stream-charter.md](../../docs/program/conduit-mesh-c12-http-stream-charter.md)  
**Status:** Approved for L1 implementation

---

## Decision (L1)

Ship **long-poll** on `GET /mesh/v1/stream` as the primary C12 receive mode.

| Choice | Why |
|--------|-----|
| Long-poll over SSE | Works with `ConduitMeshFetch`; headless tests need no EventSource polyfill |
| Same JSON body as pull | Reuse `CustomConduitPullResponse` + C10 interest / dedupe |
| Health capability advertise | `capabilities: ["pull", "long_poll"]` — driver falls back to C10 poll if missing |
| SSE | Deferred (same path + Accept header later); not in L1 |

---

## Wire contract

### Health (extended)

```json
{
  "ok": true,
  "contractVersion": "custom_conduit_http_v1",
  "capabilities": ["pull", "long_poll"],
  "operatorLabel": "...",
  "storedEnvelopeCount": 0
}
```

`capabilities` optional for pre-C12 gateways → client uses timer pull.

### Stream (long-poll)

```
GET /mesh/v1/stream?cursor=0&timeoutMs=30000&recipientPublicKeyHex=<hex>&limit=50
→ 200 CustomConduitPullResponse  (items may be empty after timeout)
```

| Param | Rule |
|-------|------|
| `cursor` | Same semantics as pull |
| `timeoutMs` | Clamp 0…60_000; default 25_000; `0` = immediate (pull-equivalent) |
| `recipientPublicKeyHex` | Same DM filter as C10 pull |
| Response | Identical to `GET /mesh/v1/envelopes`; **cursor always returned** (index after last item) so long-poll does not restart at 0 |

---

## Owners

| Concern | Module |
|---------|--------|
| Capability type | `@obscur/conduit-mesh-contracts` `CustomConduitHealthResponse` |
| Store wait + notify | `createMeshHttpGatewayStore` — `waitForList` |
| Sync routes | `handleMeshHttpGatewayRequest` (health + stream immediate / sync list) |
| Async long-poll | `handleMeshHttpGatewayStreamRequest` awaiting `store.waitForList` |
| Server wiring | `apps/relay-gateway/src/mesh-http-server.ts` |
| Client stream pull | `longPollHttpMeshEnvelopes` in `custom-http-pull.ts` |
| Subscribe mode | `createCustomHttpConduitDriver.subscribe` — probe → long-poll loop **or** C10 interval |

---

## Driver subscribe (single owner)

```text
subscribe(interests):
  abort = new AbortController()
  probe health once
  if capabilities includes "long_poll":
    loop until aborted:
      for each DM recipient (same as C10 filtered pull):
        longPoll(cursor, timeoutMs, recipient, signal)
        deliver new items via onInbound (seenEnvelopeIds)
  else:
    void runPullCycle; setInterval(runPullCycle)   // C10 unchanged
  return () => abort + clearInterval
```

No parallel poll+stream for the same subscribe.

---

## Mental simulation

1. Tester2 arms DM interest → health shows `long_poll` → driver starts long-poll GETs.
2. Tester1 publishes DM → gateway `append` wakes waiter → stream returns item before timeout.
3. Driver bridges envelope → C11 native→Nostr → `bridgeInboundWire` → DM receive.
4. Old gateway without capabilities → driver stays on 3s poll (C10).

---

## Tests (L1)

| File | Cases |
|------|-------|
| gateway handler | health capabilities; stream immediate; waitForList wakes on append |
| custom-http-pull | longPoll URL + params |
| c12 integration | long-poll subscribe delivers without waiting for poll interval; fallback poll when no capability |
| engine-lab contract | charter + path anchors |

---

## Out of scope

- SSE / EventSource
- Persistent cursor across restarts
- Changing publish or C11 wire codec
- L3 latency soak
