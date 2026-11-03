# R-RELAY-RUST-0 — Feasibility + keep-set inventory

**Status:** **Study Pass** · 2026-07-30 — unlocks **R-RELAY-RUST-1 design** (still **no mesh product code** until that design exists)  
**Charter:** [r-relay-rust-mesh-charter-2026-07.md](./r-relay-rust-mesh-charter-2026-07.md)  
**Prior:** [r-relay-0-integration-study-2026-07.md](./r-relay-0-integration-study-2026-07.md) (TS pool dual-path) · [public-relay-connect-fail-investigation-2026-07.md](./public-relay-connect-fail-investigation-2026-07.md)  
**Concept:** [obscur-conduit-mesh-concept-2026-06.md](../../docs/program/obscur-conduit-mesh-concept-2026-06.md)

---

## Session gate

```text
NEXT ATOMIC STEP:     R-RELAY-RUST-0 study → R-RELAY-RUST-1 design (local/private mesh skeleton)
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNER (target): Rust mesh runtime (grow from desktop RelayPool) + dialect/underlay adapters
PROOF THIS DOC:       Owner map · capability registry stub · MVP ship list · subtract list · RUST-1 hypotheses
OUT OF SCOPE:         Product/mesh implementation diffs · SSH/offline impl · community · claiming public Nostr fixed
```

---

## 1. Verdict (feasibility)

| Question | Answer |
|----------|--------|
| Can we redesign transport in Rust for long-term scale? | **Yes** — new approach (rules/11), not another TS pool patch |
| Greenfield from `libobscur::net::relay`? | **No** — that client is a **mock WS** (`Connected` without socket). Do not treat it as production |
| Best Rust seed? | **`apps/desktop/src-tauri/src/relay.rs`** — real `tokio-tungstenite` pool, probe, Tor SOCKS via `NativeNetworkRuntime`, `publish_event_with_ack` |
| Public Nostr as boot default? | **Infeasible** as sole path (upstream TLS/503). Keep as **optional** dialect |
| Custom pools / VPS / Tor / SSH / offline? | Feasible as **capability slots** (dialect vs underlay). Ship local+private+Tor policy first; SSH/offline reserved |

**Outcome:** Proceed to **R-RELAY-RUST-1 design** — grow desktop RelayPool into profile-scoped mesh runtime; port/align `@obscur/conduit-mesh-contracts`; TS becomes config + UI evidence binder.

---

## 2. Owner map (current truth)

### 2.1 Rust surfaces

| Module | Role today | Keep / evolve |
|--------|------------|---------------|
| `apps/desktop/src-tauri/src/relay.rs` | **Production** native WS: `connect_relay`, `disconnect_relay`, `probe_relay`, `RelayPool::publish_event_with_ack`, window-scoped connections | **KEEP — seed for mesh runtime** |
| `commands/transport_engine.rs` | `engine_invoke` transport publish → RelayPool ACK | KEEP — bridge pattern for mesh IPC |
| `NativeNetworkRuntime` (+ Tor commands) | Tor enable / SOCKS proxy URL for connects | KEEP — underlay policy input |
| `packages/libobscur/src/net/relay.rs` | Scaffold: SOCKS open then **fake Connected** | **Subtract as product truth**; optional later rewrite or delete |
| `packages/libobscur/src/net/pool.rs` | Scaffold broadcast stub | Same — do not wire product through it |
| `packages/libobscur/src/net/mod.rs` | Background Nostr-shaped sync over raw WS | Legacy sync path — inventory for RUST-1 whether still needed |

### 2.2 TypeScript / package surfaces

