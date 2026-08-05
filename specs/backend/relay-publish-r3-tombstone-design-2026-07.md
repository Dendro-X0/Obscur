# Design — relay boundary R3 tombstone `publish_event` command

**Status:** Implemented (L1) · L3 gate PASS · 2026-07-30  
**Parent:** [engine-invoke-boundary-subtract-design-2026-07.md](./engine-invoke-boundary-subtract-design-2026-07.md)  
**Prior:** [R2](./relay-publish-r2-quarantine-design-2026-07.md)  
**L3 evidence:** [dual-owner-l3-publish-local-relay-2026-07-30.md](../../docs/handoffs/dual-owner-l3-publish-local-relay-2026-07-30.md)

---

## Session gate

```text
NEXT ATOMIC STEP:     Dual-owner subtract — R3 tombstone gated on L3 publish
PAUSED / CANCELLED:   community · Dev Lab
CANONICAL OWNER:      send_relay_message / publish_event_with_ack (internal)
PROOF BEFORE DONE:    L1 catalog · no generate_handler publish_event · cargo check desktop
OUT OF SCOPE:         community · db_insert_message · remove publish_event_with_ack
```

---

## Change

| Surface | Action |
|---------|--------|
| `lib.rs` `generate_handler!` | Remove `relay::publish_event` (both desktop/mobile lists if dual) |
| `relay.rs` `pub async fn publish_event` | Delete IPC command (keep `publish_event_with_ack`) |
| `permissions/app.toml` | Drop `commands.deny = ["publish_event"]` (command gone) |
| `acl-manifests.json` | Sync deny list |
| L1 catalog | Assert handler absent · transport async still registered · product still no invoke |

---

## Claim language

| May say | When |
|---------|------|
| Tombstoned (R3) | L1 green · handler unregistered |
| Fixed (publish sole owner) | L3 local publish already proved + R3 |
