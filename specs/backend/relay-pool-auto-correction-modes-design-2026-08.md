# Relay pool auto-correction modes — design

**Date (UTC):** 2026-08-04  
**Status:** D0–D4 **Pass** (L1 + docs) · L2/L3 public soak deferred until clearnet desktop  
**Handoff:** Auto-correct band closed at D4 · maintainer soak optional  
**Parents:** [relay-pool-auto-correction-operator-notes-2026-08.md](../../docs/program/relay-pool-auto-correction-operator-notes-2026-08.md) · [relay-pool-d3-multi-node-public-soak-2026-08.md](./relay-pool-d3-multi-node-public-soak-2026-08.md) · [transport-preset-catalog.ts](../../apps/pwa/app/features/transport-kernel/transport-preset-catalog.ts)

---

## Session header

```text
NEXT ATOMIC STEP:     Maintainer manual core verify · production relay stability
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION · groups/**
CANONICAL OWNER:      mesh pool publishToUrls · transport presets · (failover: Rust mesh when RUST-4a)
PROOF BEFORE DONE:    Design accepted → L1 contracts → L3 soak on default public pool (or VPS)
OUT OF SCOPE:         Soft L3 Docker ship claim · public Nostr SLA · community · AUTH-SESSION
```

---

## Product requirement (maintainer)

1. **Flexible automatic correction** — seamless switching among pool nodes when the active path is unstable.  
2. **Simultaneous multi-node connections** — stay connected to multiple relays at once.  
3. **User-selectable modes:**
   - **Single-node** — prefer one publish/receive primary; **auto-switch** if that node becomes unstable.  
   - **Multi-node** — keep multiple nodes live; publish with quorum / redundancy.
4. **Default pool = public Nostr** — cold/reset product boot uses the public server relay pool (`PRODUCT_BOOT_TRANSPORT_PRESET` = Default Stable). That pool is the available baseline for ship users; local Docker is lab-only.

---

## Default public pool (canonical today)

| Field | Value |
|-------|--------|
| Preset | `default_stable` (`DEFAULT_STABLE_PRESET`) |
| Boot constant | `PRODUCT_BOOT_TRANSPORT_PRESET` |
| Mode | `redundancy` (**Multi-node** default) |
| URLs | `wss://nos.lol` · `wss://relay.primal.net` · `wss://relay.damus.io` |
| Related packs | High Redundancy (larger public set) · Low Latency (`basic` / Single-node over same public class) |

**Contract:** Auto-correct Single/Multi operate over whatever enabled URLs the profile has. For a fresh product profile, that set **is** the public Nostr pool above unless the user applies a private/lab pack.

Honesty: public free relays are **available**, not an SLA — partial disconnect → degraded badge (P14), not silent green.

---

## Mental model (one action end-to-end)

```text
Cold boot / reset ──► Default Stable public Nostr pool (multi-node)
        │
User chooses mode (single | multi)  [optional; default = multi via redundancy]
        │
        ▼
Enabled relay URLs (public default / other preset / manual) ──► mesh pool sockets
        │
        ├─ Single: primary URL for publish; standby pool for auto-failover
        └─ Multi:  publishToUrls(N) with quorum; badge reflects publish-ready K of N
        │
        ▼
DM / invite evidence ← mesh publishToUrls (canonical product owner)
```

Neighbor modules that must not regress: invite mesh bridge, Settings Relays honesty (degraded ≠ healthy), Rust mesh failover ownership (RUST-4a).

---

## What already exists (map, do not duplicate)

