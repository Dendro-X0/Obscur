# Investigation — Tor enable kills clearnet; gateway never co-starts

**Date (UTC):** 2026-08-08  
**Status:** Findings Ready  
**Parents:** [tor-t5-stability-latency-charter-2026-08.md](./tor-t5-stability-latency-charter-2026-08.md) · [tor-t5-tor-viable-pool-design-2026-08.md](./tor-t5-tor-viable-pool-design-2026-08.md) · [tor-t5-l3-soak-checklist-2026-08.md](./tor-t5-l3-soak-checklist-2026-08.md)  
**Maintainer evidence:** Security Tor ON · `RUNTIME: GATEWAY OFFLINE` · log `tor gateway unreachable at http://127.0.0.1:17950` · Relays all disabled / 0 open sockets

```text
HANDOFF ATOMIC STEP:  Tor integration redesign (post T5-1/2 UX break)
PAUSED / CANCELLED:   Community · AUTH-SESSION
CANONICAL OWNER:      obscur-tor-gateway lifecycle · relay-provider Tor dial gate · Security Tor toggle
PROOF BEFORE DONE:    Investigation accepted → redesign charter Accepted → named slices
OUT OF SCOPE:         Community · AUTH-SESSION · UI→:9050 · claiming Tor Verified
```

## Symptom (observed)

| Surface | Observation |
|---------|-------------|
| Security → Tor | Toggle **Enabled** · badge **Stopped** · `GATEWAY OFFLINE` · bootstrap **IDLE** |
| Tor log | `tor gateway unreachable at http://127.0.0.1:17950 — run pnpm dev:tor-gateway` |
| Relays | All cards **DISABLED** · open sockets **0** · communication dead vs prior Mixed adapters Pass |
| Dev stack | `pnpm dev:desktop:online` running · **no** `tor-gateway` in that stack |

## Root causes (ordered)

### R1 — Gateway is a separate process not owned by desktop online stack (primary)

- Desktop `start_tor` **only** HTTP-calls `obscur-tor-gateway` (`tor.rs`). It never spawns `tor.exe` (correct R4).  
- `scripts/dev-workspace-stack.mjs` / `dev:desktop:online` does **not** start `pnpm dev:tor-gateway`.  
- Result: preference ON → `start_tor` fails → UI shows gateway offline forever unless maintainer opens a second terminal.

### R2 — Dial subtraction keys off preference (`configured`), not lifecycle Ready (contract drift)

T5-0 design: Tor dial pool subtraction when **Tor ON + bootstrap ready**.  
T5-2 impl (`relay-provider.tsx`): `torPreferenceOn = torStatus.configured` → subtract CF / empty pool as soon as preference is saved.

| State | Intended (T5-0) | Actual (T5-2 wire) |
|-------|-----------------|--------------------|
| Preference ON · gateway down | Keep honesty; do not silently clearnet — **but** clearnet should remain until Ready **or** explicit fail-closed UX | Preference ON → empty Tor-viable pool immediately → **no CF dials** while Tor never becomes Ready |
| Preference ON · Ready | Tor-viable only | Same (if Ready ever arrives) |

So enabling Tor **without** a running gateway **removes** the working Mixed adapters clearnet path and puts nothing in its place.

### R3 — Fail-closed without a recovery owner

Invariants correctly forbid silent clearnet cheat when Tor is Required and Ready. Missing product states:

- **Warming** — preference ON, gateway starting, clearnet still carrying DMs (optional policy)  
- **Tor Required armed** — only after `lifecycleReady`  
- **Degraded** — preference ON, gateway down → restore clearnet **or** block with one CTA (“Start Tor gateway” / auto-spawn)

Today: preference ON + gateway down ≈ **dead network** with a log line.

### R4 — Stale Security copy

Still says: “relay WS still clearnet until later.” That is false after Slice 4b + T5-2 and misleads when diagnosing disconnects.

### R5 — Relays UI noise (secondary)

- Badge **Disabled** + role **Disabled** → “DISABLED DISABLED” when `enabled === false`.  
- `websocket_error` may still appear if detail path bypasses translate (metrics card) or stale shell.

Whether every row was flipped `enabled: false` by a separate action vs display-only needs a follow-up; the **dial pool empty + gateway offline** alone is enough to kill communication.

## Mental simulation (user action)

1. Mixed adapters · Tor OFF · primal/damus open · DM works.  
2. User enables Tor in Security.  
3. `save_tor_settings(true)` → `configured=true` → provider subtracts CF.  
4. `start_tor` → gateway unreachable → Error/Stopped.  
5. No onion configured → Tor-viable pool empty.  
6. Open sockets → 0. User concludes “Tor broke everything.”

## What is **not** the primary fix

- Re-arming UI SOCKS (`UI_PROCESS_MAY_DIAL_VIA_SOCKS`)  
- Treating CF publics as Tor SLA  
- Patch-only reconnect thrash without lifecycle ownership  
- Big-bang Arti rewrite as the first step

## Recommended path

See [tor-integration-redesign-charter-2026-08.md](./tor-integration-redesign-charter-2026-08.md) — **lifecycle-first** redesign (co-start gateway + Ready-gated dial policy), not a greenfield rewrite of mesh/Nostr.

## Claim language

| May say | When |
|---------|------|
| Investigation Ready | This file |
| Fixed | Named L3: Tor toggle ON with gateway co-started · ≥1 path working · Tor OFF clearnet OK |
| Rewritten | Only after redesign charter Accepted and slices land |
