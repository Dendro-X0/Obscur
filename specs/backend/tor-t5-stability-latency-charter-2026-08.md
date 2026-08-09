# Charter — Tor-only production stability & latency (T5)

**Date (UTC):** 2026-08-08  
**Status:** Charter **Accepted** (T5-B) · T5-0 Accepted · T5-1/T5-2 **Implemented (L1)** · next L3 / T5-3  


**Parents:** [tor-stability-latency-web-research-2026-08.md](./tor-stability-latency-web-research-2026-08.md) · [tor-r4-relay-connect-firewall-diagnosis-2026-08.md](./tor-r4-relay-connect-firewall-diagnosis-2026-08.md) · [tor-r4-slice-4b-charter-2026-08.md](./tor-r4-slice-4b-charter-2026-08.md) (tunnel path)

```text
HANDOFF:              Tor-only production — stability / latency (post-4b tunnel)
PAUSED / CANCELLED:   Community · AUTH-SESSION
CANONICAL OWNERS:     apps/tor-gateway (SOCKS / torrc / isolation)
                      apps/desktop relay.rs + net.rs (tunnel dial policy)
                      PWA relay pool selection when Tor ON (subtract CF public)
PROOF BEFORE DONE:    Named L1–L3 per slice; Tor ON ≥1 sticky open socket; OFF clearnet unbroken
OUT OF SCOPE:         Community · AUTH-SESSION · UI→:9050 SOCKS · fake READY · Arti rewrite (T5-3+)
```

## Product intent

| Goal | Meaning |
|------|---------|
| Tor until production | Preference ON is the default product path for privacy; clearnet OFF is fallback / lab |
| Near-working features | Profile import/export · DM · groups · upload/save stay on the **same** Tor-routed transport — no parallel clearnet cheat when Tor ON |
| Stability first | Fewer flaps / CF 503 loops / SOCKS timeout queues |
| Latency second | Multi-second Tor connects are honest; optimize sticky sockets + warm circuits, not clearnet RTT |

## Problem (evidence-backed)

| Layer | Finding |
|-------|---------|
| Clearnet | Public Nostr WS **101** — not an ISP Nostr ban |
| Tor → CF public | SOCKS timeout · CF **503** — industry Tor-exit reputation class |
| App | Tor ON → gateway tunnel (4b) correct; pool still dials CF publics → failure class |

**Architectural conflict:** Treating `wss://` Cloudflare-fronted public relays as the Tor production SLA cannot succeed reliably. Patching reconnect/timeout alone will not fix CDN reputation.

## Hard invariants (carry forward from R4 / 4b)

1. UI process must **not** dial Tor SocksPort (`UI_PROCESS_MAY_DIAL_VIA_SOCKS=false`).  
2. Ready = Bootstrapped 100% only.  
3. Tor preference ON + gateway down / not ready → **fail closed** (no silent clearnet).  
4. Tor preference OFF → clearnet path unchanged (do not regress maintainer Pass).  
5. One owner per dial path: gateway owns SOCKS; desktop owns tunnel TLS+WS.

## Decision matrix

| ID | Approach | Verdict |
|----|----------|---------|
| **T5-A** | Keep CF public pool; more retries / NEWNYM / cool-down only | **Reject as SLA** — research: dynamic CF blocks ≠ fixed by rotation |
| **T5-B** | When Tor ON: dial **Tor-viable** endpoints only (onion / known non-CF) + shared SOCKS isolation + sticky WS | **Accept (primary)** |
| **T5-C** | Obscur-operated onion Nostr as default Tor DM path | **Accept as P2 ops** (needed for real production SLA) |
| **T5-D** | Replace `tor.exe` with Arti in gateway | **Defer (P3)** — design later; not required for T5-0/1 |

**Charter decision:** pursue **T5-B** immediately; charter **T5-C** as production dependency; keep Arti out of critical path until B/C prove sticky opens.

## Slice sequence (one at a time)

| Slice | Work | Exit |
|-------|------|------|
| **T5-0** | Design note: Tor-viable relay selection contract · SOCKS isolation token · max concurrent dials · honesty copy when Tor pool empty | Spec committed; **no product dial change** until accept |
| **T5-1** | Gateway: shared SOCKS auth for mesh tunnel dials · `torrc` patient build/keepalive · optional isolate-on-503 | L1 gateway + desktop dial tests |
| **T5-2** | Desktop/PWA: when Tor ON + bootstrap ready, **subtract** CF-public defaults from dial pool; prefer configured onion / Tor-viable list; honesty if pool empty | L1 selection · L3 Tor ON open (onion or lab endpoint) |
| **T5-3** | Ops: ship / document Obscur onion relay URL(s) for production Tor DM | L3 two-machine soak over onion |
| **T5-4** | (Optional) Arti embed evaluation charter | Feasibility only |

## Owners (truth map)

| Concern | Owner |
|---------|--------|
| SOCKS CONNECT + isolation | `apps/tor-gateway` tunnel / dial |
| `torrc` / bootstrap / data dir | `obscur-tor-gateway` |
| Tunnel TLS+WS + cool-down | `relay.rs` / `net.rs` |
| Which URLs enter NativeRelay when Tor ON | PWA DM/transport resolve + mesh configure (subtract, don’t dual-path) |
| Mesh `TorRequired` vs clearnet conduits | `mesh/tor_policy.rs` (extend with Tor-viable endpoint class — design in T5-0) |

## Proof language

| May say | When |
|---------|------|
| T5 charter Ready | This file + maintainer accept |
| T5-1/2 Implemented | Named L1 green for that slice |
| Tor-only path **Verified** | L3: Tor ON · ≥1 sticky open · shell interactive · DM smoke · Tor OFF clearnet still OK |
| Production Tor-ready | T5-3 onion ops + Verified above — **not** CF public alone |

## Honesty / UX (non-negotiable copy)

When Tor ON and no Tor-viable relay is configured/reachable:

- Do **not** show “network blocked” as the primary story if clearnet probe would succeed.  
- Do show: “Tor is on — public Cloudflare relays are unreliable over Tor. Add an onion / Tor-viable relay, or turn Tor off for clearnet.”

## Immediate next atomic step

**L3 checklist Ready** — [tor-t5-l3-soak-checklist-2026-08.md](./tor-t5-l3-soak-checklist-2026-08.md).  
**T5-3 Charter Ready** — [tor-t5-onion-ops-charter-2026-08.md](./tor-t5-onion-ops-charter-2026-08.md) (accept A/B/C).  
Agents: no dial-code until L3 evidence or T5-3 accept.

## Non-goals this charter

- Fixing Community / AUTH-SESSION  
- Re-arming UI SOCKS  
- Claiming public CF Nostr SLA under Tor  
- Big-bang Arti migration