| Module | Role today | Keep / evolve |
|--------|------------|---------------|
| `native-relay.ts` | Desktop: invoke `connect_relay` / events; soft connect errors | KEEP as thin IPC client until mesh snapshot IPC replaces ad-hoc events |
| `resolveActivePoolRelayUrls` + R-RELAY-1 pad | Which URLs get sockets (redundancy) | **Interim** — migrate selection into Rust scheduler |
| `relay-runtime-supervisor` + `relay-provider` failover | TS automatic failover owner | Subtract once Rust owns lane promotion |
| `use-relay-primary-selection` | Roles only (no auto-reconcile — render-depth) | UI roles OK; must not re-own sockets |
| `relay-pool-hook-port` | Tri-route: legacy \| **conduit mesh (default when TK owns)** \| TK enhanced | Mesh TS runtime is **staging**, not final Rust owner |
| `@obscur/conduit-mesh` + `createConduitMesh` | Dialect drivers, Tor filter, evidence ledger (TS) | **Contracts + semantics KEEP**; runtime moves to Rust over slices |
| `@obscur/conduit-mesh-contracts` | `ConduitDescriptor`, dialects, Tor policy, evidence classes | **KEEP — port/mirror to Rust** as registry schema |
| `@obscur/transport-engine` | `TransportSnapshot` readiness | KEEP — map mesh snapshot → existing UI contracts |
| `transport-preset-catalog` | public / private / hybrid / Tor packs | KEEP — emit descriptor packs into Rust |
| `enhanced-relay-pool*` | Legacy browser pool | Tombstone path (RUST-4) |
| Soft `ErrorPanel` / `native-error-store` | Soft relay-connect UX | KEEP — do not regress |

**Correction to R-RELAY-0 wording:** Conduit Mesh pool hook is **default** when transport-kernel owns the pool (`NEXT_PUBLIC_OBSCUR_CONDUIT_MESH_POOL≠0`). It is still **TS-orchestrated** (drivers call native/host ports) — not the Rust mesh end state.

### 2.3 Parallel paths (conflict scan)

```text
Preset / Settings URLs
        │
        ▼
TS: primary selection + resolveActivePoolRelayUrls  ←── still decides membership
        │
        ▼
useRelayPoolRuntime → conduit-mesh OR kernel OR legacy
        │
        ▼
native-relay / host publish ──► desktop relay.rs sockets
        │
        ▼
transport-engine snapshot / mesh getSnapshot (TS)  ←── dual readiness narrators risk
```

| Conflict | Risk if ignored |
|----------|-----------------|
| TS selection + Rust sockets | Standbys / custom pools never connected; Rust cannot schedule what it never sees |
| TS mesh + TS supervisor + primary failover | Dual recovery owners (historical freeze) |
| libobscur scaffold “Connected” | Lying readiness if anyone wires UI to it |
| Nostr-shaped EVENT JSON in `publish_event_with_ack` | Fine for `nostr_ws`; **wrong** as sole publish API for custom/VPS/HTTP — need dialect-neutral envelope publish |

**Working neighbors (must not regress):** soft ErrorPanel · transport checkpoint `engine_invoke` · R3 publish tombstone · auth unlock · dm-engine persist · community PAUSED.

---

## 3. Capability registry stub

Statuses: `shipped` (usable now somewhere) · `scaffold` (contracts/code exist, not product-complete) · `reserved` (charter only).

| Capability ID | Kind | Status | Notes |
|---------------|------|--------|-------|
| `dialect.nostr_ws` | dialect | scaffold / optional | Desktop WS + NIP OK path; public hosts unreliable |
| `dialect.team_relay` | dialect | scaffold (TS mesh) | Private trust path — MVP target |
| `dialect.custom` | dialect | scaffold (HTTP contract) | VPS / self-host gateway |
| `dialect.coordination_http` / `_sse` | dialect | scaffold (TS) | Not RUST-1 critical path |
| `dialect.lan_mdns` | dialect | reserved | Contracts enum already |
| `dialect.store_forward` | dialect | reserved | Offline-ish; extend to DTN |
| `pool.custom_urls` | config | shipped (Settings) | Same schema → Rust registry |
| `pack.vps_private` | preset | scaffold | Private/LAN presets; treat VPS as user URLs + trust tier |
| `underlay.clearnet` | underlay | shipped | Default |
| `underlay.tor_socks` | underlay | shipped (desktop) | Policy tags on descriptor; fail closed when `tor_required` |
| `underlay.ssh_tunnel` | underlay | **reserved** | Bastion / local-forward; dialect unchanged |
| `dialect.offline_import` | dialect | **reserved** | Evidence `imported` / store_forward class — RUST-5+ |
| `mesh.scheduler` | runtime | **missing in Rust** | Lane promote across conduits — RUST-1+ |
| `mesh.evidence_ledger` | runtime | scaffold (TS) | Port with snapshot IPC |
| `descriptor.underlay` field | schema | **missing** | Today only `networkPolicy`; RUST-1 design adds optional `underlay` without breaking descriptors |

---

