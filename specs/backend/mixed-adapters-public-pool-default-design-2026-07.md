# Design — Mixed adapters default + public relay pool at boot

**Status:** Implementation · 2026-07-28  
**Band:** Production parity recovery (P3 relays)  
**Related:** [production-tor-opt-in-public-default-design-2026-07.md](./production-tor-opt-in-public-default-design-2026-07.md)

---

## Problem

Boot uses **Default Stable** with `transportMode: "basic"` → only one relay is **ACTIVE TRANSPORT**. When `relay.damus.io` fails (503 / TLS eof), `nos.lol` and `primal` stay **STANDBY** and the profile looks offline. Mixed pack is only one public + localhost HTTP and is not the boot default.

## Product contract

| Requirement | Behavior |
|-------------|----------|
| Default pack | **Mixed adapters** (`hybrid_public_http`) shows **ACTIVE** on a fresh profile |
| Public pool | Damus + nos.lol + primal **enabled** and in the **redundancy** active pool (up to 3) |
| Private adapter | `http://127.0.0.1:8788` included enabled (mesh optional at runtime; failure must not block Nostr pool) |
| Tor | Still **off** by default |
| Default Stable pack | Remains available; uses **redundancy** when applied (no single-primary trap) |

## Owners

| Concern | Module |
|---------|--------|
| Pack definition | `transport-preset-catalog.ts` |
| Boot relay list | `use-relay-list.ts` `DEFAULT_RELAYS` |
| Boot mode | `relay-transport-mode.ts` default → `redundancy` |
| Active pool | `relay-primary-selector.ts` (unchanged; consumes mode) |

## Slice

1. Expand `HYBRID_PUBLIC_HTTP_PRESET.relays` to three public WSS + HTTP mesh; keep `redundancy`.
2. Set `DEFAULT_RELAYS` to the same four URLs enabled (plus disabled localhost WS / snort as today).
3. Default `readRelayTransportMode` → `redundancy` when unset (env override still honored).
4. Set `DEFAULT_STABLE_PRESET.transportMode` → `redundancy`.
5. Update EN copy for Mixed / Default Stable descriptions.

## Out of scope

- Fixing damus Cloudflare 503 / rustls close_notify (upstream / probe; pool failover is the product mitigation)
- Duplicate catalog panel render (separate UI subtraction if still present)
- Enabling Tor by default

## Proof

- L1: `transport-preset-catalog.test.ts` · `transport-preset-match.test.ts` · relay-transport-mode default · relay-list defaults
- L3: fresh profile → Mixed ACTIVE · ≥1 of public pool writable with Tor off (failover if damus errors)
