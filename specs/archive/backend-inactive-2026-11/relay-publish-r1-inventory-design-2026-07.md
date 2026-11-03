# Design — relay boundary R1 inventory (raw `publish_event` vs kernel)

**Status:** Implemented (L1) · 2026-07-30  
**Parent:** [engine-invoke-boundary-subtract-design-2026-07.md](./engine-invoke-boundary-subtract-design-2026-07.md)  
**TS owners:** [relay-publish #1–3](./relay-publish-lab-shim-tombstone-design-2026-07.md)

---

## Session gate

```text
NEXT ATOMIC STEP:     Dual-owner subtract — relay R1 inventory
PAUSED / CANCELLED:   community · Dev Lab
CANONICAL OWNER:      transport-kernel publish on native (TS) · Rust dual still registered
PROOF BEFORE DONE:    L1 catalog asserts generate_handler dual registration + no product TS invoke("publish_event")
OUT OF SCOPE:         Deleting relay::publish_event · B3 db tombstone · L3 without rebuild
```

---

## Inventory target

| Path | Role |
|------|------|
| `publishToRelayStandalone` → transport-kernel | Product native EVENT |
| `engine_invoke_transport_publish_relay_event` | Async host/lab path (shim tombstoned on product) |
| `relay::publish_event` | Raw Tauri command — must not be called from product TS |

R1 = prove product `apps/pwa/app/**` has **zero** `invoke("publish_event")` / string command refs (except engine-lab contracts documenting Rust).

---

## Claim language

| May say | When |
|---------|------|
| Inventoried | L1 green |
| Quarantined (R2) | [R2 design](./relay-publish-r2-quarantine-design-2026-07.md) — ACL deny `publish_event` |
