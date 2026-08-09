# Research — Tor stability & latency for Obscur (Tor-only toward production)

**Date (UTC):** 2026-08-08  
**Status:** Research Ready — informs next design charter (no product code in this file)  
**Parents:** [tor-r4-relay-connect-firewall-diagnosis-2026-08.md](./tor-r4-relay-connect-firewall-diagnosis-2026-08.md) · [tor-r4-slice-4b-charter-2026-08.md](./tor-r4-slice-4b-charter-2026-08.md) · [tor-performance-conflicts-research-2026-08.md](./tor-performance-conflicts-research-2026-08.md)

```text
PRODUCT GOAL:         Tor remains until production; DM / import-export / groups / upload nearly OK
CURRENT FAILURE CLASS: Public clearnet Nostr over Tor exits (SOCKS timeout · CF 503) — not ISP Nostr ban
FORBIDDEN:            Re-arm UI→Tor SOCKS · fake READY · Community / AUTH-SESSION
```

## What Obscur already proved

| Fact | Evidence |
|------|----------|
| Clearnet Nostr works on this host | Direct WS **101** to nos/primal/damus |
| Tor preference forces gateway tunnel | `dial_mode=GatewayTunnel` · UI SOCKS false |
| Tor→public CF relays is the fragile hop | Tunnel SOCKS timeout · CF **503** from Tor exits |
| Host freeze class is separate | UI process must not dial `:9050` (R4 invariant) |

So “fix Tor stability / latency” means **improve the gateway Tor client + dial policy + relay selection**, not “unblock Nostr on the LAN.”

---

## External findings (mapped to our symptoms)

### 1. Cloudflare / CDN vs Tor exits (explains our 503s)

