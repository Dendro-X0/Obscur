# Investigation — C10 L3 blocked: DM scope + mesh CORS

**Date:** 2026-07-14 (updated 2026-07-15)  
**Handoff:** CONDUIT-MESH-C10 — L3 HTTP-only soak  
**Status:** Fixes landed · **awaiting Row B L3 re-soak sign-off**

## Evidence (desktop CDP, Tester1)

1. Settings HTTP-only list achieved: single enabled `http://127.0.0.1:8788` dialect `team_relay` (Conduit panel).
2. Settings partition shows **DM transport: 0 enabled · Workspace candidates: 1 enabled**.
3. Console after add: CORS error on `GET http://127.0.0.1:8788/mesh/v1/health` from origin `http://127.0.0.1:1430`.
4. Gateway `GET /mesh/v1/envelopes` via curl returns `{"items":[]}` (process healthy).

## Root causes

| # | Owner | Mechanism |
|---|-------|-----------|
| 1 | `relay-transport-scope.resolveDmTransportRelayUrls` | Loopback `http(s)://` is `community_candidate` via `isPrivateOrIntranetRelayUrl`; pool wiring uses **only** DM URLs (`relay-provider` `enabledRelayUrls = dmTransportRelayUrls`). Existing promotion covers `ws://localhost:7000` only. |
| 2 | `apps/relay-gateway` `mesh-http-server.ts` | No `Access-Control-*` headers; WebView origin ≠ gateway → browser `fetch` fails. |

## Design (smallest)

1. Export `isLocalMeshHttpGatewayUrl` (loopback `http:` / `https:` only).
2. In `resolveDmTransportRelayUrls`, append enabled mesh HTTP URLs; if DM list empty, return mesh HTTP alone (HTTP-only soak).
3. On mesh HTTP server: respond to `OPTIONS` with CORS allow; add `Access-Control-Allow-Origin: *` (local gateway) + methods/headers needed for pull/publish on all responses.

## Proof

- L1: unit tests in `relay-transport-scope.test.ts`; gateway smoke via curl + OPTIONS.
- L3: continue Row A/B runbook after rebuild + Tester1/Tester2 dual window.

## Follow-on finding (L3 send) — 2026-07-14

After DM-scope + CORS: Row A HTTP-only pool on both windows; send shows
`No writable relays are connected` / `successCount: 0` while curl POST to `/mesh/v1/envelopes` accepts.

**Cause:** `useConduitMeshRelayPool` overwrites `getTransportActivitySnapshot().writableRelayCount`
with WebSocket `connection.status === "open"` counts only. HTTP `team_relay` never opens a socket →
writable always 0 → DM send gate blocks despite mesh runtime being healthy.

**Fix:** Treat configured `http(s)://` pool URLs as writable/connected alongside open WS sockets;
prefer mesh `activitySnapshot` counts instead of WS-only overwrite.

## Follow-on finding (L3 send) — 2026-07-15

Row A PASS (HTTP-only `team_relay` on both windows). Row B FAIL: toast
`Delivery could not be confirmed`, Tester2 never receives, `GET /mesh/v1/envelopes`
stays `{"items":[]}`. Composer shows `0/0 relays active` (WS-only openCount).

**Cause:** `createConduitMeshRelayPoolRuntime.publishToUrls` routes **all**
`isNostrEventWirePayload` through `nostrWire.publish` (WebSocket). HTTP
`team_relay` / `custom` never POST to `/mesh/v1/envelopes`. C7 opaque HTTP
publish works; C10 DM Nostr EVENT publish does not.

**Fix:** Partition publish targets by dialect — WS → passthrough wire; HTTP
mesh dialects → `publishViaMeshEnvelope` wrapping the Nostr EVENT ciphertext.
Extract DM recipient from Nostr `#p` tag for mesh envelope audience (pull filter match).

**L1 proof:** `conduit-mesh.c10.integration.test.ts` — `publishes Nostr EVENT wire to HTTP team_relay via mesh envelope`.

