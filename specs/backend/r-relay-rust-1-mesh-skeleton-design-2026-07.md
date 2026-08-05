# Design — R-RELAY-RUST-1 mesh skeleton (local + private/VPS)

**Status:** **1a–1d L1 Pass** · **L3-lab Pass** · L3-product pending Docker · 2026-07-30  
**Study:** [r-relay-rust-0-feasibility-inventory-2026-07.md](./r-relay-rust-0-feasibility-inventory-2026-07.md)  
**Charter:** [r-relay-rust-mesh-charter-2026-07.md](./r-relay-rust-mesh-charter-2026-07.md)  
**Contracts (mirror):** `@obscur/conduit-mesh-contracts` · `@obscur/transport-engine` `TransportSnapshot`  
**Seed:** `apps/desktop/src-tauri/src/relay.rs` (production WS) — **not** `libobscur` mock `RelayClient`

### Implementation progress

| Slice | Status | Evidence |
|-------|--------|----------|
| **1a** descriptor + registry | **L1 Pass** | `mesh/` |
| **1b** scheduler + configure→connect | **L1 Pass** | configureMeshConduits dials active set |
| **1c** snapshot + TS mapper | **L1 Pass** | `getMeshSnapshot` · mapper |
| **1d** publish bridge | **L1 Pass** · **L3-lab Pass** · L3-product pending Docker | `publishMeshEnvelope` · `mesh::l3_soak` · [runbook](./r-relay-rust-1d-l3-soak-runbook-2026-07.md) |

---

## Session gate

```text
NEXT ATOMIC STEP:     R-RELAY-RUST-2 — defaults away from public Nostr (optional L3-product when Docker up)
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNER:      Rust ConduitMeshRuntime (grown from desktop RelayPool) · TS config/UI only
PROOF BEFORE DONE:    L1 cargo + vitest bridge · L3-lab Pass · L3-product optional
OUT OF SCOPE:         SSH underlay · offline DTN · public Nostr default · community · delete TS pool in same PR
```

---

## 1. Problem / goal

Today sockets live in Rust (`relay.rs`) but **membership, failover, and readiness narration** still live in TS (pool pad, supervisor, mesh hook). Public Nostr as default is infeasible. We need a **Rust mesh skeleton** that:

1. Accepts **versioned conduit descriptors** (custom pools, VPS URLs, Tor policy).  
2. Opens and schedules connections itself (absorb R-RELAY-1 pad intent).  
3. Emits one **snapshot** UI can trust.  
4. Leaves SSH/offline as **reserved** underlay/dialect slots without blocking MVP.

---

## 2. Target architecture

```text
Presets / Settings (TS)
        │  ConduitDescriptor[] + profileId
        ▼
engine_invoke transport.configureMeshConduits
        ▼
┌─────────────────────────────────────────────────────────┐
│  ConduitMeshRuntime (Rust · desktop)                    │
│  registry · Tor policy · scheduler · evidence hints     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐│
│  │ UnderlayPort│→ │ DialectPort  │→ │ EndpointConn   ││
│  │ clearnet    │  │ nostr_ws     │  │ (existing WS   ││
│  │ tor_socks   │  │ team_relay*  │  │  from relay.rs)││
│  │ ssh* later  │  │ custom*      │  └────────────────┘│
│  └─────────────┘  └──────────────┘                     │
└─────────────────────────────────────────────────────────┘
        │  event: mesh-snapshot-changed · inbound
        ▼
TS map → TransportSnapshot / Settings · soft ErrorPanel
```

\* RUST-1: `nostr_ws` over local/private WS is **must**; `team_relay` / `custom` HTTP may be **stub** (health probe only) if time-boxed — design requires **at least one** non-public path to L3 Pass (local `:7000` via `nostr_ws` or raw WS dialect alias).

---

## 3. Module layout (Rust)

Prefer **new modules beside** `relay.rs`, then thin-wrap existing pool — avoid a 2k-line godfile rewrite in one PR.

| Module (proposed) | Responsibility |
|-------------------|----------------|
| `mesh/mod.rs` | Runtime façade, profile/window scope key |
| `mesh/descriptor.rs` | Serde types mirroring TS `ConduitDescriptor` + optional `underlay` |
| `mesh/registry.rs` | Configure / enable / list conduits |
| `mesh/scheduler.rs` | Which endpoints get live connections (pad + promote) |
| `mesh/tor_policy.rs` | Port of `filterConduitsByTorPolicy` / fail-closed |
| `mesh/snapshot.rs` | Build mesh snapshot → JSON for IPC |
| `mesh/dialect/mod.rs` | `DialectPort` trait |
| `mesh/dialect/nostr_ws.rs` | EVENT/REQ over WS (reuse `RelayPool` connect/publish) |
| `mesh/underlay/mod.rs` | `UnderlayPort` — resolve dial target + proxy |
| `mesh/underlay/clearnet.rs` / `tor_socks.rs` | Wire to `NativeNetworkRuntime` |
| `relay.rs` | Keep low-level WS connection machine; called by dialect |

