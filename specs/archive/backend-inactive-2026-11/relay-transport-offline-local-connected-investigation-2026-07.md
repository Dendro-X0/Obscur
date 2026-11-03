# Investigation — TRANSPORT OFFLINE while local mesh is CONNECTED

**Status:** Complete — design next  
**Date:** 2026-07-31 (UTC)  
**Symptom:** Banner shows `TRANSPORT OFFLINE` / `0 writable · 0 subscribable` while `ws://localhost:7000` is CONNECTED (STANDBY) and public primary (e.g. damus) is DISCONNECTED  
**Handoff:** [`docs/handoffs/current-session.md`](../../docs/handoffs/current-session.md) — Wave A transport false-offline  
**Charter:** Operational community + relay connectivity (Wave A then Wave B soak)

---

## Session gate

```text
NEXT ATOMIC STEP:     Wave A — Transport false-offline (Hold PAUSED superseded)
PAUSED / CANCELLED:   COM-RUN-01 · COM-RUN-02 · O-2/O-4 · RIW-8 · Dev Lab as validation · AUTH-SESSION
CANONICAL OWNER:      active pool / DM transport scope / recovery metrics
PROOF BEFORE DONE:    L1 vitest + desktop evidence; public hosts probe-only
OUT OF SCOPE:         Fixing third-party Nostr hosts · COM-RUN-01 · production community un-pause
```

---

## Reproduce (from maintainer screenshots)

| Surface | Observed |
|---------|----------|
| Banner | TRANSPORT OFFLINE · `0 writable · 0 subscribable` |
| `wss://relay.damus.io` | ACTIVE TRANSPORT · DISCONNECTED |
| Other public | STANDBY · DISCONNECTED |
| `ws://localhost:7000` | CONNECTED · STANDBY (Local Dev Mesh / community candidate) |

Expected product honesty: when an enabled local mesh socket is open and writable, readiness must not report **0 writable** solely because the public primary is dead.

---

## Owner map

```text
enabled relays
  → classifyRelayTransportScope (relay-transport-scope.ts)
      public → DM transport URLs (resolveDmTransportRelayUrls)
      localhost:7000 → community_candidate
  → community candidates → customNodeRelayUrls (relay-custom-node-pool.ts)
  → mergeNostrPoolWithCustomNodeRelayUrls → sockets may open for local
  → DM ordered list → primary selection + resolveActivePoolRelayUrls
  → supervisor enabledRelayUrls ≈ active pool (basic: primary only)
  → getWritableRelaySnapshot(scoped) → writableRelayCount
  → readiness offline + copy (relay-readiness-copy.ts)
```

### Parallel paths that confuse the UI

1. **Socket presence ≠ DM metrics scope.** Local can be CONNECTED via custom-node merge while recovery metrics scope to the basic-mode active pool (`[damus]` only). Browser pool `getWritableRelaySnapshot(scoped)` filters out open local.
2. **Local excluded from DM ordered list by default.** `resolveDmTransportRelayUrls` only appends `ws://localhost:7000` when `isExperimentOnlineEnabled()`; loopback **HTTP** mesh is always appended, WS local-dev is not. Without that URL in the DM list, health hints / reconcile / primary failover cannot see it.
3. **Failover already exists** (`reconcilePrimarySelection` / `pickBestRelayUrl`) but only over `orderedEnabledUrls`. Invisible local ⇒ no promotion.

---

## Provider-down vs client false-offline

| Class | Meaning | This session |
|-------|---------|--------------|
| **Provider-down** | Machine cannot reach public host (TCP/WS fail) | TCP probe 2026-07-31: `relay.damus.io` / `nos.lol` / `relay.primal.net` / `localhost:7000` all **TCP_OK**. Public DISCONNECTED may still be WS/client/policy — **not** an app “fix” for third-party hosts. |
| **Client false-offline** | Local open + writable ignored in counts / active pool | **Confirmed by code path** above; matches screenshots. |

---

## Root cause (client)

**False offline** = product readiness scoped to a dead public primary while an enabled connected local mesh socket is outside DM transport reckoning and/or outside the basic active pool.

Not a second publish owner. Not a reason to mark public Nostr “fixed.”

---

## Design direction (smallest)

1. Always append **enabled** local-dev workspace WS (`ws://localhost:7000`) into the DM transport pool as fallback (same honesty as loopback HTTP mesh) — keep public URLs primary when healthy.
2. In **basic** mode: when primary has zero open/writable hints, promote the best open ordered URL into the active pool (and rely on existing reconcile to switch ACTIVE TRANSPORT).
3. L1: pool/failover + scope resolution. Desktop: local CONNECTED ⇒ not `0 writable` solely from dead public primary. Public hosts: probe record only.

---

## Claim language

| May say | When |
|---------|------|
| Transport false-offline fixed | Local CONNECTED counted/promoted; L1 + desktop evidence |
| Public Nostr fixed | **Never** from this slice if probe/WS show provider issues |
| Community un-paused | **Not** from Wave A |
