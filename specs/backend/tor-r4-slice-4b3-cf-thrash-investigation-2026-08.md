# Investigation — Tor R4 Slice 4b-3 CF 503 thrash

**Date (UTC):** 2026-08-08  
**Status:** Thrash cut **Implemented** · L3 open-socket evidence 2026-08-08 (`Tor tunnel connected` nos.lol + primal)  
**Parent:** [tor-r4-slice-4b-tunnel-design-2026-08.md](./tor-r4-slice-4b-tunnel-design-2026-08.md)

```text
HANDOFF ATOMIC STEP:  Tor R4 Slice 4b — maintainer confirm 4b-3 (UI + OFF clearnet)
PAUSED / CANCELLED:   Community · AUTH-SESSION
CANONICAL OWNER:      apps/desktop/src-tauri/src/relay.rs (GatewayTunnel dial loop)
PROOF BEFORE DONE:    Maintainer UI interactive · Tor OFF clearnet still OK
OUT OF SCOPE:         Re-arm UI SOCKS · Community · AUTH-SESSION · fake READY
```

## Evidence

| Observation | Source |
|-------------|--------|
| Same Rust path opens `wss://nos.lol` | `cargo test --lib net::tests::tunnel_wss_nos_lol_smoke -- --ignored` → OK |
| Python tunnel handshake → 101 while app fails | Concurrent soak script |
| App under pool reconnect | Repeated `HTTP error: 503 … server: cloudflare` on damus/nos/primal |
| Dial mode correct | `dial_mode=GatewayTunnel` · UI SOCKS false |
| Host not frozen | Desktop Responding; no PostMessage quota storm |

## Root cause (working)

1. **Retry hammer:** Tor path retries every ~500ms for up to 50s on hard HTTP 503. That burns the Tor exit + CF edge without healing TLS fingerprint issues.  
2. **Dial-gate hold:** `tor_tunnel_dial_gate` wraps the **entire** retry budget. One relay’s 503 storm serializes the pool for ~50s, so other URLs never get a clean first attempt.  
3. **Not a host freeze / not missing tunnel:** L2 proves path; CF answers from Tor exit — product path reaches the edge.

## Fix (smallest subtraction)

| Change | Why |
|--------|-----|
| Hold dial gate **per attempt** only | Let other relays try; match gateway handshake semaphore intent |
| On tungstenite `Error::Http` (esp. 403/429/5xx) → **stop retrying** that invoke | Fail to JS; avoid CF hammer |
| 45s global cool-down after hard reject | Stop pool stampede while exit is hot |
| Keep short retries only for timeout / IO | Transient Tor circuit noise |

## Landed (4b-3 thrash cut)

| Change | File |
|--------|------|
| Fail-fast on HTTP 403/429/5xx (no in-invoke hammer) | `relay.rs` |
| Dial gate held **per attempt** only | `relay.rs` |
| 45s global cool-down after hard edge reject | `relay.rs` |
| Success log `Tor tunnel connected {url}` | `relay.rs` |

## Evidence (2026-08-08)

| Layer | Result |
|-------|--------|
| L2 | `tunnel_wss_nos_lol_smoke` OK · Python tunnel → 101 |
| L3 agent | `/tmp/obscur-desktop-4b3f.log` — repeated `Tor tunnel connected` for nos.lol, primal, damus; cool-down engaged on 503; desktop Responding; no PostMessage quota |
| Gap | Maintainer UI interactive + preference-OFF clearnet confirmation before **4b Verified** |

## Non-claims

- Open-socket log ≠ Slice 4b **Verified** until maintainer confirms shell + OFF clearnet.  
- Occasional CF 503 on Tor exits remains expected; cool-down is mitigation, not a public-relay SLA.
