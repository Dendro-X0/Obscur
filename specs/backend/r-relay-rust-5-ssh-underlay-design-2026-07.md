# Design — R-RELAY-RUST-5 SSH underlay (`ssh_tunnel`)

**Status:** RUST-5d L1 Pass · SSH preset pack in catalog  
**Prior:** [RUST-4c](./r-relay-rust-4c-legacy-delete-design-2026-07.md) · [mesh charter](./r-relay-rust-mesh-charter-2026-07.md) · L3-product + Tauri UI soak Pass  
**Charter slot:** P3 reserved → **SSH underlay** (local L3 precondition met)

---

## Session gate

```text
HANDOFF ATOMIC STEP:  RUST-5+ SSH/offline when chartered · or web L3
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNER:      Rust mesh underlay adapter (new) — dialect unchanged
PROOF BEFORE DONE:    Design this file → L1 cargo · L3 tunnel→local WS (later slices)
OUT OF SCOPE:         offline/DTN · reverse tunnels · community · web L3 claim · public Nostr
```

---

## Goal

Reach a **private relay behind a bastion** without exposing the relay port publicly: mesh owns **reachability** via `underlay: ssh_tunnel`; dialect (`nostr_ws` / `custom` / `team_relay`) still dials **`ws://127.0.0.1:<local>`** after the forward is up.

Invariant (charter): **dialect ≠ underlay**. No SSH types in dialect adapters; no second TS failover owner; do not thicken `relay-browser-pool-runtime`.

---

## Current state (inventory)

| Surface | Today |
|---------|--------|
| `ConduitUnderlay::SshTunnel` | Exists; `is_underlay_supported() == false` |
| Registry | Accepts SSH conduits as **Blocked** + `underlay_unsupported` |
| Dial path | Never selects SSH endpoints (`enabled_endpoints` filters Blocked) |
| TS contracts | `ConduitDescriptor` has **no** `underlay` field yet (Rust ahead) |
| Product SSH | None — no spawn, no preset, no UI |

Local/private mesh L3 and RUST-4c subtraction are **done** — SSH design is now in-charter.

---

## Mental simulation

1. **Sender** unlocks profile `P`, applies a pack with one conduit: dialect `nostr_ws`, underlay `ssh_tunnel`, bastion `bastion.example`, remote `relay:7000`, local bind `127.0.0.1:19001`.
2. **Mesh** (before dial): start underlay → wait for local port listen → mark underlay healthy → rewrite dial URL to `ws://127.0.0.1:19001`.
3. **Dialect** connects/publishes as today; evidence stays mesh snapshot classes (`socket_open` / `accepted`), plus underlay reason codes on failure (`ssh_auth_failed`, `ssh_binary_missing`, `tunnel_down`).
4. **Receiver** unchanged (same relay content path).
5. **Fail closed:** if underlay required and tunnel down → conduit **Blocked**/Offline — **never** silent clearnet to the remote host.
6. **Neighbor:** Tor policy still independent (SSH-then-Tor is **out of scope** for 5a–5c; document as future compose).

---

## Contract (descriptor extension)

Keep existing `underlay: "ssh_tunnel"`. Add **optional** underlay params (serde camelCase), ignored unless underlay is SSH:

```json
{
  "conduitId": "home-via-bastion",
  "dialect": "nostr_ws",
  "endpoints": ["ws://127.0.0.1:19001"],
  "underlay": "ssh_tunnel",
  "sshTunnel": {
    "bastionHost": "bastion.example",
    "bastionPort": 22,
    "bastionUser": "ops",
    "remoteHost": "127.0.0.1",
    "remotePort": 7000,
    "localBindHost": "127.0.0.1",
    "localBindPort": 19001,
    "identityFile": null
  },
  "capabilities": ["publish", "subscribe"],
  "networkPolicy": "clearnet",
  "trustTier": "user_configured",
  "enabled": true,
  "priority": 10
}
```

### Endpoint ownership rule

| Field | Meaning |
|-------|---------|
| `endpoints[]` | **Dialect dial URLs after tunnel** — always loopback for MVP (`ws://127.0.0.1:<localBindPort>`) |
| `sshTunnel.*` | Bastion + remote target for the forward |
| Mismatch | If `endpoints[0]` host/port ≠ local bind → soft-skip configure (`ssh_endpoint_mismatch`) |

Do **not** put bastion URLs in `endpoints` (would invite clearnet dial bugs).

### Evidence / health reasons (underlay)

