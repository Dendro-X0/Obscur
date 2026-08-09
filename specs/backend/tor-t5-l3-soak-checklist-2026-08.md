# Checklist — Tor T5 L3 soak (post T5-1/T5-2)

**Date (UTC):** 2026-08-08  
**Status:** Ready for maintainer runtime  
**Parents:** [tor-t5-stability-latency-charter-2026-08.md](./tor-t5-stability-latency-charter-2026-08.md) · [tor-t5-tor-viable-pool-design-2026-08.md](./tor-t5-tor-viable-pool-design-2026-08.md)

```text
HANDOFF ATOMIC STEP:  Tor T5 L3 soak (honesty + clearnet + optional sticky)
PAUSED / CANCELLED:   Community · AUTH-SESSION
CANONICAL OWNER:      Desktop Tauri + gateway :17950 · Relays settings honesty
PROOF BEFORE DONE:    Named Pass/Fail rows below; do not claim Tor-only Verified without A–C
OUT OF SCOPE:         Community · AUTH-SESSION · shipping production onion (T5-3) · Arti
```

## Preconditions

| Item | Expected |
|------|----------|
| Build | Desktop shell with T5-1/T5-2 tree |
| Gateway | `pnpm dev:tor-gateway` → bootstrap **100%** (`lifecycleReady`) |
| Settings | `%APPDATA%/app.obscur.desktop/tor_settings.json` or in-app Tor toggle |
| Relays list | Default Stable publics (nos / primal / damus) enabled unless a step says otherwise |

## Matrix

### A — Tor ON · empty Tor-viable pool (honesty)

| # | Action | Pass |
|---|--------|------|
| A1 | Tor preference **ON** · gateway ready · **no** `ws://….onion` / allowlist host | NativeRelay does **not** dial nos/primal/damus (no CF thrash / no endless CONNECTING storm to publics) |
| A2 | Settings → Relays connectivity copy | Shows honesty: Tor on · CF unreliable · add onion / turn Tor off (or i18n key with same meaning) |
| A3 | Shell open-socket counts | Stay **0** for CF publics; do **not** show “ISP blocked” as primary story |
| A4 | Desktop log (optional) | No sustained `Tor tunnel connected wss://nos.lol` (or primal/damus) after pool settle |

**Exit A:** Honesty Pass does **not** equal Tor-only Verified (no sticky open yet).

### B — Tor OFF · clearnet regression

| # | Action | Pass |
|---|--------|------|
| B1 | Tor preference **OFF** | Pool dials Default Stable publics again |
| B2 | ≥1 public WS **OPEN** (maintainer UI) | Same class as prior clearnet Pass |
| B3 | DM smoke (optional but preferred) | Send/receive or media/call path still OK |

**Exit B:** Clearnet unbroken — required before any Tor Verified claim.

### C — Tor ON · sticky open (lab or onion)

Pick **one**:

| Path | Setup | Pass |
|------|--------|------|
| **C-lab** | Only `ws://localhost:7000` (or lab WS) enabled · Tor ON · gateway ready · lab relay up | ≥1 sticky **OPEN** · no CF dials |
| **C-onion** | Add `ws://….onion` (or `wss://`) Tor-viable · Tor ON · gateway ready | ≥1 sticky **OPEN** via gateway tunnel · DM smoke preferred |

| # | Action | Pass |
|---|--------|------|
| C1 | After open, idle **≥2 min** | Socket stays open (no reconnect storm) |
| C2 | Shell interactive | Relays panel / status honest open counts |

**Exit C:** Sticky open Pass — required for **Tor-only Verified** together with A + B.

## Claim language

| Claim | Requires |
|-------|----------|
| T5-2 honesty **L3 Pass** | A Pass |
| Clearnet regression **L3 Pass** | B Pass |
| Tor sticky **L3 Pass** | C Pass |
| **Tor-only Verified** | A + B + C Pass (evidence notes in handoff) |
| Production Tor-ready | Verified + **T5-3** onion ops (not this checklist alone) |

## Evidence to paste into handoff

```text
T5 L3:
  A honesty: Pass|Fail — <notes>
  B Tor OFF clearnet: Pass|Fail — <notes>
  C sticky: Pass|Fail — path=lab|onion — <notes>
  Claim: honesty-only | Verified | none
```

## Agent limits

Agents may prepare this checklist and re-run L1. Agents must **not** mark Verified from unit tests alone. Desktop UI + Tor gateway lifecycle are source of truth for A–C.
