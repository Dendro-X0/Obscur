# Design — Tor transport mode (Option A)

**Status:** Design Ready · Slice 1 **Implemented** (L1 pending prove) · 2026-08-08  
**Date (UTC):** 2026-08-08  
**Parents:** [tor-rust-integration-regression-investigation-2026-08.md](./tor-rust-integration-regression-investigation-2026-08.md) · [tor-local-first-redesign-2026-08.md](./tor-local-first-redesign-2026-08.md)

```text
HANDOFF:              Option A accepted → design → impl Slice 1
PAUSED / CANCELLED:   Community · AUTH-SESSION-1
CANONICAL OWNER:      TorLifecycle (process) · NativeNetworkRuntime.transport_armed · TorDialScheduler
PROOF:                L1 unit · L3 Tor ON usable (not Tor-OFF re-verify)
```

## Product contract

| Layer | Meaning |
|-------|---------|
| **Sidecar enable** | Settings → Tor ON starts/stops `tor.exe`. Does **not** route traffic. |
| **Bootstrap ready** | Log evidence `Bootstrapped 100%` only. UI may show bootstrap READY. |
| **Transport armed** | Explicit user action “Route traffic via Tor”. Only then SOCKS for relays/HTTP. |
| **Relays dial arm** | Local-first Relays Connect (Phase 2) — orthogonal; clearnet OK while Tor sidecar runs unarmed. |

**Invariant:** Enabling Tor never wedges the host. Routing via Tor is a second, gated step with a global dial budget.

**Success:** App works **with** Tor transport when chosen — not only after removing Tor.

---

## State machine

```text
Off
  → (toggle ON) Starting          // spawn sidecar; transport_armed=false; clearnet dials OK
  → BootstrapReady                // Bootstrapped 100%; transport_armed=false; clearnet OK
  → (Route via Tor) TransportOn   // transport_armed=true; SOCKS only; dial concurrency ≤2
  → (Use clearnet / toggle OFF)   // disarm; stop sidecar if OFF

Starting/Error
  → transport_armed forced false
  → clearnet dials OK (do not mass-refuse)
```

| Signal | Sets |
|--------|------|
| `Bootstrapped 100%` | `runtime=Connected`, `ready=true`, **does not** arm transport |
| `set_tor_transport_armed(true)` | Requires Connected; sets `transport_armed` |
| `set_tor_transport_armed(false)` / stop / error | Clears `transport_armed` |
| TCP SocksPort probe | Never sets Connected or transport |

---

## Snapshot contract (`TorStatusSnapshot`)

| Field | Meaning |
|-------|---------|
| `configured` | Settings wants sidecar |
| `ready` | Bootstrap 100% (`Connected`) |
| `transportArmed` | SOCKS routing active |
| `state` | disconnected \| starting \| connected \| error \| stopped |
| `proxyUrl` | SOCKS URL |

TS: `privacy_routed` **only** when `transportArmed` (not `configured`).

---

## Dial rules

| Condition | `connect_relay` |
|-----------|-----------------|
| `!transportArmed` | Clearnet (even if sidecar Starting/Ready) |
| `transportArmed` | SOCKS via global semaphore **max 2** concurrent; ≤3 attempts / 6s per dial |
| Mesh HTTP SOCKS | Must require `transportArmed` (same gate) |

---

## Subtraction (Slice 1)

1. Remove auto-`arm_tor_routing` on `Bootstrapped 100%` and on `start_tor` reuse-when-ready.  
2. Remove fail-closed “desired ∧ ¬armed → refuse all dials” (blocks clearnet; makes Tor enable a trap).  
3. Add `set_tor_transport_armed` + snapshot `transportArmed`.  
4. Add Tor dial semaphore (2).  
5. Settings UI: **Route traffic via Tor** / **Use clearnet** when bootstrap ready.  
6. `privacy_routed` ← `transportArmed`.

## Later slices (not Slice 1)

- Single settings store (drop localStorage dual write drift)  
- Scoped PID kill (not all `tor.exe`)  
- Replace N× NativeRelay fan-out with Rust `dial_pool` API  
- Full mesh HTTP gate audit  

---

## Proof

| Layer | Command / evidence |
|-------|-------------------|
| L1 | `cargo test` net/tor · vitest policy/UI smoke |
| L3 | Tor sidecar ON + bootstrap stuck/ready **without** transport → shell usable + clearnet dials if Relays armed; **Route via Tor** after 100% → SOCKS without ChunkLoadError |

**Forbidden:** Tor-OFF re-verify as progress gate.