| Capability | Owner today | Notes |
|------------|-------------|--------|
| **Default public pool** | `PRODUCT_BOOT_TRANSPORT_PRESET` → Default Stable | nos / primal / damus · `redundancy` |
| Multi-endpoint list + sockets | Conduit mesh pool · `publishToUrls` | Simultaneous connections already exist |
| Mode enum | `RelayTransportMode`: `"basic"` \| `"redundancy"` | Presets set this (`transport-preset-catalog.ts`) |
| Redundancy / quorum publish | Mesh multi-publish · `quorumRequired` | High Redundancy / Default Stable use `redundancy` |
| Primary failover (TS) | `relay-primary-failover-policy` + supervisor | Skipped when `meshSchedulerOwnsFailover` (RUST-4a) |
| Mesh owns failover | `mesh-scheduler-failover-gate.ts` | One owner — do not re-add parallel TS failover |
| Honest degraded badge | P14 pool health · `publishReadyRelayUrls` | Partial pool → degraded, not silent green |
| Presets UX | Settings Transport packs | Apply Default Stable / High Redundancy / private packs |

**Gap vs product language:** Settings still speak “basic / redundancy” and presets, not explicit **Single-node (auto-correct)** vs **Multi-node** modes. Auto-correction on instability exists partially (recovery + failover + mesh scheduler) but is not one clear user-facing contract with soak proof on the **default public pool** (not Docker).

---

## Proposed product modes (names for UX)

| UX label | Maps to | Behavior |
|----------|---------|----------|
| **Single-node (auto-correct)** | `basic` + failover candidates | One preferred publish primary; keep other enabled URLs as standby; on instability (no writable / publish timeouts / recovery) promote next healthy candidate without user action |
| **Multi-node** | `redundancy` | Multiple sockets active; publish to N with quorum; UI shows publish-ready K of N |

Rules:

1. **One failover owner** — when Rust mesh owns failover, TS must not dual-switch primary (already gated).  
2. **Honesty** — if only 1 of N is publish-ready, badge is **degraded** (P14), never fake healthy.  
3. **Default surface = public Nostr pool** — ship/cold-boot proof targets Default Stable (or High Redundancy); Docker/`localhost:7000` is lab-only and must not displace the public default.  
4. **Optional VPS** — self-hosted clearnet remains an operator pack, not a requirement to use Single/Multi auto-correct.  
5. **Subtraction first** — extend mode copy + failover contract; do not add a third parallel pool.

---

## Implementation slices (when maintainer unparks code)

| Slice | Deliver | Proof |
|-------|---------|--------|
| **D0** | This design + UX copy map (basic↔single, redundancy↔multi) + default public pool | **Pass** — [relay-pool-modes-d0-ux-copy-map-2026-08.md](./relay-pool-modes-d0-ux-copy-map-2026-08.md) |
| **D1** | Settings: expose Single / Multi labels bound to existing mode | **Pass** (L1) — EN i18n + `relay-pool-modes-d1-copy.contract.test.ts` |
| **D2** | Single-node auto-correct: document + tighten failover when primary unstable (mesh-owned path preferred) | **Pass** (L1) — [relay-pool-d2-single-node-failover-2026-08.md](./relay-pool-d2-single-node-failover-2026-08.md); L3 soak deferred |
| **D3** | Multi-node soak on **default public** endpoints (P14 style) | **Pass** (L1) — [relay-pool-d3-multi-node-public-soak-2026-08.md](./relay-pool-d3-multi-node-public-soak-2026-08.md); L2/L3 soak deferred this host |
| **D4** | Operator notes: optional VPS topology; public default remains first-class | **Pass** — [relay-pool-auto-correction-operator-notes-2026-08.md](../../docs/program/relay-pool-auto-correction-operator-notes-2026-08.md) |

---

## Acceptance (product)

- Cold/reset profiles land on the **public Nostr default pool** (Default Stable) without Docker.  
- User can choose Single vs Multi without editing raw URL lists (preset or explicit mode control).  
- Single: primary failure → automatic switch to another enabled healthy node; publish path copy updates.  
- Multi: simultaneous connections; publish uses multiple nodes; instability on one node does not silent-green the badge.  
- Production verification prefers the **default public pool**; VPS optional; containers are not ship proof.

---

## Non-goals

- Guaranteeing public free relays (`nos` / `primal` / `damus`) as **SLA** (availability as product default ≠ uptime contract).  
- Soft L3 Docker Pass as ship evidence for this feature.  
- Community / COM-RUN / AUTH-SESSION work.
