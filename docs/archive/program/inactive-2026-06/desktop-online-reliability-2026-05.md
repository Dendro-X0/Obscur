# Desktop online reliability (maintainer lane)

**Status:** **Signed off** (maintainer QA 2026-05-29)  
**Dev command:** `pnpm dev:desktop:online`  
**Gate:** [phase3-desktop-online-gate.md](./phase3-desktop-online-gate.md)

---

## Scope (what “online” means)

| Subsystem | Pass when |
|-----------|-----------|
| Relay pool | Unlock is not blocked; relays connect in background; failures → degraded banner only |
| Account sync | Idle-deferred after unlock; never blocks shell |
| DM transport | Bidirectional send/receive under `dev:desktop:online` ([phase2](./phase2-desktop-dm-persistence-gate.md) P2-*) |
| Coordination (optional) | Membership directory polls without hammering localhost; manual G6-4 may defer on WebView loopback |

**Out of scope for this lane:** B1 outbound bots (operator-only), Android release signing, public promotion.

---

## Maintainer quick check (~15 min)

1. `pnpm dev:desktop:online` — unlock, sidebar nav, open a DM, send a message.
2. Settings → Relays — at least one `wss://` enabled; no permanent crash overlay after ~30s.
3. Optional workspace: `pnpm dev:relay` + operator setup — open Test 8; confirm coordination logs are not flooded (membership `/deltas` spaced, not per-frame).

Automated: `pnpm verify:phase3` · `pnpm verify:stability`

---

## Recent reliability fixes

| Area | Change |
|------|--------|
| Coordination directory | `refreshCoordinationMembershipDirectory` — 8s min spacing, in-flight dedupe, skip no-op saves |
| Loopback fetch | Browser fetch + localhost ↔ 127.0.0.1 retry (`community-coordination-fetch.ts`) |
| Membership poll | 30s base interval + exponential backoff on failures |
| DM nav | Display cache LRU (48 threads), coalesced hydrate retries, cache upgrades one-sided threads |
| Relay transport | Faster bootstrap (1.5s), standby probes (6s/30s), proactive primary failover, lower reconcile threshold |

---

## Deferred (not blocking desktop DM)

- G6-4 two-client coordination manual matrix
- B1 Test B1 live bot announcement
- Community send on coordination-only dev without writable relay
