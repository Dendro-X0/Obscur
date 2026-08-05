# Investigation — mesh Nostr client `client_disposed` under React Strict Mode

**Date:** 2026-08-01  
**Handoff:** Soft L3 Fail · send-side publish gap  
**Owner:** `use-conduit-mesh-relay-pool.ts` + `conduit-mesh-nostr-ws-client.ts`

## Evidence

Soft L3 after honest send:

```json
{
  "publishUrls": ["ws://localhost:7000"],
  "successCount": 0,
  "sampleErrors": ["client_disposed"]
}
```

`writable: 1` / `openRelayCount: 1` can still appear from stale mesh/activity snapshots while the WS client is already disposed.

## Root cause

`useConduitMeshRelayPool` creates `nostrClient` / `runtime` once via `useState(() => create…)`, then on evidence-subscription effect cleanup calls `nostrClient.dispose()` + `runtime.dispose()`.

React Strict Mode (dev) runs mount → cleanup → mount. Cleanup permanently sets `disposed = true` on the **same** useState instance. Remount reuses the dead client → every `publish` returns `client_disposed`.

OK-race fix alone cannot recover once disposed.

## Fix

Do not dispose useState-owned mesh client/runtime in that effect cleanup. Unsubscribe evidence/tor only. Keep explicit `pool.dispose()` for intentional teardown. Optional: delayed-dispose with remount cancel if true unmount leak matters later.

## Proof

| Layer | Command |
|-------|---------|
| L1 | document in investigation; optional hook test if present |
| L3 | `pnpm verify:s-pool-delivery-l3` after full page reload of Tester1 — expect sampleErrors ≠ `client_disposed`, `publishAck` when lab healthy |
