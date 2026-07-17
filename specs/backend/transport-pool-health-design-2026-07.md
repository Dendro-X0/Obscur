# Transport pool health — design (v1.9.14 P14-P)

**Date:** 2026-07-17  
**Investigation:** [transport-pool-presets-investigation-2026-07.md](./transport-pool-presets-investigation-2026-07.md)  
**Scope:** Mesh pool → supervisor → Settings badge truth (no legacy pool deletion)

---

## Problem

Default desktop path uses Conduit Mesh pool. Settings badge could show **healthy** when:

1. HTTP mesh URLs were treated as writable without probe (`isHttpMeshPoolUrl` inflation).
2. Mesh `degradedConduitIds` were mapped to legacy `fallbackRelayUrls`, corrupting supervisor readiness.
3. WS-only `openCount` ignored HTTP-only publish-ready conduits.
4. Missing `lastInboundEventAtUnixMs` on mesh-only paths triggered false stale-event degradation.

---

## Fix (this slice)

| Layer | Change |
|-------|--------|
| `map-mesh-snapshot-to-relay-activity.ts` | Probe-backed counts; `publishReadyRelayUrls`; no degraded→fallback mapping; evidence timestamps |
| `use-conduit-mesh-relay-pool.ts` | Remove `Math.max` inflation; writable URLs from activity snapshot; `reconnectAll` → re-probe |
| `relay-runtime-status.ts` | `effectiveConnectedCount = max(open, writable)`; publish evidence for freshness |
| Settings models | Pass `lastSuccessfulPublishAtUnixMs`; quick health uses writable count |

---

## Acceptance

- [ ] Partial pool (1 of N publish-ready) → Settings badge **degraded**, not healthy
- [ ] Dead HTTP gateway → writable count 0 → **offline/unavailable**
- [ ] L1: `map-mesh-snapshot-to-relay-activity.test.ts` + `relay-runtime-status.test.ts` + contract test

---

## Out of scope

- Tri-route hook subtraction (P4)
- Transport-engine classifier rewrite
- Automated L3 failover soak gate
