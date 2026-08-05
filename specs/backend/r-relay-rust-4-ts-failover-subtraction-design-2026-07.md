# Design — R-RELAY-RUST-4 subtract TS failover product owner

**Status:** L1 Pass (4a demotion) · 2026-07-30  
**Charter:** [r-relay-rust-mesh-charter-2026-07.md](./r-relay-rust-mesh-charter-2026-07.md) RUST-4  
**Depends:** RUST-1c `meshSchedulerOwnsFailover` · RUST-3 dialect · preset→mesh wire

---

## Session gate

```text
HANDOFF ATOMIC STEP:  RUST-4 tombstone TS enhanced-relay-pool as product owner
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNER:      Rust mesh scheduler (failover) when meshSchedulerOwnsFailover
PROOF BEFORE DONE:    L1 vitest policy + contract · cargo mesh:: unchanged
OUT OF SCOPE:         Delete enhanced-relay-pool-legacy.ts · community publish · claim L3
```

---

## Goal

When Rust mesh has configured active endpoints (`meshSchedulerOwnsFailover=true`), **TS must not own primary failover**. `enhanced-relay-pool` remains a web/subscribe adapter and type surface — not the product failover orchestrator on desktop mesh scopes.

## Landed (4a)

| Piece | Location |
|-------|----------|
| Profile gate store | `mesh-scheduler-failover-gate.ts` |
| Policy suppress | `shouldAttemptPrimaryFailover({ meshSchedulerOwnsFailover })` |
| Apply configure writes gate | `apply-rust-mesh-configure.ts` |
| Supervisor + provider wire | `relay-runtime-supervisor` · `relay-provider` |
| TransportSnapshot flag | `mapRustMeshSnapshotToTransportSnapshot` |
| Contract | `relay-publish-owner.contract.test.ts` |

## Proof

| Layer | Result |
|-------|--------|
| L1 vitest (policy/gate/apply/supervisor/contract/map) | **Pass** (35+) |
| L1 cargo `mesh::` | **25/25** |
| L3 / file delete | **Not claimed** |

## Next

**RUST-4b** (optional): delete/quarantine `enhanced-relay-pool-legacy` after L3-product · or L3-product soak now.