| Code | When |
|------|------|
| `underlay_unsupported` | Pre-5a (tombstone until adapter ships) |
| `ssh_binary_missing` | OpenSSH client not found |
| `ssh_auth_failed` | Non-zero exit / auth reject |
| `tunnel_down` | Process died or port not listening |
| `tunnel_up` | Local bind ready (internal; dial may proceed) |

`tunnel_up` ≠ message `accepted`.

---

## Canonical owner

| Concern | Owner |
|---------|--------|
| Underlay lifecycle (spawn/stop/health) | **New** `apps/desktop/src-tauri/src/mesh/underlay/ssh_tunnel.rs` (+ thin trait `UnderlayPort`) |
| Registry support flag | `descriptor::is_underlay_supported` — true when SSH adapter registered **and** params valid |
| Dial URL selection | Mesh runtime after underlay ready — dialect unchanged |
| TS wire types | `@obscur/conduit-mesh-contracts` optional `underlay` + `sshTunnel` |
| Preset / UI | **Deferred** (RUST-5d+) — harness/configure IPC first |
| Offline / DTN | **Not this design** — separate RUST-6 charter |

**Subtract / forbid:** embedding SSH in `NostrWsDialect`; TS spawning `ssh`; auto-selecting remote clearnet when SSH fails.

---

## MVP process model (Windows-first host)

| Choice | Decision |
|--------|----------|
| Client | System **OpenSSH** (`ssh`) — Windows 10+ optional feature / Git/ssh |
| Mode | **Local-forward only** (`-L local:remote`) |
| Auth | Default agent / default keys; optional `identityFile` path (explicit) |
| Lifecycle | One child process per conduit; kill on reconfigure / unlock end |
| Missing binary | Blocked + `ssh_binary_missing` — no fallback dial |

Reverse tunnel, jump hosts beyond one bastion, and embedded libssh2 are **out of MVP**.

---

## Implementation slices (after this Design Pass)

| Slice | Deliverable | Proof |
|-------|-------------|-------|
| **RUST-5a** | Wire `sshTunnel` serde · contracts TS mirror · keep blocked until adapter present · unit tests mismatch/skip | `cargo test` mesh · contracts package test |
| **RUST-5b** | `SshTunnelUnderlay` spawn/stop · mark supported · dial only after listen | `cargo test` with mock/`ssh` stub or gated live |
| **RUST-5c** | L3 desktop: bastion lab or local `ssh -L` to Docker `:7000` → mesh publish Pass | Named L3 recipe + evidence md |
| **RUST-5d** | Optional preset/settings pack (explicit SSH) | L1 preset contracts — UI taste only after backend Pass |

This file charters **5a–5c**; **5a is next implement atomic**. Offline stays unchartered until a separate design.

---

## Proof plan

| Layer | Command / recipe |
|-------|------------------|
| L1 | `cargo test -p obscur-desktop -- mesh::` (or crate path in use) · descriptor/registry SSH support flip · contracts vitest if added |
| L2 | Optional CI job with OpenSSH present |
| L3 | Recipe: local relay `:7000` + `ssh -L 19001:127.0.0.1:7000` loopback bastion **or** documented bastion lab → configureMesh + publish + snapshot |

**Claim language**

| May say | When |
|---------|------|
| RUST-5 Design Pass | This file + handoff |
| SSH underlay implemented | 5b L1 green |
| SSH path fixed | 5c L3 Pass |
| Offline ready | Never from this file |

---

## Feasibility notes

| Risk | Mitigation |
|------|------------|
| No OpenSSH on user machine | Soft-block + clear reason; docs for install |
| Agent/key UX | Explicit `identityFile` later; MVP relies on agent |
| Port conflicts | Configure fails with bind error → Offline |
| Compose with Tor | Deferred — do not claim Tor-over-SSH |

---

## Forbidden without later slice

- Silent clearnet to `remoteHost` when tunnel fails  
- SSH spawn from PWA / browser runtime  
- Treating SSH as a dialect  
- Reverse/SSHFS/SCP “message transfer” as fake underlay  
- Implementing offline “in the same PR” as SSH  

---

## Next atomic step

**Optional RUST-6** — offline/DTN charter when requested. Mesh SSH band complete through 5d.

**5d evidence (L1 Pass):** vitest catalog + mesh wire **29 Pass** · preset `ssh_bastion_forward` emits `underlay: ssh_tunnel` + `sshTunnel`.

**May claim:** SSH path fixed (L3 lab) · SSH preset pack available (template; edit before delivery).  
**Not claimed:** offline · web L3 · public Nostr fixed · polished SSH settings editor (bastion fields still via template + mesh wire).

