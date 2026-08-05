# Charter — R-RELAY-RUST: Rust conduit mesh (Nostr optional · alternatives first)

**Status:** **ACTIVE** — maintainer-chartered 2026-07-30 (supersedes JS-pool patch band as primary transport path)  
**Amends:** [r-relay-transport-refactor-charter-2026-07.md](./r-relay-transport-refactor-charter-2026-07.md) (R-RELAY-1 pool pad remains useful stopgap; not the end state)  
**North star:** [obscur-conduit-mesh-concept-2026-06.md](../../docs/program/obscur-conduit-mesh-concept-2026-06.md)  
**Feasibility:** [rules/11](../../rules/11-feasibility-and-modular-safety.md) · public Nostr as **default** transport = currently **infeasible** (upstream TLS/503 + TS pool dual-truth)  
**Does not un-pause:** community · AUTH-SESSION-1 · Dev Lab

---

## Session gate (agents)

```text
NEXT ATOMIC STEP:     Optional L3-product (Docker) · or RUST-3 nostr adapter (preset→mesh wire L1 Pass)
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNER (target): Rust mesh runtime (libobscur / desktop) + dialect adapters · TS UI binds evidence only
PROOF BEFORE DONE:    Per-slice below
OUT OF SCOPE:         Another enhanced-relay-pool patch loop · claiming public damus/primal “fixed” · community
```

---

## Maintainer intent (this ask)

| Ask | Charter response |
|-----|------------------|
| Relay system failed again → rewrite | **Yes** — new approach, not another pool patch |
| Redesign/reimplement in **Rust** | **Yes** — Rust owns connect/publish/subscribe/failover for configured conduits |
| Flexible / highly adaptable | **Dialect adapters** + **underlays** under one mesh scheduler (see Extensibility) |
| Nostr unusable → explore alternatives | **Public Nostr demoted** from boot default; **local / private HTTP-WS / team / hybrid** are first-class; `nostr_ws` remains **optional** dialect when user opts in |
| Custom pools · VPS · SSH · Tor · offline | **First-class capability slots** in the mesh contract — ship incrementally; never hard-wire damus-shaped assumptions into the kernel |

**Goal preservation:** Obscur stays **transport-agnostic E2EE** — not a Nostr client. Cancelling “depend on public Nostr for DMs” ≠ cancelling private messaging. **Long-term iteration** means new transports plug in without rewriting auth/dm/workspace.

---

## Why Rust (and why not another TS patch)

| Evidence | Implication |
|----------|-------------|
| Public WSS (damus/primal) TLS/503 while dns/tcp ok | Cannot “fix” Cloudflare from app code |
| TS pool + supervisor + primary selection dual paths | Render-depth history; R-RELAY-1 pad is stopgap only |
| `libobscur::net::relay::RelayClient` | Scaffold exists — **mock WS loop**, Tor SOCKS stub — not production mesh |
| `@obscur/conduit-mesh` (TS) | Dialect/evidence concepts landed in package; product still wired to legacy pool |
| Desktop already uses native WS path | Latency metrics missing on native — truth lives half in Rust, half in TS |

**Feasibility outcome (rules/11):** Continue with **new architecture** (Rust mesh + dialects). Mark **public-Nostr-as-default** infeasible until upstream or user-operated relays prove L3.

---

## Target architecture

```text
Kernel (dm · workspace · auth)
        │  Envelope { ciphertext, audience, evidence_class, allowed_conduits[] }
        ▼
┌─────────────────────────────────────────────────────────────┐
│  RUST CONDUIT MESH RUNTIME (profileId · one owner)          │
│  Router · Scheduler · Evidence · Policy · Capability registry│
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
     DIALECTS (wire map)              UNDERLAYS (how bytes move)
     team_ws · custom_http            clearnet · Tor SOCKS
     nostr_ws (opt) · custom_*        SSH tunnel · local loop
     offline_* (future)               future: BLE / QR / file drop
```

**Split (scalability invariant):** a **dialect** maps envelope ↔ wire; an **underlay** provides reachability (clearnet, Tor, SSH jump, offline medium). Same dialect may ride different underlays (e.g. `team_ws` over Tor, or `custom_http` over SSH local-forward). Kernel never imports dialect or underlay types.

