# Investigation — Tor enable wedges host (Phase 3 L3 Fail)

**Date (UTC):** 2026-08-07  
**Status:** Evidence recorded · fail-closed slice **Implemented** (code) · L3 recover pending  
**Parents:** [tor-local-first-redesign-2026-08.md](./tor-local-first-redesign-2026-08.md)

```text
HANDOFF ATOMIC STEP: Tor + local-first Phase 2 → L3; Phase 3 was "do not enable Tor yet"
PAUSED / CANCELLED:   Community · AUTH-SESSION-1
CANONICAL OWNER:      tor.rs readiness · NativeNetworkRuntime arm · connect_relay Tor path
PROOF BEFORE DONE:    L1 rustc/unit · L3: enable Tor stuck bootstrap must NOT dial via SOCKS / must not ChunkLoadError
```

## Symptom (maintainer 2026-08-07)

After Settings → Tor ON:

1. UI briefly showed **BOOTSTRAP: READY** / Connected while Tor log was **Bootstrapped 5% (conn)**.
2. Later: stuck at 5% with `TIMEOUT` / `CONNECTREFUSED` to guards → **BOOTSTRAP: ERROR**.
3. NativeRelay: `Tor connect attempt [1–36] failed: Proxy server unreachable` × concurrent relays.
4. Cascade: `sign_event_native` timeout · `ERR_INSUFFICIENT_RESOURCES` · **ChunkLoadError** · AppShell crash loop.

## Root cause (code + logs)

| Bug | Evidence |
|-----|----------|
| **TCP open ≠ Tor ready** | `probe_tor_proxy` only `TcpStream::connect` to `:9050`. Socks listener opens at ~0–5%; `refresh_tor_runtime_status_from_proxy` promotes status to **Connected** → UI `ready=true`. |
| **Routing armed before bootstrap** | `save_tor_settings(enable=true)` calls `net_runtime.set(true, …)` immediately. All `connect_relay` use SOCKS while circuit not ready. |
| **Retry storm** | `relay.rs` Tor path retries up to **36** attempts / ~18s per URL × parallel public relays → host resource exhaustion. |

Not primary: GeoIPv6File relative path warn (noise). `localhost:7000` refused is separate community/local relay noise (PAUSED).

## Failure sequence

```text
Toggle Tor ON
  → save_tor_settings: net_runtime.enable_tor=true
  → start_tor: SocksPort opens (5%)
  → get_tor_status / probe: TCP OK → Connected / READY (false)
  → FullRelay / account_sync dials wss://* via SOCKS
  → 36× Proxy unreachable per URL + clearnet timeouts
  → WebView / native command queue starved → ChunkLoadError
```

## Required fail-closed (subtraction)

1. **Never** set `NativeNetworkRuntime.enable_tor=true` until log evidence `Bootstrapped 100%` (or equivalent control-port proof). Settings `enable_tor` may be true while routing stays clearnet/off.
2. **Never** promote `TorRuntimeStatus::Connected` from TCP probe alone. Probe may only demote Connected→Error when unreachable, or report reachability separately.
3. While Tor configured but not Connected: `connect_relay` must **fail closed** without 36-attempt SOCKS storm (refuse Tor dial / keep clearnet only if product allows — prefer refuse until ready).
4. Cap Tor SOCKS retries hard (≤3) even if a future path retries.

## Out of scope this slice

- Making Tor bootstrap succeed on censored/broken networks (environment).
- Phase 2 dial-hold redesign.
- Community / AUTH-SESSION.
- Thin UI.

## Claim language

| May say | When |
|---------|------|
| Investigation Ready | This file |
| Fail-closed Implemented | Code matches § Required + L1 |
| Tor opt-in Verified | L3: stuck bootstrap does not wedge; disable cleans; only 100% arms routing |
| App Fixed | Not claimed |
