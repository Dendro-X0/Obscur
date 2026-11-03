# Design — relay-publish dual-path subtraction (relays-only · taxonomy close)

**Date (UTC):** 2026-08-04  
**Investigation:** [relay-publish-dual-path-subtraction-investigation-2026-08.md](./relay-publish-dual-path-subtraction-investigation-2026-08.md)  
**Pattern:** dm-persist dual-owner taxonomy FP close (2026-08)

---

## Contracts

| Concern | Owner |
|---------|--------|
| Product UI relay pool + Soft L3 DM publish | `useConduitMeshRelayPool` → `packages/obscur-conduit-mesh` runtime |
| Native standalone EVENT (non-pool callers) | `transport-kernel-publish-port` via `relay-standalone-publish-port` |
| Web-only standalone | Browser legacy — quarantine until W64 sign-off |
| Community publish | Frozen under `groups/**` PAUSED |

### Invariants

1. No second product pool orchestrator file (RUST-4c).  
2. Alias hooks (`useEnhancedRelayPoolRuntime`, `useTransportKernelRelayPool`, `useLegacyEnhancedRelayPool`) **must** re-export `useConduitMeshRelayPool` only.  
3. Do not open W64 physical deletion while sign-off is `BLOCKED`.  
4. Do not edit community publish files.

---

## Implement slice (smallest)

Extend `relay-publish-owner.contract.test.ts`:

1. Assert enhanced / transport-kernel alias files contain only the mesh re-export (no local publish body).  
2. Assert `shouldUseLegacyRelayPoolHook` remains `() => false`.  
3. Keep existing groups freeze + RUST-4c pins.

No product runtime behavior change expected → Soft L3 re-proof **not** required for this claim.

---

## Proof

| Layer | Command |
|-------|---------|
| L1 | `pnpm -C apps/pwa exec vitest run app/features/relays/services/relay-publish-owner.contract.test.ts app/features/relays/services/product-publish-inject.contract.test.ts` |
| L3 | Soft L3 already Pass 2026-08-04 — optional re-run after unrelated transport diffs |

### Claim language

| May say | When |
|---------|------|
| **Closed** (pool dual-owner taxonomy) | L1 green + investigation/design landed |
| Implemented (W64 deletion) | Maintainer sign-off + mechanical script |
| Fixed (publish dual-owner runtime) | Requires new L3 after a real path delete |

---

## Status

**Closed** (pool dual-owner taxonomy) — L1 Pass (`relay-publish-owner.contract.test.ts` + `product-publish-inject.contract.test.ts`)