## 4. MVP ship list (RUST-1 scope recommendation)

**In:**

1. Profile-scoped (or window→profile mapped) Rust runtime grown from `relay.rs`  
2. Configure conduits from **descriptor list** (mirror contracts): local `ws://127.0.0.1:7000` + **one private/VPS WS or custom HTTP**  
3. Custom pool = N endpoints under one scheduler (pad/failover in Rust — absorb R-RELAY-1 intent)  
4. Tor: honor `networkPolicy` + existing SOCKS path; **no silent clearnet** when required  
5. One snapshot IPC → map to `TransportSnapshot` / Settings readiness  
6. Publish path: dialect-neutral envelope **or** thin `nostr_ws` adapter + `team_relay`/`custom` stub — design picks one envelope contract  

**Out of RUST-1:**

- SSH underlay  
- Offline/QR/BLE  
- Public Nostr as boot default  
- Deleting TS pool in the same PR  
- Community / AUTH-SESSION-1 / Dev Lab  

---

## 5. Subtract list (ordered, not all at once)

| Phase | Subtract |
|-------|----------|
| RUST-1 | New product wiring to `libobscur` mock `RelayClient` |
| RUST-2 | Boot/default dependence on public Nostr packs |
| RUST-3–4 | TS as sole `resolveActivePoolRelayUrls` + supervisor failover owner |
| RUST-4 | `enhanced-relay-pool` product ownership |
| Later | Duplicate TS `createConduitMesh` runtime once Rust parity L3 Pass |

---

## 6. Bridge contract (target)

| Direction | Payload |
|-----------|---------|
| TS → Rust | `configureConduits(profileId, ConduitDescriptor[])` · `publishEnvelope` · Tor state refresh |
| Rust → TS | Mesh/Transport snapshot (phase, writable count, per-conduit health, lastFailureReason, evidence hints) · inbound events |
| Forbidden | Second publish owner “for compatibility” · UI inventing connected without snapshot |

Reuse existing `engine_invoke` transport patterns where possible; avoid new ambient global pool.

---

## 7. Mental simulation (MVP)

**Sender:** Unlock → apply private/local pack (or custom VPS URLs) → Rust opens sockets → send → ACK/evidence on snapshot. Tor-required fails closed if Tor not ready.  
**Receiver:** Same descriptors; inbound via dialect adapter.  
**Public Nostr user:** Opt-in pack later (RUST-3); not required for “online.”  
**Future SSH:** Underlay opens local port; same `team_relay` dialect.  
**Future offline:** Import pack → evidence class satisfied without live socket.

---

## 8. Proof plan (named for later slices)

| Layer | RUST-0 (this doc) | RUST-1 (after design) |
|-------|-------------------|------------------------|
| L1 | Study Pass + charter align | `cargo test` mesh/local connect · vitest bridge map |
| L2 | — | Desktop unit against local `:7000` or mock WS |
| L3 | — | Unlock → private/local ready → DM evidence without damus |
| L4 | — | Optional maintainer soak matrix (Tor on/off) |

**Claim language:** This study does **not** claim transport fixed or Rust mesh implemented.

---

## 9. R-RELAY-RUST-1 design hypotheses (inputs)

1. **Grow `relay.rs`**, do not replace with libobscur scaffold.  
2. Add **descriptor registry + scheduler** beside (then above) URL-keyed connections.  
3. Mirror `@obscur/conduit-mesh-contracts` in Rust (shared JSON schema or duplicated types with contract tests).  
4. Optional `underlay` on descriptor; default `clearnet` / derive from `networkPolicy` for Tor.  
5. TS `configure` from presets; stop owning failover once Rust emits healthy standbys.  
6. Keep soft ErrorPanel; map Rust failure reasons to soft slot.

---

## 10. Exit criteria — Study Pass

- [x] Rust vs TS owners inventoried  
- [x] Capability registry stub (custom/VPS/Tor/SSH/offline)  
- [x] MVP vs reserved split  
- [x] Subtract order  
- [x] Bridge sketch + RUST-1 hypotheses  
- [x] No product mesh code in this slice  

**Next atomic step:** Write `specs/backend/r-relay-rust-1-mesh-skeleton-design-2026-07.md` — IPC shapes, trait sketch (`ConduitPort` / underlay), local+private L3 plan. **No implementation until that design Pass.**