**Forbidden:** Product calls into `libobscur::net::relay::RelayClient` (mock Connected).

---

## 4. Traits (sketch)

```rust
/// How bytes reach the peer. Dialects do not open raw sockets themselves
/// when an underlay is set — they receive a DialTarget { url, proxy }.
trait UnderlayPort: Send + Sync {
    fn id(&self) -> UnderlayId; // clearnet | tor_socks | ssh_tunnel (later)
    async fn resolve(&self, endpoint: &str, policy: NetworkPolicy) -> Result<DialTarget, MeshError>;
}

/// Wire map for one dialect. Ciphertext stays opaque.
trait DialectPort: Send + Sync {
    fn dialect(&self) -> DialectId;
    async fn connect(&self, conduit_id: &str, dial: DialTarget) -> Result<(), MeshError>;
    async fn disconnect(&self, conduit_id: &str) -> Result<(), MeshError>;
    async fn probe(&self, conduit_id: &str) -> ProbeResult;
    async fn publish(&self, conduit_id: &str, envelope: &MeshEnvelopeWire) -> PublishOutcome;
    // subscribe/pull: RUST-1 minimum = nostr_ws REQ interest; HTTP pull can follow
}
```

**Envelope wire (IPC):** JSON-compatible with TS `MeshEnvelope`, ciphertext as base64 field `ciphertextBase64` (same as custom HTTP contract). Kernel still owns encrypt/decrypt.

---

## 5. Descriptor schema (versioned)

Mirror `@obscur/conduit-mesh-contracts` `ConduitDescriptor`. Additive field:

```json
{
  "conduitId": "local-dev-1",
  "dialect": "nostr_ws",
  "endpoints": ["ws://127.0.0.1:7000"],
  "capabilities": ["publish", "subscribe"],
  "networkPolicy": "clearnet",
  "trustTier": "user_configured",
  "enabled": true,
  "priority": 10,
  "label": "Local mesh",
  "underlay": "clearnet"
}
```

| Field | Rules |
|-------|--------|
| `underlay` | Optional. Default: `tor_socks` if `networkPolicy` is `tor_required` \| `tor_preferred` and Tor ready; else `clearnet`. Unknown underlay → conduit `blocked`, not panic |
| `dialect` | Unknown → soft-fail configure warning; skip conduit |
| `endpoints` | Custom pool = multiple conduits **or** one conduit with multiple endpoints (RUST-1: **one conduit per URL** for nostr_ws — simpler failover accounting; pool = N descriptors) |
| `trustTier` | `public_untrusted` never boot-default after RUST-2; allowed if user opts in |

**Presets → descriptors:** TS `transport-preset-catalog` apply builds `ConduitDescriptor[]` and calls configure. No second URL-only path that bypasses registry for mesh-owned profiles.

---

## 6. Scheduler (absorb R-RELAY-1)

For enabled conduits in a profile scope:

1. Sort by `priority` (desc), then list order.  
2. Apply Tor filter (`tor_required` needs Tor ready).  
3. **Active set:** up to `max_redundancy` (default 3) — prefer healthy/writable, **pad** with remaining enabled (not circuit-open) so cold standbys still connect.  
4. On primary failure (writable count for active set → 0 or circuit open): promote next candidate; reconnect; bump snapshot revision.  
5. **Single owner:** TS must not run `attemptPrimaryFailover` for mesh-owned scopes once flag `meshSchedulerOwnsFailover=true` (RUST-1b+). Until then, dual-run: Rust pads connections; TS failover may still exist — **RUST-1c** sets the flag when snapshot proves writable>0.

Circuit: open after N connect/publish failures; cooldown in registry (mirror TS hints conceptually).

---

## 7. IPC surface

Prefer **`engine_invoke` engine=`transport`** methods (consistent with checkpoint/publish tombstones). Additive commands only.

