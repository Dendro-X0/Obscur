# Dual-owner L3 publish + R2 ACL — local ephemeral relay

**Status:** VERIFIED · 2026-07-30T09:32Z  
**Shell:** `shell-2026-07-30T09:11:39Z` · CDP `csess-6957e1a96ea2` · ephemeral `scripts/dev-relay-ephemeral.mjs` `:7000`

---

## Results

| Check | Result |
|-------|--------|
| `connect_relay` `ws://127.0.0.1:7000` | `Connected` |
| `send_relay_message` EVENT (`DUAL-OWNER-L3-PUB-1785403911658`) | `Sent` |
| `publish_event` invoke | **ACL deny** — `publish_event explicitly denied… allow-relay-commands` (R2 live) |
| Public WSS / Docker | Unreachable — L3 used ephemeral local relay |

---

## Follow-on

R3 tombstoned IPC `publish_event` after this gate (handler removed from `generate_handler!`).
