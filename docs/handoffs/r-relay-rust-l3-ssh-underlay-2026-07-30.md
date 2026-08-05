# R-RELAY-RUST-5c L3 SSH underlay soak

- **When:** 2026-07-30T16:27:30.203Z
- **Outcome:** Pass
- **Relay:** ws://127.0.0.1:7000
- **Bastion:** ops@127.0.0.1:2222
- **Forward:** 127.0.0.1:19001 → 172.18.0.2:8080
- **Dial:** ws://127.0.0.1:19001

## Checks

- [x] **product_relay_7000** — listening
- [x] **ssh_identity** — E:\Temp\obscur-l3-ssh\id_ed25519
- [x] **bastion_container** — obscur-l3-ssh-bastion :2222
- [x] **bastion_ssh_login** — ops@127.0.0.1 BatchMode
- [x] **relay_remote_for_forward** — 172.18.0.2:8080
- [x] **cargo_l3_ssh_underlay** — mesh configure→forward→REQ Pass

## Claim

| May say | When |
|---------|------|
| SSH path fixed (L3) | This soak Pass |
| Offline ready | Never from this file |

```bash
node scripts/l3-mesh-ssh-underlay.mjs
```
