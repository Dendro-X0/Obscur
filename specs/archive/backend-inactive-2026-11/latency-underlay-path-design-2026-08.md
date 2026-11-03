# Design — Latency-aware paths · underlays · future channels (v1.9.15)

- Date (UTC): 2026-08-01
- Charter: [v1.9.15-scope.md](../../docs/program/v1.9.15-scope.md)
- Parents: [relay-pool-delivery-strategy-design-2026-08.md](./relay-pool-delivery-strategy-design-2026-08.md) · [public-nostr-pool-unused-investigation-2026-07.md](./public-nostr-pool-unused-investigation-2026-07.md) · [r-relay-rust-1-mesh-skeleton-design-2026-07.md](./r-relay-rust-1-mesh-skeleton-design-2026-07.md)
- Evidence: Relays UI — localhost RTT ~3ms · nos ~395ms · damus ~614ms · publish-ready 2/3 · open 3/3

## Session gate

```text
HANDOFF ATOMIC STEP: Soft L3 Fail · E2d L1 — charter v1.9.15 PATH+LATENCY
PAUSED / CANCELLED:  COM-RUN-* · AUTH-SESSION · Dev Lab as validation
CANONICAL OWNERS:
  Dial membership — resolveActivePoolRelayUrls
  Publish plan — resolveScopedPublishRelayUrls · dm-send-pipeline
  Underlay — Tor policy · transport presets · mesh underlay slots
PROOF: Soft L3 · L1 selector/publish tests · Relays path-class UX
OUT OF SCOPE THIS DOC: COM-RUN code · full NIP-65 impl · Tor-by-default
```

**This document is the design for v1.9.15 tracks P15-L / P15-U / P15-F.** Implementation follows charter slice order. No claim of “public Nostr fixed” from this doc alone.

---

## 1. Invariants

| ID | Invariant |
|----|-----------|
| **I1** | dialect ≠ underlay — Nostr WS / offline / sealed CM are dialects; clearnet / Tor / SSH / LAN are underlays |
| **I2** | Delivery needs publish ∩ subscribe, not identical Settings screens |
| **I3** | Localhost / LAN is lab or private shared store — never sole WAN publish when remotes are enabled (E2c/E2d) |
| **I4** | UI success requires transport evidence (ACK / quorum / imported) — local echo ≠ delivered |
| **I5** | Privacy underlays (Tor, stacked VPN) may increase RTT; product must disclose, not hide |
| **I6** | One canonical path owner per concern — no parallel “latency engine” outside mesh/pool |

---

## 2. Observed latency classes (budgets)

Budgets are **soft** for ranking and UX; not hard disconnects unless policy says so.

| Class | Typical RTT | Examples | Interactive DM preference |
|-------|-------------|----------|---------------------------|
| **C0 Local/LAN** | &lt; 50ms | `ws://localhost:7000`, intranet WS | Lab / same-site only |
| **C1 Regional clearnet** | 50–250ms | Nearby VPS, regional public | Prefer when peer is remote |
| **C2 Global clearnet** | 250–800ms | nos.lol / damus / primal (as measured) | Allowed; rank by observed RTT |
| **C3 Privacy path** | 800ms–3s+ | Tor SOCKS, Tor+VPN stack | Opt-in only; warn in UI |
| **C4 Challenged path** | High RTT + jitter/loss | Starlink, congested mobile | Longer ACK timeout · queue · smaller fan-out |

**Ranking input (v1.9.15):** observed App RTT + publish-ready + open socket. Do not invent synthetic “speed scores” without samples (`INSUFFICIENT DATA` stays honest).

---

## 3. Path plan architecture

```text
┌──────────────────────────────────────────────────────────┐
│ Dial pool (≤N warm sockets)                              │
│  primary + remotes padded (basic E2d / redundancy)         │
└───────────────┬──────────────────────┬───────────────────┘
                │                      │
        ┌───────▼────────┐     ┌───────▼─────────┐
        │ Publish plan   │     │ Subscribe plan  │
        │ RTT + ready +  │     │ intersection /  │
        │ intersection   │     │ scoped CM URL   │
        └───────┬────────┘     └─────────────────┘
                │
        ┌───────▼────────┐
        │ Evidence       │
        │ ACK / quorum / │
        │ queued_retry   │
        └────────────────┘
```

### 3.1 Dial (P15-D / E2d)

- Basic + **live local primary** → still pad enabled remotes (E2d Implemented L1).
- Redundancy → up to 3; never local-only when remotes enabled (E2c).
- Dead public primary (e.g. damus 503) → keep dialing live remotes; do not starve.

### 3.2 Publish (P15-L / Soft L3 D2)

