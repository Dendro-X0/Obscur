# Investigation — Soft L3 `0/1` on `ws://localhost:7000` (2026-11-08)

**Status:** Root cause identified · hung-CONNECTING helper L1 Pass · **runtime wiring REVERTED** (unlock React #185) · leave L2 still Blocked  
**Handoff:** `docs/handoffs/current-session.md` NEXT — pool ≥1 on localhost:7000, then leave L2  
**Evidence:** `docs/handoffs/leave-peer-visibility-l2-soak-2026-11-08.md` · CDP Sign-in crash logs

## Claim bounds

- May say: Docker `:7000` reachable; browser `WebSocket` probe Pass; Soft L3 list can enable local; app pool stayed `0/1` Connecting; hung-CONNECTING age helper exists (unwired)
- Must not say: Soft L3 Fixed · leave L2 Pass · pool Fixed · quiet_dial_cap owns Soft L3 dial

## Facts

1. **Local lab uses browser WebSocket**, not NativeRelay (`create-relay-websocket.ts`).
2. Soft L3 lab-only → `resolveDmTransportRelayUrls` returns `[ws://localhost:7000]`.
3. Soak: list enables local · UI `0/1` / Connecting · page `WebSocket` opens · Docker Up.
4. **`shouldReuseRelaySocket` reuses `CONNECTING` forever** — hung first dial traps Soft L3 after Docker comes up.

## Attempted fix (reverted from dial path)

Wired hung-CONNECTING redial + local `resetMetrics` into `connectToRelay` / `setRelayUrls` / `attemptReconnect`.

**Result:** keychain hydrate / Tester1 Sign-in hit **React #185 (Maximum update depth)** within ~4s. `relay.transport_engine_pool_subscribe` stampeded. Runtime wiring removed; unlock restored as priority.

## Landed (safe)

- Investigation spec (this file)
- Pure helper: `shouldReuseRelaySocket(..., { connectingStartedAtUnixMs, hungConnectingMs })` + `LOCAL_HUNG_CONNECTING_MS` / `HUNG_CONNECTING_MS`
- L1: reliability test for hung budget (15 Pass)
- **Not wired** into dial/reconnect — requires a design that cannot notify React during `setRelayUrls`

## Next atomic (pool heal)

1. Design Soft L3 hung redial that schedules async (macrotask) close+redial **outside** health-monitor notify / setRelayUrls stack.
2. L1 + unlock soak (Sign-in must not Oops).
3. Soft L3 Apply Local Dev Mesh → `1/1` / open localhost.
4. Leave L2 dual CDP.

## Out of scope

- Soft L3 Fixed claim · Tor Verified · Matrix · mergePublicBoot prod-first change (secondary Soft L3 storage issue)
