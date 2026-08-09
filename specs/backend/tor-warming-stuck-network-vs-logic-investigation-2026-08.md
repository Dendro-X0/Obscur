# Investigation — Tor Warming stuck: network vs app logic (2026-08-08)

**Status:** Verdict — **network / path censorship class** (not Obscur lifecycle bug)  
**Evidence host:** Maintainer Windows · gateway `:17950` · `tor.exe` SocksPort `:9050`

```text
QUESTION:  Environment blocks Tor vs program flaw?
ANSWER:    Environment (TLS handshake to directory/guard relays fails). App lifecycle is behaving correctly.
```

## What the UI showed

- Warming · RUNTIME GATEWAY · REACHABILITY PENDING · BOOTSTRAP STARTING  
- Log: `waiting for Bootstrapped 100%`

That alone is **honest Warming** (TI-1/TI-3). Stuckness needs `notice.log` / gateway `detail`.

## Live evidence (this session)

| Check | Result |
|-------|--------|
| Gateway `/v1/health` | OK |
| `tor.exe` process | Running (PID on SocksPort) |
| `127.0.0.1:9050` | LISTENING |
| Gateway status | `starting`, `bootstrapReady: false` |
| Bootstrap | Reached **10% → 14%** then stalls |
| Failure class | Repeated **`TLS_ERROR`** / `handshaking (TLS)` / `sslv3 alert handshake failure` / `unexpected eof` / `wrong version number` across **many** relay IPs (DE, FR, AT, etc.) — count **40+** |

Example detail from gateway:

> Stuck at 14% (handshake): Handshaking with a relay. (unexpected eof while reading; TLS_ERROR; …)

## Interpretation

| Hypothesis | Fits evidence? |
|------------|----------------|
| App never starts Tor / fake READY | **No** — SocksPort open; state stays `starting` until 100% |
| IsolateSOCKSAuth / torrc (prior exit 1) | **Fixed earlier** — Tor now runs and connects TCP to relays |
| Obscur UI “stuck” logic | **No** — UI correctly waits for Bootstrapped 100%; gateway never claims Ready |
| Network/DPI/firewall interferes with Tor TLS | **Yes** — TCP connect succeeds (`conn_done` / handshake stage) then **TLS handshake dies** on diverse hosts |

Same class as [tor-r4-host-bootstrap-feasibility-2026-08.md](./tor-r4-host-bootstrap-feasibility-2026-08.md) § network ceiling.

## How to confirm further (operator)

1. Keep Tor ON 2–5 min; if notice.log never shows `Bootstrapped 100%`, env remains blocked.  
2. Optional: try **bridges** (obfs4/snowflake) — if bridges reach 100% while vanilla fails → censorship/filtering, not app bug.  
3. Try another network (mobile hotspot). If 100% there → this LAN/ISP path is the limiter.

## Product posture

- Prefer Tor **OFF** for daily clearnet DMs on this host.  
- Do **not** fake Ready.  
- TI Warming copy remains correct; surface `Problem bootstrapping` / TLS detail in Security logs when present (honesty polish, not a “fix Tor”).
