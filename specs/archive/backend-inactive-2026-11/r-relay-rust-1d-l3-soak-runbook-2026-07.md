# R-RELAY-RUST-1d — L3 soak runbook (local / private)

**Status:** **L3-lab Pass** · **L3-product Pass** · 2026-07-30  
**Does not claim:** public Nostr fixed · packaged Tauri UI `engine_invoke` soak (optional)

## Evidence (lab)

| Check | Result |
|-------|--------|
| In-process Nostr WS mock (no damus) | Pass |
| Mesh configure → active local URL only | Pass |
| Snapshot healthy + `meshSchedulerOwnsFailover` | Pass |
| EVENT → OK publish contract | Pass |
| Reject `wss://relay.damus.io` outside mesh set | Pass |
| Command | `cargo test --lib mesh::l3_soak::` → **1/1** |
| Source | `apps/desktop/src-tauri/src/mesh/l3_soak.rs` |

## Evidence (product — Docker `:7000`)

| Check | Result |
|-------|--------|
| `pnpm dev:relay:docker` · `infra-nostr-relay-1` | Pass |
| REQ + signed EVENT → OK | Pass |
| Mesh configure / dialect escape / healthy dial | Pass |
| Command | `node scripts/l3-mesh-product-soak.mjs` · `cargo test --lib mesh::l3_product::` |
| Handoff | [r-relay-rust-l3-product-2026-07-30.md](../../docs/handoffs/r-relay-rust-l3-product-2026-07-30.md) |

## Product soak steps

1. `pnpm dev:relay:docker` → `ws://127.0.0.1:7000`
2. `node scripts/l3-mesh-product-soak.mjs`
3. `cargo test --lib mesh::l3_product::` (from `apps/desktop/src-tauri`)
4. Optional: Desktop UI `configureMeshConduits` / `publishMeshEnvelope` via Settings apply

## Pass language

| Claim | When |
|-------|------|
| L3-lab Pass | cargo `mesh::l3_soak` green |
| L3-product Pass | Docker `:7000` + soak script / `l3_product` green |
| RUST-1 product-fixed (wire) | L3-product Pass |
| Packaged UI fixed | Optional Tauri `engine_invoke` soak |
