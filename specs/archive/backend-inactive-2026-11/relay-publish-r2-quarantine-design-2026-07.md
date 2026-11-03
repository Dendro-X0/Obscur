# Design — relay boundary R2 quarantine raw `publish_event`

**Status:** Implemented (L1) · 2026-07-30  
**Parent:** [engine-invoke-boundary-subtract-design-2026-07.md](./engine-invoke-boundary-subtract-design-2026-07.md)  
**Prior:** [relay-publish-r1-inventory-design-2026-07.md](./relay-publish-r1-inventory-design-2026-07.md)

---

## Session gate

```text
NEXT ATOMIC STEP:     Dual-owner subtract — R2 quarantine raw relay::publish_event
PAUSED / CANCELLED:   community · Dev Lab
CANONICAL OWNER:      publishTransportKernelToRelay → send_relay_message
PROOF BEFORE DONE:    L1 catalog · permissions/app.toml omits publish_event from allow
OUT OF SCOPE:         Delete relay::publish_event from generate_handler (R3) · L3 publish soak
```

---

## Why

R1 proved product TS has zero `invoke("publish_event")`. Product native EVENT path is:

```
publishToRelayStandalone → publishTransportKernelToRelay → send_relay_message
```

Raw Tauri command `publish_event` remains registered and ACL-allowed — a regression can reintroduce the dual owner without a compile fail. R2 closes the IPC door.

Internal Rust `RelayPool::publish_event_with_ack` (used by `engine_invoke_transport_publish_relay_event` / protocol) is **unchanged**.

---

## Change

| Surface | Action |
|---------|--------|
| `apps/desktop/src-tauri/permissions/app.toml` `allow-relay-commands` | Remove `"publish_event"` from `commands.allow` |
| Same permission | Add `"publish_event"` to `commands.deny` (explicit quarantine) |
| `relay.rs` `publish_event` command | Comment: ACL-quarantined; keep handler until R3 |
| L1 catalog | Assert ACL deny + still registered in `lib.rs` + no product invoke |
| `gen/schemas/acl-manifests.json` | Sync if committed (mirror app.toml) |

---

## Mental simulation

1. Product send still uses `send_relay_message` → OK.  
2. Reintroduced `invoke("publish_event")` → Tauri ACL reject.  
3. Lab async host still uses `publish_event_with_ack` internally → OK.  
4. R3 later removes handler + registration when L3 publish proves sole path.

---

## Proof

| Layer | Command |
|-------|---------|
| L1 | `pnpm -C apps/pwa exec vitest run app/engine-lab/engine-invoke-boundary-catalog.contract.test.ts` |
| L3 | Deferred — relays unreachable this environment |

---

## Claim language

| May say | When |
|---------|------|
| Quarantined (R2) | L1 green · ACL deny present · handler still registered |
| Tombstoned (R3) | Handler removed — **not this slice** |