| Method | Direction | Body (summary) | Result |
|--------|-----------|----------------|--------|
| `configureMeshConduits` | TS→Rust | `{ profileId, scope, conduits: Descriptor[] }` | `{ ok, revision, skipped[] }` |
| `getMeshSnapshot` | TS→Rust | `{ profileId, scope }` | `MeshSnapshotJson` |
| `publishMeshEnvelope` | TS→Rust | `{ profileId, scope, envelope }` | `{ accepted, evidence[], errorMessage? }` |
| (existing) `publish` relay event | keep | nostr path via dialect until DM kernel fully envelope-based | unchanged for non-mesh callers |

**Events (window or app):** `mesh-snapshot-changed` with `{ profileId, revision, snapshot }` — replace reliance on inventing readiness from per-URL connect events alone for mesh mode.

### MeshSnapshotJson → TransportSnapshot map (TS)

| Mesh field | TransportSnapshot |
|------------|-------------------|
| phase / readiness | `phase` / `recovery.readiness` |
| enabled endpoints | `enabledRelayUrls` |
| writable / subscribable counts | recovery metrics |
| lastFailureReason | `recovery.lastFailureReason` |
| revision | `revision` |

Soft ErrorPanel: map `lastFailureReason` codes (`tor_unreachable`, `connect_failed`, `no_viable_conduit`) into existing soft relay-connect slot — do not stack harsh toasts.

---

## 8. Tor / underlay behavior (RUST-1)

| Policy | Behavior |
|--------|----------|
| `clearnet` | Direct dial |
| `tor_preferred` | Prefer SOCKS if Tor ready; if envelope/conduit allows, may try clearnet only when policy explicitly allows fallback (default: prefer Tor, document envelope flag later) |
| `tor_required` | SOCKS only; if Tor not ready → conduit `blocked`, snapshot reason `tor_unreachable` — **never** silent clearnet |

SSH: reserved — `UnderlayId::SshTunnel` returns `unsupported` until RUST-5.

---

## 9. Mental simulation

**A — Local MVP:** Unlock Tester1 → apply `local_dev_mesh` → `configureMeshConduits` with `ws://127.0.0.1:7000` → Rust connects → snapshot `healthy`/`degraded` with writable≥1 → DM publish via mesh or existing host publish against that URL → evidence. No damus required.

**B — VPS custom pool:** Three user `wss://` private URLs as three descriptors → scheduler pads to 3 → one dies → promote, snapshot updates.

**C — Tor required:** Onion or tor_required pack → Tor off → soft fail reason, no clearnet leak.

**D — Neighbors:** Auth unlock, dm persist, soft panel, community PAUSED — untouched.

---

## 10. Implementation slices (RUST-1)

| Slice | Deliverable | Proof |
|-------|-------------|-------|
| **1a** | `mesh/descriptor` + registry serde + unit tests; no live dial yet | `cargo test` descriptor round-trip |
| **1b** | Scheduler selects active set; `configureMeshConduits` opens nostr_ws via existing `connect_relay_internal` | cargo + desktop connect to `:7000` or mock |
| **1c** | `getMeshSnapshot` + event + TS mapper; mesh failover flag | vitest map · L2 snapshot writable |
| **1d** | `publishMeshEnvelope` (nostr_ws adapter) **or** document bridge: mesh-owned URLs still use existing transport publish against connected pool | L3 DM evidence on local/private |

**RUST-1 exit (slice 1d):** L3 Pass on local or private path without public Nostr. Then RUST-2 (defaults) / RUST-3 (optional public adapter polish).

---

## 11. Dual-run / subtract rules during RUST-1

| Do | Do not |
|----|--------|
| Feature-flag mesh configure path (`OBSCUR_RUST_MESH=1` or desktop-only) | Force all profiles onto incomplete mesh |
| Keep legacy `connect_relay` for non-mesh | Wire UI to libobscur mock |
| Pad connections in Rust when mesh configured | Add second TS failover owner |
| Soft-map failures | Claim “relays fixed” on public hosts |

---

## 12. Proof before “RUST-1 implemented / verified / fixed”

| Claim | Requires |
|-------|----------|
| Design Pass | This document |
| Implemented | 1a–1d code landed |
| Verified (L1) | Named cargo + vitest green |
| Fixed (product) | L3: unlock → local/private snapshot ready → send evidence **without** damus |

---

## 13. Exit criteria — Design Pass

- [x] Module + trait sketch  
- [x] Descriptor + underlay additive field  
- [x] Scheduler (pad/promote) ownership  
- [x] IPC + snapshot map  
- [x] Tor fail-closed  
- [x] Sliced implement plan 1a–1d  
- [x] Dual-run safety  

**Next atomic step:** Implement **RUST-1a** — Rust `mesh/descriptor` + registry serde + `cargo test` round-trip (no live dial).
