# Checklist — Tor T5 L3 soak (post TI land)

**Date (UTC):** 2026-08-09  
**Status:** Ready for maintainer / external runtime on **Tor-capable** network  
**Parents:** [tor-verified-soak-charter-2026-08.md](./tor-verified-soak-charter-2026-08.md) · [tor-ti-land-silo-charter-2026-08.md](./tor-ti-land-silo-charter-2026-08.md) · [tor-t5-tor-viable-pool-design-2026-08.md](./tor-t5-tor-viable-pool-design-2026-08.md)

```text
HANDOFF ATOMIC STEP:  Tor Verified soak (option C) — A + B + C
PAUSED / CANCELLED:   AUTH-SESSION · this-host Tor Ready (env)
CANONICAL OWNER:      Desktop Tauri + gateway · Relays / Security honesty
PROOF BEFORE DONE:    Named Pass/Fail rows; Verified only if A+B+C
OUT OF SCOPE:         Invent onion · claim Verified on blocked LAN · T5-3 live ops
```

## Preconditions

| Item | Expected |
|------|----------|
| Network | **Tor-capable** (bootstrap can reach 100%) — not the blocked maintainer LAN |
| Build | Packaged or `dev:desktop:online` with TI land (`5d7cd8cd`+) |
| Gateway | Co-started or `pnpm dev:tor-gateway` → bootstrap **100%** (`lifecycleReady`) |
| Settings | In-app Tor toggle / tor_settings |
| Relays | Default Stable publics enabled unless a step says otherwise |
| Must **not** | Mark Ready on SocksPort alone · Docker-only as sole end-user Tor proof |

## Matrix

### A — Tor ON · empty Tor-viable pool (honesty)

| # | Check? | Action | Pass |
|---|--------|--------|------|
| A1 | **Yes** | Tor **ON** · gateway Ready · **no** `….onion` | No CF thrash / no endless CONNECTING to nos/primal/damus |
| A2 | **Yes** | Settings → Relays / Security copy | Honesty: Tor on · CF unreliable · add onion / turn Tor off |
| A3 | **Yes** | Shell open-socket counts | **0** for CF publics; not “ISP blocked” as primary story |
| A4 | Optional | Desktop log | No sustained Tor tunnel to wss://nos.lol (etc.) after settle |

**Exit A:** Honesty Pass ≠ Tor Verified alone.

### B — Tor OFF · clearnet regression

| # | Check? | Action | Pass |
|---|--------|--------|------|
| B1 | **Yes** | Tor **OFF** | Pool dials Default Stable publics again |
| B2 | **Yes** | ≥1 public WS **OPEN** | Same class as clearnet Pass |
| B3 | Preferred | DM smoke | Send/receive or media still OK |

**Exit B:** Clearnet unbroken — required for Verified.

### C — Tor ON · sticky open

Pick **one** (prefer onion for end-user claim):

| Path | Check? | Setup | Pass |
|------|--------|--------|------|
| **C-onion** | **Yes** (preferred) | Real `ws(s)://….onion` · Tor ON · Ready | ≥1 sticky **OPEN** via gateway |
| **C-lab** | Lab only | Lab WS only · Tor ON · Ready | Sticky OPEN — **not** production Tor-ready |

| # | Check? | Action | Pass |
|---|--------|--------|------|
| C1 | **Yes** | Idle **≥2 min** after open | Socket stays open (no reconnect storm) |
| C2 | **Yes** | Relays panel | Honest open counts |

**Exit C:** Sticky Pass — required for **Tor-only Verified** with A + B.

## Claim language

| Claim | Requires |
|-------|----------|
| T5 honesty **L3 Pass** | A Pass |
| Clearnet regression **L3 Pass** | B Pass |
| Tor sticky **L3 Pass** | C Pass |
| **Tor-only Verified** | A + B + C Pass + handoff stamp |
| Production Tor-ready | Verified + **T5-3** live onion |

## Evidence paste

```text
T5 L3 / Tor Verified:
  A honesty: Pass|Fail — <notes>
  B Tor OFF clearnet: Pass|Fail — <notes>
  C sticky: Pass|Fail — path=onion|lab — <notes>
  Network: <capable net description>
  Surface: packaged|dev-desktop-online
  Claim: honesty-only | Verified | none
```

## Agent limits

Do **not** mark Verified from unit tests or from the blocked maintainer LAN. Desktop UI + gateway lifecycle on a capable network are source of truth.
