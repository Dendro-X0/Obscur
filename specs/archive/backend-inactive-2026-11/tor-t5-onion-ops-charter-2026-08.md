# Charter — T5-3 Obscur onion Nostr ops (Tor production SLA)

**Date (UTC):** 2026-08-08  
**Status:** Charter **Accepted (T5-3-A)** · T5-3.0 ops design **Ready** · next T5-3.0 Accept → T5-3.1 provision  
**Parents:** [tor-t5-stability-latency-charter-2026-08.md](./tor-t5-stability-latency-charter-2026-08.md) (T5-C) · [tor-stability-latency-web-research-2026-08.md](./tor-stability-latency-web-research-2026-08.md) · [tor-t5-tor-viable-pool-design-2026-08.md](./tor-t5-tor-viable-pool-design-2026-08.md) · [tor-t5-l3-soak-checklist-2026-08.md](./tor-t5-l3-soak-checklist-2026-08.md) · [tor-integration-redesign-charter-2026-08.md](./tor-integration-redesign-charter-2026-08.md) (TI-5) · [tor-t5-3-0-onion-ops-design-2026-08.md](./tor-t5-3-0-onion-ops-design-2026-08.md)

```text
HANDOFF ATOMIC STEP:  T5-3-A Accepted · T5-3.0 Design Ready
PAUSED / CANCELLED:   Community · AUTH-SESSION
CANONICAL OWNER:      Ops onion Nostr (nostr-rs-relay HS) · PWA Tor-viable URL · gateway tunnel
PROOF BEFORE DONE:    Documented onion URL · L3 two-machine soak · Tor OFF clearnet unbroken
OUT OF SCOPE:         Community · AUTH-SESSION · UI→:9050 · Arti · CF-public as Tor SLA · fake onions
```

## Why this charter exists

T5-1/T5-2 correctly **subtract** Cloudflare public relays when Tor is ON. That leaves an honest empty pool until a **Tor-viable** endpoint exists. Research ranked onion Nostr as the highest-leverage production path (no CF exit reputation). Lab loopback proves sticky opens in soak only — not a production SLA.

**T5-3 ships the missing production endpoint + client wiring docs**, not more reconnect patches.

## Goal

1. Operate (or adopt) at least one **Obscur-trusted** Nostr relay reachable as `ws://….onion` or `wss://….onion` over Tor SOCKS.  
2. Publish the URL into product defaults / Tor-viable allowlist / Relays preset when Tor ON.  
3. Prove **two-machine** DM soak over that onion with gateway tunnel (4b) + shared SOCKS auth (T5-1).

## Non-goals

- Re-allowlisting nos/primal/damus for Tor  
- Re-arming UI process SOCKS  
- Replacing `tor.exe` with Arti (T5-4)  
- Fixing Community / AUTH-SESSION  
- Claiming Verified from L1 alone

## Decision options (pick on accept)

| ID | Approach | Notes |
|----|----------|-------|
| **T5-3-A** | Obscur-operated hidden service (strfry or nostr-rs-relay behind Tor HS) | Full control · ops cost · preferred for production SLA |
| **T5-3-B** | Curated third-party onion Nostr (allowlist only) | Faster · trust/ops external · document rotation |
| **T5-3-C** | Lab HS only (`*.onion` → local relay) for Verified soak · defer public onion | Unblocks L3 C-onion · **not** production Tor-ready |

**Decision:** **T5-3-A Accepted** (maintainer 2026-08-08) — Obscur-operated HS. B/C not selected (C may be revisited only as interim lab if A provision stalls).

## Slice plan (after accept)

| Slice | Work | Exit |
|-------|------|------|
| **T5-3.0** | Ops design: relay binary · HS ports · persistence · backup · abuse baseline | [tor-t5-3-0-onion-ops-design-2026-08.md](./tor-t5-3-0-onion-ops-design-2026-08.md) **Ready** |
| **T5-3.1** | Provision onion; publish URL in `docs/` + handoff; add to Tor-viable allowlist / Tor ON preset | L2 gateway tunnel 101 to onion |
| **T5-3.2** | Client: Default Tor preset includes onion; honesty copy only when onion missing | L1 + Relays UI |
| **T5-3.3** | Two-machine DM soak over onion · Tor OFF clearnet regression | L3 Pass → production Tor-ready candidate |

## Client contracts (already landed — do not regress)

| Contract | Owner |
|----------|--------|
| Tor ON → dial onion_ws / allowlist only | `relay-tor-viable.ts` |
| Shared SOCKS `obscur-mesh-ws` | `apps/tor-gateway` |
| Tunnel TLS+WS via gateway | `relay.rs` / 4b |
| Empty pool honesty | Relays settings copy |

T5-3 **adds** a real URL into allowlist/preset — it does **not** invent a second dialer.

## Security / ops notes

- Prefer `ws://` onion (TLS inside Tor often redundant; `wss://` onion needs valid cert story).  
- Keep DataDirectory / HS keys backed up; rotate with dual-publish window.  
- Rate-limit / write policy on relay to limit abuse.  
- Never put CF public hosts on Tor-viable allowlist.

## Proof language

| May say | When |
|---------|------|
| T5-3 Charter Ready | This file |
| T5-3 Accepted | Maintainer picks A/B/C |
| Onion ops Implemented | T5-3.1 URL live + L2 101 |
| Production Tor-ready | T5-3.3 L3 + Tor-only Verified checklist |

## Immediate next

1. Maintainer **Accept** [tor-t5-3-0-onion-ops-design-2026-08.md](./tor-t5-3-0-onion-ops-design-2026-08.md) (or request deltas).  
2. Ops **T5-3.1**: provision HS + nostr-rs-relay · publish real `ws://….onion` in docs/handoff.  
3. Agents wire allowlist/preset **only** after that URL exists — **no** fake onions.
