# Design — Truth-map refresh + product publish inject pin (no UI)

**Status:** Implementing · 2026-07-31  
**Prior:** [backend-parallel-path-audit-2026-07.md](./backend-parallel-path-audit-2026-07.md)

---

## Session gate

```text
HANDOFF ATOMIC STEP:  Truth-map refresh + transport inject L1 pin
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNER:      docs/encyclopedia truth map · relay-pool-hook-port · transport-kernel-publish-port
PROOF BEFORE DONE:    Docs updated · vitest product-publish-inject.contract.test.ts
OUT OF SCOPE:         UI feature edits · group db_* migrate · deleting browser-pool file yet
```

---

## Goal

Stop wrong-path maintenance: encyclopedia owners match release/parity backend. Pin L1 that **product UI pool** = conduit mesh only; **native** never uses legacy browser standalone publish.

---

## Facts (audit)

| Surface | Owner today |
|---------|-------------|
| Product `useRelayPool` → `useRelayPoolRuntime` | `useConduitMeshRelayPool` (RUST-4c) |
| Native `publishToUrlsStandalone` | Transport-kernel path (`shouldUseLegacyStandaloneRelayPublish` = `!hasNativeRuntime()`) |
| Host publish shim / authority | Requires Dev Lab (always false on product) |
| `relay-browser-pool-runtime` | Web/non-product residue only |
| Docs truth map / module index | Still name `enhanced-relay-pool` — **lie** |

---

## Changes

### 1. Truth map + module owner index (docs)

Update canonical owner rows:

| Lifecycle | Canonical owner |
|-----------|-----------------|
| Auth boot / cold+F5 restore | `auth-kernel-boot-owner` + Rust `auth_boot_snapshot` |
| Profile scope | `desktop-profile-runtime` |
| DM persist read/write | `@obscur/dm-engine` via `engine_invoke` |
| Product relay pool / publish (desktop) | `@obscur/conduit-mesh` via `useConduitMeshRelayPool` |
| Transport publish policy | `transport-kernel-publish-port.ts` |
| Persistence vault/call/search | `persistence.*` engine methods |
| Groups / community SQLite | **PAUSED** — bare `db_*` (not canonical) |

Mark `enhanced-relay-pool` / browser runtime as **non-product residue**.

### 2. L1 contract (code · no UI)

New: `apps/pwa/app/features/relays/services/product-publish-inject.contract.test.ts`

Assert:

- `relay-pool-hook-port.ts` wires `useConduitMeshRelayPool` only  
- `shouldUseLegacyStandaloneRelayPublish` body is `!hasNativeRuntime()`  
- `shouldRouteHostTransportPublish()` is false under product (Dev Lab off)  
- No `enhanced-relay-pool-legacy` file  

### 3. Explicit non-goals

- Delete `relay-browser-pool-runtime.ts` (web may still need)  
- Community un-pause  
- UI mock-pool toggle removal (optional later)

---

## Proof

```bash
pnpm -C apps/pwa exec vitest run \
  app/features/relays/services/product-publish-inject.contract.test.ts \
  app/features/relays/services/relay-publish-owner.contract.test.ts
```

---

## Next

Subtract invite-manager / community publish from browser-shaped standalone when community un-paused · or delete Dev Lab tree · or R1 hydrate shrink.
