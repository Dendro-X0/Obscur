# Investigation — Tor console popup + Warming kills clearnet (2026-08-17)

**Status:** Implemented (L1) · L3 smoke pending maintainer restart  
**Parents:** [tor-integration-redesign-charter-2026-08.md](./tor-integration-redesign-charter-2026-08.md) · [tor-enable-disconnect-investigation-2026-08.md](./tor-enable-disconnect-investigation-2026-08.md) · [tor-warming-stuck-network-vs-logic-investigation-2026-08.md](./tor-warming-stuck-network-vs-logic-investigation-2026-08.md) · [tor-verified-infeasible-2026-08.md](./tor-verified-infeasible-2026-08.md)

```text
HANDOFF ATOMIC STEP:  PAUSED — dialect research (≠ Nostr / VPS / Tor)
PAUSED / CANCELLED:   dialect impl · Tor Verified · groups/** · AUTH-SESSION
CANONICAL OWNER:      tor_gateway_spawn (process) · resolve_relay_dial_mode (NativeRelay) · tor_manager (tor.exe)
PROOF BEFORE DONE:    L1 cargo test + spawn unit tests · L3: Tor ON Warming keeps ≥1 clearnet relay; no extra console
OUT OF SCOPE:         Tor bootstrap 100% · bridges · fake Ready · Tor Verified soak
```

## Plan alignment

| Gate | Result |
|------|--------|
| Handoff forbids **Tor Verified** | Honor — do not patch TLS / directory / bridges |
| Allowed: **critical regression fixes** | This slice: silent spawn + TI-B Warming keep-clearnet (JS already, Rust not) |
| Conflicts with PAUSED? | **No** for this slice — restoring landed TI-B invariant, not reopening Verified |

## Observed vs expected

| | |
|---|---|
| **Observed** | Enable Tor → empty Windows Terminal (`C:\Users\Administrator\.cargo`) · Security: GATEWAY + BOOTSTRAP STARTING · `waiting for Bootstrapped 100%` · **all relays die** (app looks offline) |
| **Expected (TI-B / Security copy)** | No extra console · Warming keeps clearnet until Ready · honest “starting” badge · no fake Ready |
| **Not expected this session** | Bootstrap 100% on this LAN (already **INFEASIBLE** — TLS_ERROR class) |

## Root causes (ordered)

### R1 — Dev spawn is `cargo run` without `CREATE_NO_WINDOW` (console)

`resolve_gateway_launch` falls through to `GatewayLaunch::CargoRun` when no `obscur-tor-gateway.exe` sits next to the Tauri exe (`pnpm dev:desktop:online`).

`spawn_gateway_process` runs `cargo run -p obscur-tor-gateway --quiet` with stdout/stderr nulled, **no** Windows `CREATE_NO_WINDOW` (`0x08000000`). Cargo is a console subsystem binary → Windows Terminal pops an empty tab (often titled from `~\.cargo`).

`tor.exe` (gateway) and `taskkill` have the same missing flag (secondary flashes).

### R2 — NativeRelay fail-closes while JS Warming keeps clearnet URLs (disconnect)

TI-1 JS (`relay-tor-dial-policy.ts`): preference ON + not Ready → **warming** → still dial **clearnet** URLs.

Rust `resolve_relay_dial_mode`: preference ON + gateway reachable + not `bootstrap_ready` → **`FailClosedTorNotReady`** → `connect_relay` returns error *for every URL*.

Screenshot matches: RUNTIME GATEWAY (reachable) + BOOTSTRAP STARTING → every native WS invoke fail-closes → “Tor disconnected the internet.”

This is the same product failure as [tor-enable-disconnect-investigation-2026-08.md](./tor-enable-disconnect-investigation-2026-08.md) R2, **after** TI-1 landed on the PWA side only.

### R3 — Bootstrap stall is environment (out of scope)

Same UI as [tor-warming-stuck-network-vs-logic-investigation-2026-08.md](./tor-warming-stuck-network-vs-logic-investigation-2026-08.md): wait for 100% while TLS to directory/guards fails. **Do not** patch-debug bootstrap on this LAN.

## Mental simulation

1. User toggles Security → Tor ON (dev desktop).  
2. Desktop spawns `cargo` (console window) then gateway starts `tor.exe`.  
3. Gateway health OK · bootstrap never 100%.  
4. JS still lists nos.lol / primal / damus.  
5. Each `connect_relay` hits `FailClosedTorNotReady`.  
6. Open sockets → 0. Toggle OFF restores clearnet.

## Slice (implement)

| Change | Owner | Subtract |
|--------|-------|----------|
| Prefer workspace `target/{debug,release}/obscur-tor-gateway(.exe)` over `cargo run` | `tor_gateway_spawn.rs` | CargoRun only as last resort |
| `CREATE_NO_WINDOW` on gateway/cargo/`tor.exe`/`taskkill` | spawn + `tor_manager` + `tor.rs` | Visible consoles |
| Warming/Degraded → `RelayDialMode::Clearnet` | `resolve_relay_dial_mode` | `FailClosedGatewayDown` / `FailClosedTorNotReady` as NativeRelay outcomes |

**Invariant restored:** `configured === true` alone must not empty native dials. Tunnel only when `lifecycleReady && gatewayReachable`.

## Claim language

| May say | Must not say |
|---------|----------------|
| Implemented (L1): silent spawn + Warming keeps clearnet | Tor Verified · Tor Ready · “Tor works on this LAN” |
| L3: toggle ON while Starting still has clearnet sockets | Fake Connected / hide Warming |
