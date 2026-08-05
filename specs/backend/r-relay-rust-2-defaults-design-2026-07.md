# Design — R-RELAY-RUST-2 product defaults (Nostr opt-in)

**Status:** **SUPERSEDED** for product boot · 2026-08-02  
**Superseded by:** [prod-first-multi-transport-mandate-2026-08.md](./prod-first-multi-transport-mandate-2026-08.md) (public Default Stable boot; Local Dev Mesh opt-in)  
**Charter:** [r-relay-rust-mesh-charter-2026-07.md](./r-relay-rust-mesh-charter-2026-07.md)  
**Prior:** RUST-1 L3-lab Pass

> **Do not implement RUST-2 boot defaults.** Cold/reset product default is again **public Nostr (Default Stable)**. Private/local packs remain selectable.

---

## Goal (historical)

Cold / reset relay list must **not** require public Nostr (damus/primal) for boot. Private/local pack is the product default; public packs remain selectable.

## Changes (smallest)

| Surface | Change |
|---------|--------|
| `use-relay-list` `DEFAULT_RELAYS` | = `local_dev_mesh` only (`ws://localhost:7000` enabled). No public WSS enabled by default |
| `transport-preset-catalog` | Export `PRODUCT_BOOT_TRANSPORT_PRESET` = `LOCAL_DEV_MESH_PRESET`; reorder groups **private_mesh first**; hybrid comment: not boot default |
| Storage | Existing `relay_list.v2` unchanged; **reset** / missing key → new default |
| UI copy | Rely on existing preset i18n; no Dev Lab |

## Mental simulation

New profile → Settings shows local mesh active → soft connect error if `:7000` down (honest) → user may Apply `default_stable` for public opt-in.

## Proof

L1: catalog tests (group order, boot preset) · use-relay-list / preset-match if they assert old default  
Not claimed: L3-product Docker · public Nostr fixed
