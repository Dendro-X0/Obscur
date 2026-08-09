# Charter — Tor Verified soak (option C)

**Date (UTC):** 2026-08-09  
**Status:** **Active** — maintainer chose **C**  
**Parents:** [tor-ti-land-silo-charter-2026-08.md](./tor-ti-land-silo-charter-2026-08.md) · [tor-t5-l3-soak-checklist-2026-08.md](./tor-t5-l3-soak-checklist-2026-08.md) · [tor-integration-external-test-readiness-2026-08.md](./tor-integration-external-test-readiness-2026-08.md)

```text
HANDOFF ATOMIC STEP:  Tor Verified soak A+B+C on Tor-capable network
PAUSED / CANCELLED:   AUTH-SESSION · this-host Tor Ready (env TLS stall)
CANONICAL OWNERS:     apps/tor-gateway · dial policy · Security Tor lifecycle UX
PROOF BEFORE DONE:    Checklist A+B+C Pass stamped in handoff
OUT OF SCOPE:         Claim Verified on blocked LAN · invent *.onion · move v1.9.15 · T5-3 live ops
```

## Why C now

Tor TI-1…4 **landed** (`5d7cd8cd`). Architecture is ready for private verification. This maintainer LAN **cannot** bootstrap Tor past ~14% (env/DPI). **Tor Verified** requires a **Tor-capable** network (another LAN, mobile hotspot, or bridges).

## What “Tor Verified” means

Canonical matrix: [tor-t5-l3-soak-checklist-2026-08.md](./tor-t5-l3-soak-checklist-2026-08.md)

| Row | Must | Notes |
|-----|------|--------|
| **B** | Tor OFF clearnet | Already Pass-class on this host; re-confirm on soak machine |
| **A** | Tor ON · Ready · empty onion pool | No CF thrash; honesty copy — needs bootstrap **100%** |
| **C** | Sticky OPEN ≥2 min | Prefer **C-onion** if a real HS exists; **C-lab** only proves lab sticky, not end-user Tor |

| Claim | Requires |
|-------|----------|
| Tor-only **Verified** | A + B + C Pass + handoff stamp |
| Production Tor-ready | Verified + **T5-3** live onion (not chartered here) |

## Surface

| Preferred | Acceptable |
|-----------|------------|
| Packaged desktop that includes Tor gateway sidecar / spawn | `pnpm dev:desktop:online` (co-starts gateway) on capable net |

Do **not** use Docker local relay as the only sticky path if the goal is end-user Tor Verified — same honesty as CU-P1.

## This host

| Item | Status |
|------|--------|
| Bootstrap | Stalls ~10–14% · mass TLS_ERROR |
| Tor OFF | Clearnet OK |
| Agent action | Prepare charter + checklist · **do not** mark Verified from here |

## Agent rules

| Allowed | Forbidden |
|---------|-----------|
| Checklist prep · handoff queue · L1 | Marking Verified without A+B+C evidence |
| Investigation if Fail on capable net | Fake Ready · invent onion · UI SOCKS |
| | Re-tag 1.9.15 |

## Next after stamp

| Result | Next |
|--------|------|
| A+B+C Pass | Handoff: Tor Verified · then (D) version band or T5-3.1 |
| Warming forever + TLS_ERROR | Network still blocked — not app Fail |
| A or C Fail with Ready | Investigation → CU-style Tor defect slice |
