# Investigation — Soft L3 Fail: local echo, no publish ACK (mesh)

**Date:** 2026-08-01  
**Charter:** v1.9.15 D1  
**Evidence:** `test-results/s-pool-delivery-l3-2026-08-01.json` (latest Soft L3 Fail)

```text
HANDOFF ATOMIC STEP: Soft L3 Fail · mesh wire publish still no OK
PAUSED / CANCELLED:    COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION
CANONICAL OWNER:       conduit-mesh nostrWire publish + dm-relay-transport
PROOF BEFORE DONE:     Soft L3 Pass + non-null lastSuccessfulPublishAtUnixMs after send
```

## Facts

1. Row A Pass with Soft L3 **lab-only** `ws://localhost:7000`.
2. Row B: `sent_visible_local`, `publishAck=false`, `openedB=false`.
3. CDP: DM sync **EOSE on localhost** works (`obscurDeliveryDiagnostics.lastSync.openRelayUrls` includes localhost).
4. After Soft L3 send, `obscurRelayRuntime.getSnapshot()` sometimes returns **null/empty** (`writable:0`, `phase:null`) — probe race / nav.
5. Playwright console capture saw **zero** `[dm-relay-transport]` / `[dm-send]` lines during send (log hygiene or path not logging).
6. Account backup publish repeatedly `result: failed` with `configuredRelayCount:4` / `openRelayCount:1`.

## Landed mitigations (not Soft L3 Pass)

- D2 P-evidence honesty (no wire-fire success)
- Local agreed-path publish fallback after S1 remote fail (L1)
- Intersect publish targets with open pool sockets
- Mesh stamp `lastSuccessfulPublishAtUnixMs` on successful `publishToUrls`
- Nostr WS socket lookup via `workspaceRelayUrlsMatch`
- Soft L3 harness: lab-only pool, Tester1 auto-unlock, send before B reunlock

## Root cause candidate (confirmed 2026-08-01)

1. Soft L3 `sendMarkerViaCompose` used `page.keyboard.press("Enter")` after `fill()` → often no React `onKeyDown` → false `sent_visible_local` (marker still in textarea).
2. Ghost Protocol FAB intercepts Send button clicks.
3. **First-DM send ceremony** (`SendCeremonyDialog`) awaits confirm before `sendDm` — Soft L3 never confirmed → `marker_stuck_in_compose` with zero dm-send events.

## Fix (harness)

- `pressSequentially` + locator `press("Enter")`; hide Ghost overlay; force-click Send fallback.
- Seed `obscur.send_ceremony.v1::<peer>::default` + click `Send to this identity` if dialog opens.
- Fail Row B immediately when send not honest (`marker_stuck_in_compose` / `send_ceremony_blocking`).

## Follow-on root cause (2026-08-01)

Honest send landed; publish still failed with `publishRelayCount: 1` / `successCount: 0` on open localhost.

**OK race:** `conduit-mesh-nostr-ws-client.publish` registered the OK waiter *after* `socket.send`. Fast local ACKs were dropped → `ok_timeout`. Fix: wait-before-send. Spec: [dm-nostr-ws-ok-race-investigation-2026-08.md](./dm-nostr-ws-ok-race-investigation-2026-08.md).

## Next proof slice

1. Soft L3 re-run (need app HMR/reload of transport-kernel).
2. Prefer Tester2 Tauri profile CDP `:9231` if Edge reunlock still flakes.
3. EXIT / tag only after Soft L3 Pass.