## Follow-on finding (L3 re-soak) — 2026-07-15 (post publish-partition)

**Row A:** PASS again (Tester1 + Tester2 HTTP-only `http://127.0.0.1:8788` `team_relay` after Disable all → Add → Remove disabled).

**Row B:** FAIL (`C10-L3-soak-20260715C`).

| Check | Result |
|-------|--------|
| Tester1 local thread | Message appears “Just now” |
| Composer footer | `0/0 relays active` (WS openCount) while title bar `Connected 1/1` |
| Delivery toast | Not observed (`Delivery could not be confirmed` assert false) |
| Tester2 | `C10-L3-soak-20260715C` **not visible** ≤45s |
| Gateway | Presence flood (`mesh-pool-broadcast`, Tester2 pubkey) present; **0** envelopes with real `#p` recipient; newest `createdAtUnixMs` still **before** DM send |
| Sessions | Tester1 `csess-c0bec87f564a` · Tester2 `csess-232d16612a48` |

**Hypothesis (not yet proved):** DM hybrid targeting still prefers peer NIP-65 / “Their relay: nos.lol” and public fallbacks. Publish may hit WS targets that are outside the HTTP-only configured pool, so `publishViaMeshEnvelope` never runs for the DM EVENT (presence can still POST via mesh for opaque / configured-path events). Composer `openCount` remains WS-only and does not reflect HTTP writable readiness.

**Next (no code until design):** Confirm publish target URL list at send time (digest / console `publishToUrls` args). If targets omit `http://127.0.0.1:8788` or only list `wss://*`, design a subtraction/union rule so **configured mesh HTTP pool URLs are always included** when HTTP-only pool is active — before another client patch.

## Follow-on finding (target selection proved) — 2026-07-15

**Proof (CDP Tester1 `:9230`, synthetic send):**

| Signal | Value |
|--------|--------|
| `localStorage` enabled relays | `wss://relay.damus.io`, `wss://nos.lol`, `wss://relay.primal.net`, `ws://localhost:7000`, malformed `wss://http//127.0.0.1:8788` |
| `http://127.0.0.1:8788` | **disabled** in storage (account-sync / ops drift vs Row A UI) |
| Peer inbound evidence | `wss://nos.lol`, `wss://relay.primal.net`, `wss://relay.damus.io` |
| `[dm-send] confirmed` | `successCount: 1`, `totalRelays: 4` — hybrid targets are WS-only |
| Mesh gateway `fetch` during send | **0** POSTs to `:8788/mesh/v1/envelopes` |

**Cause:** `resolveTargetRelayUrls` unions peer NIP-65 / inbound evidence (`nos.lol`, etc.) with sender paths. Those URLs are **outside** the user's configured HTTP-only pool but still become `publishToUrls` targets → Nostr WS passthrough, never `publishViaMeshEnvelope`.

**Design (blocker 9):** When `configuredSenderRelayUrls` is HTTP-only mesh (`isHttpOnlyMeshTransportPool`), return **only** configured pool URLs — do not union peer/public WS hints or `DM_DELIVERY_FALLBACK_RELAYS`.

**Owner:** `dm-relay-transport.resolveTargetRelayUrls` · L1: `dm-relay-transport.test.ts`.

## Follow-on finding (receive starve) — 2026-07-15

Publish path **worked** after blocker 9 (`#p` EVENT stored). Tester2 never GETed `/mesh/v1/envelopes` with interest filter because:

1. Presence `mesh-pool-broadcast` flooded the unfiltered pull page (cursor never caught DM).
2. `configureConduits` called `stopInboundInterests()` and did not re-arm — reload/HTTP-only remount killed pull forever.

**Design (blockers 10–11):** Gateway + pull honor `recipientPublicKeyHex`; `create-conduit-mesh` re-applies last inbound interests after remount; DM controller arms on HTTP writable snapshot (not WS-open only).

**L3 proof:** Markers `C10-L3-soak-20260715I` + `…I-reply` delivered dual-window ≤45s.
