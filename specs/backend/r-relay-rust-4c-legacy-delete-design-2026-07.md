# Design — R-RELAY-RUST-4c delete `enhanced-relay-pool-legacy` product owner

**Status:** L1 Pass · 2026-07-30  

**Prior:** [RUST-4b quarantine](./r-relay-rust-4b-legacy-quarantine-design-2026-07.md) · L3-product + Tauri UI soak Pass  
**Charter:** RUST-4 tombstone complete when product import graph has no legacy orchestrator

---

## Session gate

```text
HANDOFF ATOMIC STEP:  RUST-4c delete legacy file when web owner exists
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNER:      useConduitMeshRelayPool (UI pool) · subtracted/kernel publish ports
PROOF BEFORE DONE:    L1 vitest contracts + pool-hook + reliability relocate
OUT OF SCOPE:         community · RUST-5 SSH/offline · claim public Nostr fixed
```

---

## Preconditions (met)

| Check | Evidence |
|-------|----------|
| Desktop mesh L3 | L3-product + Tauri UI soak Pass |
| Native never selects legacy hook | RUST-4b `!hasNativeRuntime()` |
| Web UI non-legacy owner | `useConduitMeshRelayPool` (browser WS + mesh) |

## Subtraction plan

| Retire | Remain |
|--------|--------|
| `enhanced-relay-pool-legacy.ts` as product module name | `useConduitMeshRelayPool` for UI pool (web + native default) |
| `useTransportKernelRelayPool` → legacy runtime re-export | Re-export mesh pool instead |
| Legacy branch in `relay-pool-hook-port` | Mesh-only (or mesh + kernel-as-mesh) |
| Legacy standalone as web EVENT owner | Slim `relay-browser-standalone-publish.ts` (extract publish helpers only) |

**Rename is not enough** — product hooks must not call the orchestrator. Reliability tests may keep a **test-local** runtime module if needed, not a product export.

## Implementation slices (this file = one atomic)

1. Point `use-transport-kernel-relay-pool` at `useConduitMeshRelayPool`
2. `shouldUseLegacyRelayPoolHook` → always `false`
3. Remove legacy import/branch from `relay-pool-hook-port`
4. Extract `publishToRelayStandalone` / `publishToUrlsStandalone` (+ minimal short-lived runtime) to `relay-browser-standalone-publish.ts`
5. Retarget standalone ports + reliability tests off legacy filename
6. Delete `enhanced-relay-pool-legacy.ts`
7. Update engine-lab / publish-owner contracts

## Proof

| Layer | Command |
|-------|---------|
| L1 | vitest pool-hook · publish ports · RUST-4c contract · reliability (if kept) |
| L3 | Already Pass — do not re-claim |

## Claim language

| May say | When |
|---------|------|
| RUST-4c Pass / legacy product file deleted | L1 green + file gone |
| Web transport fixed | Not claimed without web L3 |

---

## Evidence (L1 Pass)

| Check | Result |
|-------|--------|
| `enhanced-relay-pool-legacy.ts` (hooks) | Absent |
| Product UI pool | `useConduitMeshRelayPool` only via `relay-pool-hook-port` |
| Browser standalone | `relay-browser-pool-runtime.ts` (non-product) |
| `shouldUseLegacyRelayPoolHook` | Always `false` |
| Vitest | 10 files / 61 tests Pass |

```bash
pnpm -C apps/pwa exec vitest run \
  app/features/transport-kernel/transport-kernel-pool-hook-port.test.ts \
  app/features/relays/services/relay-publish-owner.contract.test.ts \
  app/engine-lab/legacy-subtraction-w39.contract.test.ts \
  app/engine-lab/transport-engine-w11.contract.test.ts \
  app/engine-lab/transport-engine-w0.contract.test.ts \
  app/features/groups/services/path-b-b2-1-exit.contract.test.ts \
  app/features/relays/hooks/enhanced-relay-pool.reliability.test.ts \
  app/features/relays/hooks/relay-standalone-publish-port.test.ts \
  app/features/relays/hooks/relay-standalone-publish-port-subtracted.test.ts \
  app/engine-lab/legacy-subtraction-b5-exit.contract.test.ts
```

**Not claimed:** web transport L3 · public Nostr fixed · full delete of browser WS runtime (renamed/non-product only).
