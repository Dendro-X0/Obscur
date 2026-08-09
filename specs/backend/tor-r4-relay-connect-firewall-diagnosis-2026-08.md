# Diagnosis — Relays CONNECTING with Tor ON (2026-08-08)

**Question:** Program logic bug vs regional firewall blocking public Nostr?

```text
HANDOFF:              Tor R4 Slice 4b — maintainer confirm / L3 Fail diagnosis
PAUSED / CANCELLED:   Community · AUTH-SESSION
```

## Split test (same machine, same hour)

| Path | nos.lol | primal | damus |
|------|---------|--------|-------|
| **Clearnet** DNS+TCP+WS (no Tor) | **101** ~1.1s | **101** ~1.1s | **101** ~0.6s |
| **Tor tunnel** `:17951` → SOCKS | `socks_connect` timeout 12s | same | same |
| **App** (`enable_tor:true`) | `GatewayTunnel` — SOCKS timeout / CF 503 / cool-down → UI **CONNECTING** |

## Environment notes

| Signal | Value |
|--------|--------|
| Tor preference | `enable_tor: true` |
| Gateway | `bootstrapReady: true` |
| Windows proxy | `ProxyEnable=1` · `127.0.0.1:7897` |
| Clearnet DNS | `198.18.6.x` (typical **fake-ip** from local proxy client) |

Fake-ip + local proxy means clearnet succeeds *through* the local proxy stack — not “raw ISP to Cloudflare.” Still: **public relays are reachable without Tor.**

## Verdict

| Hypothesis | Result |
|------------|--------|
| Regional firewall blocks public Nostr | **Rejected** — clearnet WS upgrade **101** on all three |
| App cannot dial clearnet at all | **Rejected** — same hosts work outside Tor preference |
| Tor ON forces tunnel; Tor→relay unhealthy | **Accepted** — tunnel SOCKS timeouts + earlier CF 503 from Tor exits |
| UI CONNECTING / quiet banner | Symptom of Tor dial path failing / flapping — not proof of ISP block |

## What to do

1. **Immediate:** Settings → disable Tor → expect clearnet opens (matches pre-4b maintainer Pass).  
2. **Tor optional:** keep gateway running; treat intermittent SOCKS/CF as Tor-exit / CF policy, not “Nostr banned.”  
3. Do **not** claim 4b Verified until Tor ON shows sustained open sockets in UI *and* Tor OFF still clearnet-OK.
