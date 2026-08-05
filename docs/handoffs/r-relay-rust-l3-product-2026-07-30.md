# L3-product — R-RELAY-RUST mesh vs Docker `:7000`

**Status:** **PASS** · 2026-07-30T15:23Z  
**Stack:** Docker Desktop · compose project `infra` · `nostr-relay-1` · `ws://127.0.0.1:7000`  
**Runbook:** [r-relay-rust-1d-l3-soak-runbook-2026-07.md](../../specs/backend/r-relay-rust-1d-l3-soak-runbook-2026-07.md)

---

## Session gate

```text
HANDOFF ATOMIC STEP:  L3-product (:7000 + mesh)
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNER:      mesh runtime + nostr_ws dialect + RelayPool wire
PROOF:                scripts/l3-mesh-product-soak.mjs · cargo mesh::l3_product
OUT OF SCOPE:         public Nostr fixed · full UI Tauri engine_invoke soak (optional)
```

---

## Results

| Check | Result |
|-------|--------|
| Docker `infra-nostr-relay-1` listening | Pass |
| REQ probe → EOSE | Pass |
| Signed EVENT → OK (nostr-rs-relay) | Pass |
| Damus URL outside mesh-active rejected | Pass |
| `cargo test --lib mesh::l3_product::` | **1/1 Pass** |
| `cargo` mesh dialect + L3-lab | Pass |
| Script | `node scripts/l3-mesh-product-soak.mjs` → **PASS** |

---

## Claim language

| May say | When |
|---------|------|
| **L3-product Pass** (local mesh wire) | This file |
| Packaged desktop UI `engine_invoke` soak | Still optional — not run this pass |
| Public Nostr / transport “fixed” | **No** |

---

## How to re-run

1. Start Docker Desktop · `pnpm dev:relay:docker`
2. `node scripts/l3-mesh-product-soak.mjs`
3. `cargo test --lib mesh::l3_product::` (from `apps/desktop/src-tauri`)