| Concern | Owner | Must not |
|---------|-------|----------|
| Socket lifecycle / failover | Rust mesh | TS auto-reconcile race |
| Dialect wire map | Adapter per dialect (stable `ConduitPort`) | Kernel importing NIP / SSH / BLE types |
| Underlay / network policy | Mesh policy + underlay adapters | Silent clearnet when Tor/SSH required |
| Evidence / readiness snapshot | Rust → `engine_invoke` / TransportSnapshot | UI inventing “connected” |
| Preset / custom pool config | User descriptors → Rust registry | Hard-coding damus as sole path |
| E2EE | Existing crypto/auth owners | Mesh decrypting payloads |

---

## Extensibility ladder (long-term iteration)

Capability slots are **versioned descriptors** in the registry. A slot may be `shipped` | `scaffold` | `reserved` — adding a reserved dialect must not force a kernel or UI rewrite.

| Slot | Examples | Mesh contract | Slice horizon |
|------|----------|---------------|---------------|
| **Custom relay pools** | User URL list, redundancy N, failover order, pin/fingerprint later | Pool = set of conduits, not “Nostr” | RUST-1+ (config); failover in scheduler |
| **VPS / self-host** | Operator `wss://` / HTTP gateway on rented VPS | Same as `team_ws` / `custom_*` — trust tier = operator | RUST-1–2 (private MVP) |
| **SSH** | Local-forward / reverse tunnel to private relay; bastion hop | **Underlay** `ssh_tunnel` → dialect sees `ws://127.0.0.1:…` or mesh-owned mux | **Reserved** → design after local L3 (RUST-5+) |
| **Tor** | `tor_preferred` / `tor_required`; onion endpoints; SOCKS | Policy on conduit (G5) — fail closed when required | Wire into Rust mesh early; product preset already exists |
| **Offline / delay-tolerant** | USB/file drop, QR/chunk, BLE, store-forward dead-drop | Dialect `offline_*` with evidence class `accepted_when_imported` (async) | **Reserved** (mesh G8) — contract stub in RUST-0; no impl until charter slice |

### Scalability rules (do not violate)

1. **Stable port** — dialects implement one Rust trait (connect / publish / subscribe / probe / evidence); underlays implement reachability + policy tags.
2. **Versioned conduit descriptors** — `dialect`, `underlay`, `endpoints[]`, `network_policy`, `trust_tier`, `capabilities[]`; unknown dialect → soft-fail, not panic.
3. **Evidence classes stay dialect-agnostic** — `socket_open` ≠ `accepted` ≠ `imported_offline`; UI maps classes, not wire formats.
4. **Lane promotion across dialects** — private VPS down → standby custom pool or offline queue; never second orchestration owner in TS.
5. **Presets are packs of descriptors** — custom pools are first-class edits of the same schema, not a parallel “advanced” path.
6. **Add by adapter, subtract by tombstone** — new SSH/offline code lands in new modules; do not thicken `enhanced-relay-pool`.

---

## Dialect / underlay priority (product default shift)

| Priority | Path | Role |
|----------|------|------|
| **P0** | Local `:7000` + private LAN/HTTP + **VPS/custom pool** descriptors | Dev + self-host when public net fails |
| **P0** | **Tor policy** on those conduits (respect Security mode) | Sovereignty; fail closed when required |
| **P0** | Team / operator workspace relay | Private trust path |
| **P1** | Hybrid (private + optional public) | User explicit opt-in |
| **P2** | Public `nostr_ws` pool | Optional convenience — never sole boot dependency |
| **P3 reserved** | **SSH underlay** | Reach private relays without exposing ports |
| **P3 reserved** | **Offline transfer** dialects | Air-gap / DTN; evidence on import |

Boot/onboarding default should move toward **private/local/VPS-capable** packs (with clear copy), not “must reach damus.”

---

## Slice plan

### R-RELAY-RUST-0 — Feasibility + keep-set inventory (next)

