# Charter — Tor R4 Slice 4b (relay WS via gateway)

**Date (UTC):** 2026-08-08  
**Status:** Charter open — design before code  
**Parents:** [tor-r4-reopen-charter-2026-08.md](./tor-r4-reopen-charter-2026-08.md) (T0–T3 **Pass**) · [tor-gateway-r4-design-2026-08.md](./tor-gateway-r4-design-2026-08.md) · [tor-performance-conflicts-research-2026-08.md](./tor-performance-conflicts-research-2026-08.md)

```text
HANDOFF:              Tor R4 Slice 4b — relay WS dials leave the UI process
PAUSED / CANCELLED:   Community · AUTH-SESSION (unchanged)
CANONICAL OWNER:      apps/tor-gateway (Tor dial) · apps/desktop/src-tauri/src/relay.rs (NativeRelay) · net.rs
PROOF BEFORE DONE:    L1 unit · L2 gateway tunnel · L3 Tor ON + open sockets via Tor + UI interactive + clearnet OFF-path still works
OUT OF SCOPE:         Community · AUTH-SESSION · re-arming UI→Tor SOCKS · fake READY · in-process tor.exe
```

## Why now

| Item | State |
|------|--------|
| T0–T3 | **Pass** — gateway URL, lifecycle, Bootstrapped 100%, soak Verified |
| Slice 4a | HTTP via gateway `/v1/http/fetch` — **Implemented** |
| Gap | Preference ON still leaves **NativeRelay WS on clearnet** (`UI_PROCESS_MAY_DIAL_VIA_SOCKS=false`, `net_runtime` forced off) |
| Product ask | Optional Tor must stay functional end-to-end — WS is the DM relay path |

## Hard invariants (non-negotiable)

1. **UI process must not open SOCKS to Tor** (`socks5h://127.0.0.1:9050` or any Tor SocksPort). That is the freeze class.  
2. **Ready still means Bootstrapped 100%** — never SocksPort TCP alone.  
3. **Clearnet kill-switch:** gateway down / not bootstrap-ready → refuse Tor WS (fail closed or stay clearnet by explicit product rule — prefer fail closed when preference ON).  
4. **Do not trade clearnet stability** for Tor WS patches when preference is OFF.  
5. Cap concurrent Tor dials in the **gateway** (reuse / extend Slice 4a semaphore).

## Current owners (truth)

| Concern | Owner today |
|---------|-------------|
| `tor.exe` + bootstrap | `obscur-tor-gateway` |
| HTTP Tor dials | Gateway `POST /v1/http/fetch` |
| Relay WS | `connect_relay_internal` → clearnet `connect_async` when Tor armed flag false |
| Tor armed flag | Always `net_runtime.set(false,…)` from `start_tor` / `save_tor_settings` |
| Historical Tor WS | `net_runtime.connect_websocket` (SOCKS in UI) — **forbidden to re-enable as 4b** |

## Options (pick before impl)

| ID | Approach | Verdict |
|----|----------|---------|
| **A** | Re-arm `NativeNetworkRuntime` when `lifecycleReady` | **Reject** — proven freeze class |
| **B** | Gateway loopback **TCP tunnel**: UI opens `127.0.0.1` stream; gateway does SOCKS CONNECT to relay host:port; UI runs TLS+WS on the tunnel | **Preferred** — Tor dial stays in gateway; UI never talks to `:9050` |
| **C** | Gateway full WS proxy (frame relay over JSON/loopback WS) | Heavier; only if B blocks TLS/SNI |
| **D** | Gateway advertises local SOCKS that forwards to Tor; UI dials that SOCKS | Soft-reject — still “SOCKS in UI”; easy to regress to A |

**Decision for this charter:** pursue **B** unless investigation proves TLS-on-tunnel infeasible with `tokio-tungstenite` (then escalate to C).

## Sequence (one slice at a time)

| Step | Action | Exit |
|------|--------|------|
| **4b-0** | Design note: tunnel API shape, concurrency, fail-closed rules, proof matrix | Spec committed; no product dial change |
| **4b-1** | Gateway: loopback TCP tunnel endpoint (SOCKS CONNECT only when bootstrap ready) + L1 | **Pass** 2026-08-08 — `tunnel.rs` · `:17951` · 13 lib tests |
| **4b-2** | Desktop: `connect_relay_internal` Tor path uses tunnel (not `net_runtime` SOCKS); keep `UI_PROCESS_MAY_DIAL_VIA_SOCKS=false` | **Pass (L1)** 2026-08-08 — dial matrix + tunnel client; L2/L3 pending restart |
| **4b-3** | L3 soak: preference ON · ≥1 public relay open · shell interactive · no PostMessage storm · preference OFF still clearnet DMs | Open-socket evidence 2026-08-08 (`Tor tunnel connected` nos + primal); thrash cut landed — maintainer confirm UI + OFF clearnet before **Verified** |

## Claim language

| May say | When |
|---------|------|
| T4 charter open | This file |
| 4b Implemented | 4b-1 + 4b-2 L1/L2 |
| 4b / Tor WS **Verified** | 4b-3 only |
| Tor opt-in Verified (lifecycle) | Already true from T3 — **does not** imply WS-via-Tor |

## Immediate next atomic step

**4b-0** — write tunnel design (`tor-r4-slice-4b-tunnel-design-2026-08.md`): request/response vs raw splice, bind port, semaphore, error codes, how `relay.rs` selects clearnet vs tunnel.
