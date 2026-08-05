# Investigation — Nostr WS OK race (Soft L3 publish ACK)

**Date:** 2026-08-01  
**Handoff:** Soft L3 Fail · send-side publish gap  
**Owner:** `apps/pwa/app/features/transport-kernel/conduit-mesh-nostr-ws-client.ts`

## Evidence

Soft L3 after honest send (`sent_visible_local`):

```
[dm-relay-transport] publishToUrls returned failure, falling back
  { targetRelayCount: 4, publishRelayCount: 1, successCount: 0 }
[dm-send] confirmed { success: false, successCount: 0, totalRelays: 1 }
lastSuccessfulPublishAtUnixMs: null · writable: 1 · phase: degraded
```

Relay `:7000` reachable (HTTP 200). Pool reports one open/writable lab socket. Publish to that single open target still fails ACK.

## Root cause

`createConduitMeshNostrWsClient.publish`:

1. `sendToRelay(payload)` — EVENT on wire  
2. **then** `waitForOk(eventId)` — register pending resolver  

Local Docker relays often return `["OK", id, true, …]` in the same tick (or before the next microtask). The OK handler looks up `pendingOkResolvers.get(eventId)` — empty → message dropped → `waitForOk` times out → `ok_timeout` → Soft L3 `publishAck=false`.

This matches writable≥1 + null `lastSuccessfulPublishAtUnixMs` without needing a dead socket.

## Fix (design)

Register OK waiter **before** `socket.send`. Parse `eventId` first. On `relay_not_connected`, delete the pending resolver.

## Proof

| Layer | Command |
|-------|---------|
| L1 | vitest `conduit-mesh-nostr-ws-client.test.ts` (immediate OK after send) |
| L3 | `pnpm verify:s-pool-delivery-l3` — expect `publishAck` / `lastSuccessfulPublishAtUnixMs` set when lab relay healthy |