**Deliverable:** Inventory of Rust/TS surfaces; **capability registry stub** (custom pool · VPS · Tor · SSH reserved · offline reserved); MVP ship list (**local + one private/VPS HTTP-WS** + Tor policy hooks); subtract list; proof plan for R-RELAY-RUST-1.  
**Code:** None (study only).  
**Exit:** Study Pass → R-RELAY-RUST-1 design.

### R-RELAY-RUST-1 — Rust mesh skeleton + local / private dialect L3

**Goal:** Profile-scoped Rust runtime connects **local `:7000` or private/VPS WS**, custom pool of N URLs under one scheduler, publish/subscribe evidence via one snapshot IPC; Tor policy tags honored (fail closed when required).  
**Proof:** `cargo test` · L3 desktop unlock → local/private mesh → DM/evidence Pass.

### R-RELAY-RUST-2 — Product default = alternatives; Nostr opt-in

**Goal:** Presets/boot no longer require public Nostr for “online”; Settings: private/local/VPS/custom pool primary; Tor packs gated on Security; Nostr pack explicit.  
**Proof:** L1 preset contracts · L3 cold profile without damus still reaches readiness on local/private.

### R-RELAY-RUST-3 — Optional `nostr_ws` adapter behind mesh

**Goal:** Public Nostr as **one** adapter under Rust scheduler (failover among user URLs), not a parallel TS pool.  
**Proof:** L3 only when maintainer opts into public pack — never block P0.

### R-RELAY-RUST-4 — Subtract legacy TS orchestrator

**Goal:** Tombstone `enhanced-relay-pool` as product owner once Rust mesh + bridge Pass.  
**Proof:** Boundary/catalog guards · no dual publish owners.

### R-RELAY-RUST-5+ — Reserved extensions (separate slice designs)

| Slice theme | Goal (when chartered) |
|-------------|------------------------|
| **SSH underlay** | [5a–5d Pass](./r-relay-rust-5-ssh-underlay-design-2026-07.md) — bastion/local-forward + preset |
| **Offline / DTN** | [Chartered](./r-relay-rust-6-offline-dtn-charter-2026-07.md) — import/export packs; evidence on import · next **6a** when requested |
| Experimental | mDNS LAN, mixnet hooks — mesh G8 only behind capability flag |

---

## Keep / subtract / freeze

| Keep | Subtract (over slices) | Freeze |
|------|------------------------|--------|
| Conduit mesh **contracts** & evidence ideas | TS as sole failover/pool owner | `@dweb/ui-kit` |
| Transport presets (reprioritize) | Parallel primary-selection auto-reconcile | Community |
| Soft ErrorPanel | Public-Nostr-only boot assumption | AUTH-SESSION-1 |
| R-RELAY-1 pad (interim) | Mock-only `RelayClient` as “connected” lie | Dev Lab |

---

## Mental simulation

**Sender A:** New profile → private VPS / custom pool → message evidence from Rust mesh (clearnet or Tor per policy).  
**Sender B:** Same app → SSH underlay to home relay (future) → same envelope API.  
**Sender C:** Air-gap → offline pack transfer (future) → receiver imports → evidence `imported`.  
**Receiver:** Dialect/underlay invisible; kernel unchanged.  
**Neighbor:** Auth unlock, dm-engine persist, soft warnings — no regress.

---

## Claim language

| May say | When |
|---------|------|
| Chartered | This file + checkpoint |
| Public Nostr default infeasible | Now (documented) |
| Rust mesh implemented | R-RELAY-RUST-1+ |
| Transport fixed | L3 on chosen dialect(s) — not “damus always up” |

---

## Forbidden without slice design

- Big-bang delete of TS pool before Rust L3  
- Second Rust *and* TS failover owner  
- Silent clearnet when Tor required / SSH-only path  
- Implementing SSH or offline “because cool” before local/private L3  
- Kernel or dm-engine forked per dialect  
- Agent-declared “Nostr fixed” from upstream luck  

---

## Next atomic step

**RUST-6d L1 Pass** — [6d UX](../frontend/r-relay-rust-6d-offline-ux-spec-2026-07.md) · USB/QR helper.  

**Next:** Slice 17 R-VAULT (already L1 Pass) · pick **web L3** / **P2 soak** / **LES R6 soak**.  
