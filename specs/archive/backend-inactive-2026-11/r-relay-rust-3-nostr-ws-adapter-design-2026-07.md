# Design — R-RELAY-RUST-3 optional `nostr_ws` adapter under mesh

**Status:** L1 Pass · 2026-07-30  
**Charter:** [r-relay-rust-mesh-charter-2026-07.md](./r-relay-rust-mesh-charter-2026-07.md) RUST-3  
**Depends:** RUST-1 publish bridge · RUST-2 boot defaults · preset→mesh wire

---

## Goal

Public Nostr is **one** dialect adapter under the Rust mesh scheduler — not a parallel TS pool owner. Local and opt-in public packs share `nostr_ws` wire map; publish prefers private trust tiers before `public_untrusted`.

## Scope (this slice)

| In | Out |
|----|-----|
| `mesh/dialect` trait + `nostr_ws` adapter | Deleting TS `enhanced-relay-pool` (RUST-4) |
| Route `publishMeshEnvelope` through adapter | Claiming public relays always up |
| Publish URL order: private → public within mesh-active set | Full REQ subscribe port (later) |
| L1 cargo tests | L3 public soak (optional maintainer) |

## Landed

| Piece | Location |
|-------|----------|
| `DialectPort` + `DialectId` | `mesh/dialect/mod.rs` |
| `NostrWsDialect` order + publish | `mesh/dialect/nostr_ws.rs` |
| IPC via dialect | `engine_invoke_transport_publish_mesh_envelope` |
| Registry entries for trust order | `MeshRuntimeState::registry_entries` |

## Prefer-private publish order

Given mesh-active endpoints + registry trust tiers:

1. `operator_attested` / `user_configured` first  
2. Then `public_untrusted`  
3. Still only URLs in mesh-active set (no escape)

## Proof

| Layer | Command | Result |
|-------|---------|--------|
| L1 | `cargo test --lib mesh::` | **25/25 Pass** (incl. prefer-private + escape reject) |
| L3 public | Optional — Apply `default_stable` when hosts allow | **Not claimed** |

## Not claimed

- Public Nostr “fixed” / always reachable  
- TS `enhanced-relay-pool` tombstone (RUST-4)  
- Packaged-desktop L3-product