# Design — Tor R4 Slice 4b loopback TCP tunnel (4b-0)

**Date (UTC):** 2026-08-08  
**Status:** 4b-0–4b-2 **Implemented** · 4b-3 agent open-socket **Pass** — maintainer confirm for **Verified**  
**Charter:** [tor-r4-slice-4b-charter-2026-08.md](./tor-r4-slice-4b-charter-2026-08.md) · thrash [tor-r4-slice-4b3-cf-thrash-investigation-2026-08.md](./tor-r4-slice-4b3-cf-thrash-investigation-2026-08.md)

```text
OWNER:                apps/tor-gateway · desktop relay.rs / tor_gateway_client
FORBIDDEN:            net_runtime.set(true) toward Tor SocksPort · UI→:9050 SOCKS
NEXT:                 Maintainer confirm UI interactive + Tor OFF clearnet → 4b Verified
```

## Goal

When Tor preference is ON and gateway reports `bootstrapReady`, NativeRelay must open `wss://` relays **without** the UI process dialing Tor SOCKS. Gateway performs the SOCKS CONNECT; UI speaks TLS + WebSocket on a **loopback** byte stream.

## Architecture (option B)

```text
┌─────────────────────────┐         loopback TCP          ┌──────────────────────┐
│ obscur_desktop_app      │ ─────────────────────────────▶│ obscur-tor-gateway   │
│ relay.rs                │  (tunnel accept / splice)     │ SOCKS5h → Tor :9050  │
│ tungstenite + TLS       │◀═════════════════════════════▶│ ▶ relay host:443     │
└─────────────────────────┘         raw bytes             └──────────────────────┘
```

| Hop | Who | Protocol |
|-----|-----|----------|
| 1 | UI → gateway | Loopback TCP (control + spliced bytes) |
| 2 | Gateway → Tor | SOCKS5h CONNECT (only if bootstrap ready) |
| 3 | Gateway ↔ relay | TCP to relay host:port |
| 4 | UI ↔ (via splice) | TLS ClientHello… then WebSocket (unchanged tungstenite path on custom stream) |

UI never connects to `127.0.0.1:9050`.

## Gateway API (4b-1)

### Bind

Keep control plane on `127.0.0.1:17950`. Tunnel accept on a **sibling** loopback port to avoid multiplexing hell in the existing line-based HTTP server:

| Env | Default | Role |
|-----|---------|------|
| `OBSCUR_TOR_GATEWAY_BIND` | `127.0.0.1:17950` | HTTP control (existing) |
| `OBSCUR_TOR_GATEWAY_TUNNEL_BIND` | `127.0.0.1:17951` | Raw tunnel listener |

Refuse non-loopback binds (same R4 rule).

### Tunnel handshake (length-prefixed JSON then splice)

1. Client connects to `TUNNEL_BIND`.  
2. Client sends one line:  
   `{"v":1,"host":"nos.lol","port":443}\n`  
3. Gateway validates: host non-empty, port 1–65535, no IP literals required (hostname OK for SOCKS5h).  
4. If `!bootstrapReady` → reply `{"ok":false,"error":"tor_not_ready"}\n` and close.  
5. Acquire dial semaphore (shared with HTTP, `MAX_CONCURRENT_DIALS=4`).  
6. SOCKS CONNECT via gateway’s Tor socks URL.  
7. On success → `{"ok":true}\n` then **byte-splice** client ↔ upstream until either side EOF/error.  
8. On SOCKS failure → `{"ok":false,"error":"socks_connect","detail":"…"}\n` and close.

No WebSocket framing in the gateway. No HTTP upgrade on `:17950` for 4b-1.

### Concurrency / timeouts

| Knob | Value |
|------|--------|
| Shared dial slots | 4 (HTTP + tunnel) |
| SOCKS connect timeout | 12s (align 4a) |
| Idle splice | no artificial short idle; rely on WS close / UI cancel |
| Reject | Non-loopback peer |

## Desktop changes (4b-2)

| Surface | Behavior |
|---------|----------|
| `UI_PROCESS_MAY_DIAL_VIA_SOCKS` | Stays **`false`** |
| `net_runtime.set(…)` | Stays **`false`** toward Tor (no regress to option A) |
| Tor WS path | New helper: open tunnel → `MaybeTlsStream` / `client_async` on the tunnel `TcpStream` with correct SNI/host from relay URL |
| When to use tunnel | Preference ON **and** `gateway_reachable` **and** `lifecycle_ready` (from existing snapshot / status pull) |
| When clearnet | Preference OFF → today’s `connect_async` |
| Fail closed | Preference ON but gateway not ready → error (do not silently clearnet; avoids split-brain “Tor ON” UX) |
| Probe / publish | Same connection path as `connect_relay_internal` |

Extract shared “TCP via SOCKS” logic from `net.rs` **into gateway only** — do not call `connect_websocket` with Tor armed in UI.

## Selection matrix

| `enable_tor` | Gateway health | `bootstrapReady` | Relay dial |
|--------------|----------------|------------------|------------|
| false | * | * | Clearnet |
| true | false | * | Error: run gateway |
| true | true | false | Error: waiting bootstrap |
| true | true | true | Tunnel → TLS → WS |

## Proof plan

| Layer | Command / evidence |
|-------|-------------------|
| L1 | `cargo test -p obscur-tor-gateway` (handshake parse, refuse when not ready, loopback-only) |
| L1 | desktop lib tests: selection matrix; never sets `net_runtime` tor true |
| L2 | Manual: tunnel to `nos.lol:443`, TLS handshake completes |
| L3 | Preference ON · ≥1 NativeRelay open · shell Responding · no PostMessage quota · preference OFF DM clearnet still works |

## Claim language

| May say | When |
|---------|------|
| 4b-0 Design Ready | This file |
| 4b-1 Implemented | Tunnel listener + L1 |
| 4b Verified | 4b-3 soak |

## Mental simulation

1. User leaves Tor ON (T3). Gateway ready.  
2. Mesh connects `wss://nos.lol` → desktop opens `127.0.0.1:17951`, sends host/port.  
3. Gateway SOCKS-connects via Tor; splices.  
4. UI completes TLS+WS; open socket counts rise.  
5. User toggles Tor OFF → new dials use clearnet; existing Tor sockets may drop (acceptable).  
6. Gateway crash mid-session → tunnel EOF → relay disconnected; UI stays interactive (kill-switch).