| Rule | Behavior |
|------|----------|
| **P-remote** | If any remote enabled and peer is not proven same-LAN, prefer **publish-ready remotes** ordered by lowest observed RTT |
| **P-local** | Local allowed for lab Soft L3 when **agreed path** is localhost on both profiles |
| **P-budget** | Soft-skip interactive primary attempt above C3 unless user selected Private pack / Tor |
| **P-evidence** | `deliveryStatus` / UI must not claim relay success when no ACK; queue/retry is explicit |
| **P-fanout** | Optional backup fan-out to 2nd open remote after first ACK path chosen — durability, not blocking UX |

### 3.3 Subscribe

- DM: warm pool subscriptions on dial set.
- CM: remain **scoped** to community relay URL (sealed) — latency improvements do not rewrite CM scope.

---

## 4. Intent packs (P15-L3)

Map onto existing preset catalog — **do not** add a second pack owner.

| Intent | Dial bias | Publish bias | Underlay |
|--------|-----------|--------------|----------|
| **Fast chat** | Low-RTT clearnet + optional regional VPS; disable chronically dead hosts | Lowest RTT publish-ready remote | Clearnet; Tor off |
| **Durable** | Redundancy ≤3 publics | Fan-out to open pool | Clearnet |
| **Private** | Tor-required / onion when ready | Accept C3 latency | Tor on; fail-closed |
| **Lab** | Local Docker + optional public | Agreed Soft L3 path | Clearnet; local OK if both agree |

---

## 5. Underlays — VPN / proxy / Tor (P15-U)

| Underlay | Product rule |
|----------|----------------|
| Clearnet direct | Default for Fast / Durable |
| System VPN / HTTP proxy | Observe RTT through it; rank honestly; no special “boost” |
| Tor opt-in | Badge: off / not-ready / ready; packs fail-closed until ready |
| Tor + VPN stacked | Warn: expected C3–C4; not Fast pack |

**Never** silent clearnet fallback when `tor_required`.

---

## 6. Future channels (P15-F — design freeze in 1.9.15)

### 6.1 Operator / regional VPS

- Custom WS/HTTP mesh URL in DM adapters or workspace candidates.
- Fast pack may prefer operator URL when both peers configure it.
- Same intersection rule as Nostr.

### 6.2 NIP-65 outbox / inbox (Phase 2)

- Publish to author write + recipient read relays; subscribe to peer write.
- Obscur pool remains bootstrap/fallback.
- **Not implemented in 1.9.15** — charter only; see delivery strategy §4.1 Phase 2.

### 6.3 Starlink / satellite profile

| Knob | Guidance |
|------|----------|
| Publish ACK timeout | Raise vs fiber (e.g. 2–3× C2 default) |
| Parallel dial fan-out | Prefer 1–2 relays, not max redundancy storms |
| Queue | First-class `queued_retrying` under loss |
| Tor | Discourage stacking Tor over Starlink for chat UX |
| UX | “High-latency link” path class |

### 6.4 Offline DTN / sneakernet

- Dialect: store-forward / offline import ([RUST-6](./r-relay-rust-6-offline-dtn-charter-2026-07.md)).
- Evidence: `imported` — never `socket_open` green.

### 6.5 SSH / private mesh underlay

- Reserved mesh underlay ([RUST-5](./r-relay-rust-5-ssh-underlay-design-2026-07.md)).
- Use when operator provisions private links; can beat public Nostr RTT.

---

## 7. Slice → proof map

| Slice | Spec section | Proof |
|-------|--------------|-------|
| E2d / D3 | §3.1 | Relays UI public POOL MEMBER / Connected |
| D2 publish honesty | §3.2 P-evidence | Soft L3 + runtime: no null publish ACK on “sent” |
| D1 Soft L3 | Soft L3 recipe | `l3.pass === true` |
| L1–L2 RTT publish | §2–§3.2 | Unit + Soft L3 on public or agreed path |
| L3 packs | §4 | Preset apply · mode/list match intent |
| L4 UX path class | §2 | Copy review · screenshot |
| U1–U4 | §5 | Tor badge + warning · L1 policy tests |
| F1–F5 | §6 | Design frozen; no false “shipped” |

---

## 8. Claim language

| May say | When |
|---------|------|
| v1.9.15 charter active | This doc + [v1.9.15-scope](../../docs/program/v1.9.15-scope.md) |
| Soft L3 Pass | Recipe report Pass |
| Delivery fixed | Soft L3 Pass + maintainer sign-off on agreed path |
| Path latency improved | L1–L2 landed + L3 evidence of preferring lower-RTT remote |
| Public Nostr SLA | **Never** from Soft L3 / 1.9.15 alone |
| NIP-65 / Starlink / DTN shipped | Only when those slices Implement + Verify |

---

## 9. Non-goals

- Mbps marketing claims  
- Replacing mesh with a greenfield “multi-protocol router”  
- Unpausing COM-RUN for latency work  
- Default Tor for all users  
