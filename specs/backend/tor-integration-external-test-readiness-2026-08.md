# Assessment — Tor integration readiness for external testers

**Date (UTC):** 2026-08-08  
**Audience:** Maintainer + invited testers on **Tor-capable** networks  
**Host note:** Maintainer LAN **cannot** complete Tor TLS bootstrap (env block) — that does **not** invalidate integration for others.

```text
CLAIM: Integration architecture is correct for private testing (L1 + local lifecycle proof).
NOT CLAIMED: Tor Verified · production Tor-ready · T5-3 onion live.
```

## What is correct (ship to private testers)

| Area | Status | Evidence |
|------|--------|----------|
| UI never owns SOCKS / tor.exe | Correct | R4 · gateway owns process |
| Gateway co-start (stack / desktop spawn) | Implemented (L1) | TI-2 |
| Dial subtract only when Ready (`tor_armed`) | Implemented (L1) | TI-1 · Warming keeps clearnet |
| Tor OFF restores clearnet | Confirmed (this host) | Maintainer: toggle OFF → normal Relays |
| No fake Ready on SocksPort alone | Correct | Ready only on Bootstrapped 100% |
| torrc IsolateSOCKSAuth | Fixed | SocksPort **flag** · tor starts, Socks listens |
| Security Warming / Degraded honesty | Implemented (L1) | TI-3 |
| DISABLED duplex | Implemented (L1) | TI-4 |

## What this host cannot prove

Vanilla Tor bootstrap past ~14% (TLS handshake failures to many relays). Use another network or bridges for Ready / sticky open.

## What external testers must run

Canonical matrix: [tor-t5-l3-soak-checklist-2026-08.md](./tor-t5-l3-soak-checklist-2026-08.md)

| Row | Meaning for “integration OK” |
|-----|------------------------------|
| **B** Tor OFF clearnet | Must Pass (you already see this class locally) |
| **A** Tor ON · Ready · no onion | Honesty — no CF thrash when armed (needs **Ready** = bootstrap 100%) |
| **C** sticky open | Lab `:7000` or onion via gateway tunnel |

**Tor-only Verified** = A + B + C. **Production Tor-ready** also needs **T5-3** live onion (ops not provisioned yet).

## Tester boot (minimal)

1. `pnpm dev:desktop:online` (co-starts gateway) or `pnpm dev:tor-gateway` + desktop.  
2. Tor OFF → confirm public relays open / DM smoke (**B**).  
3. Tor ON → wait until Security shows **Ready** / lifecycle bootstrapped (not Warming stuck).  
4. Then run **A** (empty onion pool honesty) and **C** (lab or onion).

If they never leave Warming and notice.log shows TLS_ERROR to many hosts → their network is blocked too; not an app regression.

## Still open (not required to invite private testers)

- T5-3.0 ops design Accept → T5-3.1 real onion URL  
- Bridges UX (optional for censored networks)  
- Public promotion / Tor Verified marketing
