# Investigation — Public relay connect Fail (damus ERROR · standby DISCONNECTED)

**Status:** Investigation complete · **R-RELAY charter ACTIVE** — [r-relay-transport-refactor-charter-2026-07.md](./r-relay-transport-refactor-charter-2026-07.md) · next = R-RELAY-0 study (no product code yet)  
**Date:** 2026-07-30  
**Evidence:** Maintainer screenshots — DM TRANSPORT ADAPTERS + Settings ALL · harsh toast may be pre soft-UX shell

---

## Session gate

```text
NEXT ATOMIC STEP:     R-RELAY-0 integration study (chartered)
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNER:      relay-runtime-supervisor + failover + presets (see charter)
OUT OF SCOPE UNTIL R-RELAY-0:  Product failover/pool code
```

---

## What the screenshots show

| Relay | Role | State |
|-------|------|--------|
| `wss://relay.damus.io` | ACTIVE TRANSPORT | ERROR / DISCONNECTED · `websocket_error` |
| `wss://nos.lol` | STANDBY | DISCONNECTED · not in active pool |
| `wss://relay.primal.net` | STANDBY | DISCONNECTED · TLS handshake eof (toast probe) |

Standby copy is **by design** until failover promotes or user reorders/selects primary. Active primary failing while standbys stay cold means either:

1. **Upstream** — damus/primal/CF TLS/503 (probe already: dns=ok tcp=ok ws=fail)  
2. **Failover not promoting** — supervisor/policy gap (R-RELAY keep-set)  
3. **Redundancy off / single active** — pool never opens standby sockets until failover fires  
4. **Stale profile preset** — stored list ≠ current Mixed/redundancy defaults (Apply preset does not rewrite old profiles silently)

Harsh red toast with full `[RelayProbe]` dump means the running shell is **not** yet on the soft amber UX rebuild (or old process still alive).

---

## Why agents must not patch-debug here

Handoff forbids **R-RELAY rewrite**. Past loops (render-depth ping-pong, dual owners) are exactly why that band is frozen. Claiming “fixed public relays” without L3 failover evidence + charter would violate claim language.

---

## Operator mitigation (no code)

1. Rebuild/restart desktop so soft connect toast lands (if desired).  
2. Settings → transport presets → **Apply** a public/Mixed pack with **redundancy** so multiple endpoints are in the active pool.  
3. Manually set primary to `nos.lol` (or reorder above damus) and Retry.  
4. If all public WSS fail (TLS), use **local relay** (`ws://127.0.0.1:7000`) for product soak — not a public-net fix.  
5. Confirm Tor is off for this profile if presets assume clearnet.

---

## Maintainer charter options (pick one)

| Option | Next |
|--------|------|
| **A** | Un-pause **R-RELAY** narrow slice: “primary ERROR must promote standby within N seconds” — design → L3 before claim |
| **B** | Hold public Nostr; soak on local `:7000` only |
| **C** | AUTH-KERN / community (current handoff fork) — leave relays as-is |

---

## Claim

| May say | |
|---------|---|
| Diagnosed | Yes — active primary failed; standbys not carrying traffic |
| Fixed | **No** |
| Verified | **No** |
