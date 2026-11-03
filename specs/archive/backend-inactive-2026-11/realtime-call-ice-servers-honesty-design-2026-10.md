# Design — ICE / STUN–TURN honesty (R4)

**Date (UTC):** 2026-10-19  
**Status:** Implemented (L1) · STUN default + optional operator TURN env · ice_config diagnostic  
**Parent:** [realtime-call-perf-stability-ux-investigation-2026-10.md](./realtime-call-perf-stability-ux-investigation-2026-10.md) · realtime-media P2 (no cloud media landlord)

```text
HANDOFF ATOMIC STEP: R3 done · charter R4 ICE honesty
PAUSED / CANCELLED: Twilio TURN landlord default · Claim NAT-proof calls · Soft L3 Fixed · video usable
CANONICAL OWNER:     realtime-call-ice-servers · main-shell RTCPeerConnection iceServers
PROOF BEFORE DONE:   L1 resolve helper · stunOnly/hasTurn · optional TURN from env
SURFACE:             diagnostics + operator env — no default paid TURN
```

## Problem

`RTCPeerConnection` uses two **public STUN** URLs only. Symmetric NAT / many corp nets need TURN. That limit is not named in code or diagnostics.

## Contract

### Defaults (unchanged behavior)

Keep Google + Twilio **STUN** (not TURN credentials) as built-in STUN list.

### Optional operator TURN

| Env | Meaning |
|-----|---------|
| `NEXT_PUBLIC_OBSCUR_ICE_TURN_URLS` | Comma-separated `turn:` / `turns:` URLs |
| `NEXT_PUBLIC_OBSCUR_ICE_TURN_USERNAME` | Optional username for all listed TURN URLs |
| `NEXT_PUBLIC_OBSCUR_ICE_TURN_CREDENTIAL` | Optional credential |

Empty / missing TURN env → STUN-only (today’s behavior).

### Resolver output

```ts
{
  iceServers: RTCIceServer[];
  stunOnly: boolean;   // true iff no TURN/TURNS entry
  hasTurn: boolean;
  turnUrlCount: number;
  stunUrlCount: number;
}
```

### Diagnostics

On peer connection create, emit once per connection:

`messaging.realtime_voice.ice_config` with `stunOnly`, `hasTurn`, `stunUrlCount`, `turnUrlCount` (never log credentials).

On RTC `failed`, existing interrupt path stays; log context may include `stunOnly` when known (via connection create snapshot / ref).

## Non-goals

- Shipping Obscur-hosted TURN
- Default Twilio TURN / any paid landlord
- ICE restart (separate from R2 grace)
- User-facing “configure TURN” settings UI this slice

## Proof

L1: parse env fixtures → expected servers + honesty flags.  
Wire: `main-shell` uses resolver; no credential leakage in events.

_Last updated: 2026-10-19T10:05:00Z_
