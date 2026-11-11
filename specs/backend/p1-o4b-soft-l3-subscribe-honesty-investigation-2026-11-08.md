# Investigation — Soft L3 subscribe honesty (H6) (2026-11-08)

```text
HANDOFF ATOMIC STEP: Soft L3 subscribe honesty (activeSubs>0 when exclusive healthy)
PAUSED / CANCELLED: Soft L3 Fixed · Tor · Matrix promote · Continuity · packaged Pass
CANONICAL OWNER: use-conduit-mesh-relay-pool.getActiveSubscriptionCount ·
  createConduitMeshNostrWsClient.activeSubscriptions ·
  relay-runtime-supervisor (reads pool count)
PROOF BEFORE DONE: L1 unit (count tracks subscribe/unsubscribe) ·
  user manual Soft L3 demote soak (activeSubs>0 before Remove → peer demote)
```

## Evidence

| Observation | Source |
|-------------|--------|
| Soft L3 exclusive cancel publishes to `:7000` after H5 pin | `docs/handoffs/p1-o4b-soft-l3-exclusive-cancel-publish-2026-11-08.md` |
| Dual CDP: `phase=healthy` · `writable=1` · **`activeSubs=0`** both peers | Soft L3 cancel-demote probe / runtime snapshot |
| Live cancel often fails to demote T2; lookback REQ can still apply cancel/accept and flap trust | Same handoff · investigation P1-O4b |
| Browser pool reports real count | `relay-browser-pool-runtime.ts` → `subscriptionManager.getActiveSubscriptions().length` |
| Soft L3 uses conduit mesh pool | exclusive `local_dev_mesh` / `ws://localhost:7000` |

## Code facts

1. **`use-conduit-mesh-relay-pool.ts` hardcodes** `getActiveSubscriptionCount: () => 0` while `subscribe` delegates to `nostrClient.subscribe` (real `mesh-sub-*` map).
2. **`createConduitMeshNostrWsClient`** keeps `activeSubscriptions: Map` and re-arms REQ on socket `onopen` (`sendActiveSubscriptionsToRelay`) — F-RECV-LIVE already landed.
3. **Supervisor** takes `pool.getActiveSubscriptionCount?.() ?? 0` into transport snapshot — Soft L3 always stamps `0` regardless of live REQs.
4. **DM controller** auto-subscribes on identity + again when `relayOpenSignature` shows writable/open — expected to create ≥1 mesh-sub when Soft L3 is open.

## Hypotheses

### H6a — Metric lie (primary, confirmed in source)

Mesh pool stub zeros the count. Probe/UI "activeSubs=0 while healthy" is **not proof** that no REQ is on the wire.

**Falsify:** Wire count to `nostrClient` map size; if Soft L3 open + DM mounted shows `activeSubs≥1`, H6a confirmed as the honesty defect. Live demote may then Pass without further subscribe work.

### H6b — Real missing DM REQ (secondary)

After honest metrics, Soft L3 still shows `activeSubs=0` at Remove → DM never held a mesh-sub (or unsubscribed). Then ensure subscribe-before-mutate / resubscribe; optionally mark exclusive Soft L3 `writable && activeSubs===0` as **degraded** (handoff NEXT).

### H6c — Lookback flap (deferred)

Historical REQ reapplies cancel/accept and flaps trust. Separate design after live demote is reliable.

## Non-causes

- H5 exclusive publish pin (cancel EVENT observed on Soft L3)
- Soft L3 lab relay lacking live broadcast (script broadcasts to open subs)
- Missing F-RECV-LIVE re-arm on open (already present)

## NEXT

1. Design + L1: expose honest `getActiveSubscriptionCount` on mesh client; wire mesh pool.
2. User manual Soft L3 demote soak with rebuilt shell — assert `activeSubs>0` before Remove.
3. If still `0` or demote Fail: H6b design (ensure DM REQ + optional phase degrade).
