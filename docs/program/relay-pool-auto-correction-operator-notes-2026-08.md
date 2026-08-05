# Relay pool auto-correction — operator notes

- Date (UTC): 2026-08-04  
- Slice: **D4** (docs) · design [relay-pool-auto-correction-modes-design-2026-08.md](../../specs/backend/relay-pool-auto-correction-modes-design-2026-08.md)  
- Audience: Maintainers / operators verifying core DM transport without treating Docker Soft L3 as ship proof  
- Related: [self-hosted-relay-vps-operator-notes-2026-08.md](./self-hosted-relay-vps-operator-notes-2026-08.md)

**Paused:** COM-RUN-* · AUTH-SESSION · Dev Lab as production validation · groups/**

---

## 1. First-class default (ship)

| Item | Value |
|------|--------|
| Boot preset | `PRODUCT_BOOT_TRANSPORT_PRESET` = **Default Stable** |
| URLs | `wss://nos.lol` · `wss://relay.primal.net` · `wss://relay.damus.io` |
| Mode | **Multi-node** (`redundancy`) |
| Honesty | Partial publish-ready → **degraded** badge (P14) — not silent green |
| SLA | **None** — public free relays are available rendezvous, not uptime contracts |

Cold/reset profiles land on this pool. Users may switch packs (High Redundancy, Low Latency / Single-node, private mesh, Tor templates).

---

## 2. Single-node vs Multi-node

| Product | Wire | Operator expectation |
|---------|------|----------------------|
| **Multi-node** (default) | `redundancy` | Several sockets live; publish with quorum; badge shows K of N |
| **Single-node (auto-correct)** | `basic` | One primary; on instability promote another healthy enabled relay |
| Failover owner | Rust mesh when `meshSchedulerOwnsFailover` | TS must not dual-switch (RUST-4a) |

Settings copy (EN): Multi-node pool toggle · Single/Multi language from D0/D1.

Specs: [D0 UX map](../../specs/backend/relay-pool-modes-d0-ux-copy-map-2026-08.md) · [D2 Single-node failover](../../specs/backend/relay-pool-d2-single-node-failover-2026-08.md) · [D3 multi-node L1](../../specs/backend/relay-pool-d3-multi-node-public-soak-2026-08.md)

---

## 3. Lab vs remote (Nostr-first)

| Surface | Use |
|---------|-----|
| `ws://localhost:7000` / Docker Soft L3 | **Lab / harness only** — apply Local Dev Mesh alone; never ship proof |
| Public Default Stable | **Default ship / clearnet** surface |
| Self-hosted VPS `wss://…` | **Optional** team/private stability — see VPS notes |

**Dial rule:** when any public/VPS remote is enabled, `localhost:7000` is **always excluded** from the active transport pool (even if the socket looks open). Soft L3 = remotes disabled / Local Dev Mesh pack only.

Do not leave localhost ACTIVE beside public remotes and call that a product topology.

---

## 4. Proof commands (when environment allows)

| Layer | Command / action |
|-------|------------------|
| L1 modes | `pnpm -C apps/pwa exec vitest run app/features/transport-kernel/relay-pool-modes-d1-copy.contract.test.ts app/features/transport-kernel/relay-pool-modes-d3-multi-node.contract.test.ts app/features/relays/services/relay-primary-failover-policy.test.ts` |
| L2 clearnet | `pnpm probe:relay-nip --relays "wss://nos.lol,wss://relay.primal.net,wss://relay.damus.io"` |
| L3 public dial | `pnpm verify:e2-public-only-l3` (desktop online + CDP + unlocked) |
| L3 dual-DM | Soft L3 / manual two-user on public pool — only when harness healthy |

2026-08-04 agent host: L1 Pass · L2 NIP probe **timeout** · L3 deferred. Re-run L2/L3 on a clearnet desktop before claiming soak.

---

## 5. Optional VPS (not required for Single/Multi)

Use [self-hosted-relay-vps-operator-notes-2026-08.md](./self-hosted-relay-vps-operator-notes-2026-08.md) when you need controllable capacity or private team remote. Auto-correct modes work the same over enabled URLs — VPS is another endpoint set, not a second product path.
