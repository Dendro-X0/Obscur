# Conduit Mesh C5 — pool orchestrator retirement charter

**Status:** **Landed**  
**Last updated:** 2026-06-26  
**Parent:** [conduit-mesh-c4-adapter-wiring-charter.md](./conduit-mesh-c4-adapter-wiring-charter.md)  
**W53 reference:** [transport-engine-w53-maintainer-smoke-runbook.md](./transport-engine-w53-maintainer-smoke-runbook.md)

---

## Slice goal

Retire **pool-as-orchestrator** for the archived UI harness when `NEXT_PUBLIC_OBSCUR_CONDUIT_MESH_POOL=1`: route `useRelayPoolRuntime` through **Conduit Mesh** instead of `enhanced-relay-pool-legacy` runtime. Prove **W53 smoke parity** headless (quorum publish + lane switch).

---

## In scope

| Deliver | Detail |
|---------|--------|
| `runW53SmokeParityHarness` | Headless quorum + lane-switch scenarios |
| `mapMeshSnapshotToRelayActivitySnapshot` | Supervisor/badge parity subset |
| `createConduitMeshRelayPoolRuntime` | Non-React pool surface backed by mesh |
| `useConduitMeshRelayPool` | UI hook (archived harness only) |
| `conduit-mesh-pool-hook-port` | Tri-route: legacy / mesh / kernel pool |

## Out of scope

- Full `EnhancedRelayPoolResult` Nostr subscribe/REQ parity
- W53 `Decision: PASS` (maintainer)
- Physical deletion of `-legacy.ts`

---

## Proof

| Layer | Command |
|-------|---------|
| L1 | `pnpm verify:conduit-mesh-c5` |

---

## Next slice

**C6** — optional `nostr_ws` driver (compatibility adapter, not required for mesh proof).