| Source | Claim | Obscur mapping |
|--------|--------|----------------|
| [Tor Project — Trouble with CloudFlare](https://blog.torproject.org/trouble-cloudflare/) | CF IP reputation disproportionately blocks Tor exits (research historically ≥80% of exits affected) | Public relays behind CF (damus/nos/primal class) will **reject or throttle Tor exits** even when clearnet works |
| [Lantern / PoPETs 2026 ReporTor](https://corpus.lantern.io/findings/2026-micallef-reportor-facilitating-user__explicit-dynamic-cdn-tor-blocking/) | Two block types: **explicit** CDN/WAF Tor policy vs **dynamic** abuse scoring; CF does not “block Tor by default” but scores exits harshly; IP rotation alone does not solve dynamic blocks | Our cool-down / NEWNYM hammer is **insufficient** against reputation; need **exit-aware routing** or **avoid CF** |
| Cloudflare WS docs | Initial WS upgrade subject to WAF / rate limits; idle connections closed | Stampede reconnects after 503 make CF scoring worse |

**Implication:** Relying on `wss://` public CF-fronted relays as the Tor production path is an **architectural conflict**, not a local bug.

### 2. WebSocket over Tor (explains flap / latency)

| Source | Claim | Obscur mapping |
|--------|--------|----------------|
| [Tor SE — Unstable websocket over Tor](https://tor.stackexchange.com/questions/9161/unstable-websocket-over-tor) | Tor does not kill long-lived TCP when circuits rotate if streams still open; instability often from middle proxies / reconnect logic | Prefer **keep one open WS**, heartbeat pings (we already answer Ping); avoid HTTP proxies in front of SOCKS |
| Tor Browser / onion timeout guidance | Expect **60–90s** TCP patience for Tor; aggressive short timeouts fail good circuits | Align budgets (we raised JS to 120s); still serialize dials |
| torrc knobs (`CircuitBuildTimeout`, `MaxCircuitDirtiness`, `KeepalivePeriod`) | Faster failover vs circuit churn trade-off; lower dirtiness → more unlinkability but more rebuild latency | Tune in **gateway** `torrc`, not UI |

### 3. Stream isolation vs NEWNYM (explains queue / latency under load)

| Source | Claim | Obscur mapping |
|--------|--------|----------------|
| [Tor path-spec — stream isolation](https://spec.torproject.org/path-spec/stream-isolation.html) | SOCKS auth isolates streams onto different circuits | Parallel dials with **different** auth → N circuit builds → SOCKS timeouts |
| [NEWNYM vs isolation](https://tor.stackexchange.com/questions/16398/signal-newnym-vs-stream-isolation) | `NEWNYM` is a heavy hammer (rate-limited, marks circuits dirty) | Prefer **shared isolation token for the mesh pool** (one circuit family for relay WS) + isolate only when needed (e.g. after hard CF reject) |

**Implication:** Cap concurrent Tor dials (already) **and** use **one SOCKS isolation identity** for NativeRelay pool so three relays share warm circuits instead of building three cold paths.

### 4. Arti / embeddable Tor (longer-term client owner)

| Source | Claim | Obscur mapping |
|--------|--------|----------------|
| [Arti 1.0 production client](https://blog.torproject.org/arti_100_released/) · later Arti releases | Rust Tor client embeddable; bootstrap status APIs; comparable client performance | Gateway could migrate `tor.exe` → **Arti in-process** for better bootstrap diagnostics / async dials — **design charter**, not a quick patch |
| Persist Tor state dir | Cold bootstrap 20–60s; warm cache much faster | Already using persistent gateway data dir — keep / measure |

### 5. Onion / Tor-native Nostr (production-aligned relay path)

| Source | Claim | Obscur mapping |
|--------|--------|----------------|
| Strfry-as-onion guides · [simple-nostr-over-tor](https://github.com/djinoz/simple-nostr-over-tor) | `ws://….onion` via SOCKS5h avoids clearnet CDN entirely | **Highest-leverage product move** for Tor-only production: ship / prefer **onion relays** (Obscur-operated or trusted) over CF public pool |

---

## Ranked options for Obscur (stability then latency)

| Priority | Approach | Stability | Latency | Cost / risk |
|----------|----------|-----------|---------|-------------|
| **P0** | Prefer **non-CF / onion** relays when Tor ON (subtract CF public from Tor pool) | High | Better (no CF 503 loop) | Needs relay list / ops onion |
| **P0** | One SOCKS isolation id for mesh WS + keep **≤1–2** concurrent Tor dials | High | Better (warm circuits) | Small gateway/desktop change |
| **P1** | Gateway `torrc` tune: patient `CircuitBuildTimeout`, sane dirtiness, keepalives; persist state | Med | Med | Config only |
| **P1** | After CF 503: stream-isolate **next** dial (new auth) instead of global NEWNYM + long pool freeze | Med | Med | Already have cool-down; refine |
| **P2** | Obscur-hosted onion Nostr for DM path | High | Predictable Tor RTT | Ops + client onion URL support |
| **P3** | Evaluate Arti replace `tor.exe` in gateway | Med–High | Similar / better control | Large; design first |

**Do not:** re-arm UI process SOCKS; treat more public CF relays as the Tor SLA.

---

## Honest latency expectations

| Hop | Typical |
|-----|---------|
| Clearnet public WS | ~0.5–2s connect |
| Tor → clearnet CF relay | Often 5–30s connect; intermittent hard fail |
| Tor → onion relay | Often 2–15s connect once circuits warm; no CF reputation |

Tor-only production should **budget for multi-second connects** and **optimize for fewer, sticky sockets**, not clearnet-class RTT.

---

## Recommended next atomic step

**Done:** T5 charter drafted — [tor-t5-stability-latency-charter-2026-08.md](./tor-t5-stability-latency-charter-2026-08.md).  
**Next:** Maintainer accept → T5-0 design (Tor-viable pool + isolation).

## References (primary)

1. https://blog.torproject.org/trouble-cloudflare/  
2. https://corpus.lantern.io/findings/2026-micallef-reportor-facilitating-user__explicit-dynamic-cdn-tor-blocking/  
3. https://spec.torproject.org/path-spec/stream-isolation.html  
4. https://blog.torproject.org/arti_100_released/  
5. https://tor.stackexchange.com/questions/9161/unstable-websocket-over-tor  
6. https://developers.cloudflare.com/network/websockets/
