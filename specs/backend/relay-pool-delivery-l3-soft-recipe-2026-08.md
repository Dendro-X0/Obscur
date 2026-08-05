# Soft L3 — Relay pool two-profile delivery (S1–S4)

- Date (UTC): 2026-08-01
- Parent: [relay-pool-delivery-strategy-design-2026-08.md](./relay-pool-delivery-strategy-design-2026-08.md)
- Surface: desktop / live webpack · **not** Dev Lab validation · **not** COM-RUN

## Goal

Prove **A publishes → B receives** on an **agreed relay path** (intersection publish), after S1–S4.

| Claim | When |
|-------|------|
| Soft L3 **Pass** | Dual-profile DM marker delivered ≤45s on agreed path + path honesty probes green |
| Delivery **fixed** | Soft L3 Pass **and** maintainer accepts the agreed path (local lab **or** shared remote) |
| Public Nostr **fixed** | **Never** from this recipe alone |

## Agreed path (lab default)

When public `wss://` dials time out, use **`ws://localhost:7000`** (Docker Nostr) as the shared store. Both profiles must enable it. This matches product rule: local is lab/test; remotes are for true remote peers.

## Preconditions

| Check | How |
|-------|-----|
| Relay | `ws://localhost:7000` listening |
| Desktop / live | `pnpm dev:desktop:no-coord:live` (or online) · app `:3340` or `:1430` |
| CDP optional | `:9230` for Tauri attach; dual browser contexts work against live URL without second Tauri window |
| Accounts | Tester1 + Tester2 unlockable |
| Forbidden | `obscurDevLab` synthetic send · COM-RUN · AUTH-SESSION |

## Rows

### Row A — Path honesty (S1/S3)

| Step | Pass |
|------|------|
| A1 | Relays / runtime shows writable ≥ 1 on agreed path |
| A2 | UI shows **DM publish path** (S3) — not primary chip alone |
| A3 | If any **open remote** exists among candidates, publish path must **not** be local-only (S1) |

### Row B — Two-profile DM (delivery)

| Step | Pass |
|------|------|
| B1 | Unlock Tester1 + Tester2 (separate browser contexts or dual CDP windows) |
| B2 | Both enable agreed path relay |
| B3 | A sends unique marker DM to B |
| B4 | B thread shows marker within **45s** |

### Row C — CM scoped (S4, optional)

| Step | Pass |
|------|------|
| C1 | Relays community section shows scoped-store hint (no DM Quiet auto-rewire) |
| C2 | Do **not** reopen COM-RUN membership |

## Automation

```bash
# Cheap gate (no unlock / no send) — agent fail-closed
pnpm verify:s-pool-delivery-l3:preflight

# Full Soft L3 (agent-owned when CDP up — no maintainer dual-window required)
pnpm verify:s-pool-delivery-l3

# L1 unit (app-base resolver)
pnpm verify:s-pool-delivery-l3:unit
```

App base: prefers `PLAYWRIGHT_BASE_URL`, else reachable `:1430` (static), else `:3340` (webpack).  
Pass requires **receive + publish ACK** (`fAck`). Override only for debug: `OBSCUR_SOFT_L3_ALLOW_RECEIVE_WITHOUT_ACK=1`.

Report: `test-results/s-pool-delivery-l3-YYYY-MM-DD.json` · preflight: `test-results/s-pool-delivery-l3-preflight-YYYY-MM-DD.json`  
Catalog: `stress.obscur.soft_l3.public_dm@1` in `.codactrl/sandbox/sandbox.catalog.yaml`  
Design: [soft-l3-automation-track-a-design-2026-08.md](./soft-l3-automation-track-a-design-2026-08.md)

## Claim language

| May say | Only when |
|---------|-----------|
| Soft L3 **Pass** | Report `l3.pass === true` **and** `fAck === true` (unless debug override) |
| Soft L3 **Blocked** | Missing second profile / compose / relay down — fix env, re-run |
| Soft L3 **Fail** | Marker sent but not received (`F-RECV`), or received without ACK (`F-ACK`), or path honesty violated |
| Delivery **fixed** | Soft L3 Pass + maintainer sign-off on agreed path |
| Track A **Implemented** | Preflight + unit + Pass-requires-ACK landed — **≠** Soft L3 Pass |
