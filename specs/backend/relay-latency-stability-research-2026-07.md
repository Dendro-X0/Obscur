# Research study — Relay latency accuracy · connection stability · public vs self-hosted

- Date (UTC): 2026-08-01
- Type: **Research only** (no product code in this pass)
- Trigger: Maintainer — continue exploring UI latency accuracy + connectivity stability/speed for Nostr public relays and self-hosted (VPS) nodes
- Product rule (prior): Local lab ≠ remote interaction; remote needs public relay or VPS

## Session gate

```text
NEXT ATOMIC STEP: Hold — E2c local-lab vs remote dial (L1)
PAUSED / CANCELLED: COM-RUN-* · AUTH-SESSION · Dev Lab as validation
OUT OF SCOPE THIS PASS: Implementation · community un-pause · AUTH-SESSION
```

## Baseline (screenshot evidence · same session band)

| Node | Role | Socket | Latency UI | Notes |
|------|------|--------|------------|-------|
| nos.lol | Active transport | open | **17ms** | “No recent events” (freshness ≠ RTT) |
| primal | Pool member | open | **48ms** | Samples present; success still n/a |
| damus | Standby | disconnected | n/a | Expected when outside active pool / upstream flaky |
| localhost:7000 | Pool member | open | n/a / 0 samples | Lab node; quiet WS often yields no probe frame |

Success rate **n/a · Insufficient data (2)** is by design today (`≥5` connect samples in `relay-runtime-status`). That is **honesty**, not a broken RTT path.

---

## 1. What “latency” can mean (taxonomy)

Mixing these in one number produces misleading UI.

| Kind | Definition | Obscur today | Good for |
|------|------------|--------------|----------|
| **L-open** | Time to WebSocket `open` | NativeRelay connect RTT; standby probe open-handshake fallback | Dial / TLS cost |
| **L-frame** | Time to first inbound frame (NOTICE/etc.) | Probe if relay greets; else falls back to L-open | “Relay alive” |
| **L-app** | Application RTT on an **existing** pool socket (e.g. REQ→EOSE or EVENT→OK) | **Not owned** | True “network speed” for messaging |
| **L-publish** | Sign→OK / quorum wait | Publish path metrics (separate) | Send UX, not Relays card |
| **Freshness** | Time since useful inbound EVENT | `lastInboundEventAtUnixMs` → “No recent events” | Traffic/health, **not** latency |

**Recommendation:** Relays UI should label samples as **connect** vs **round-trip** once L-app exists; do not treat “No recent events” as slow network.

---

## 2. More accurate latency (UI + measurement research)

### 2.1 Gaps in current writers

| Writer | Owner | Limitation |
|--------|-------|------------|
| Standby/enabled probe | `probeStandbyRelayLatency` | **Second socket**; L-open/L-frame only; can disagree with pool NativeRelay path |
| Connect RTT | `NativeRelay.recordOpenLatencyOnce` | One-shot per connect; inflated if timer starts too early (init vs connect) |
| Pool health bridge | `useConduitMeshRelayPool` ← `relayHealthMonitor` | Displays whatever was recorded; no L-app |

### 2.2 Candidate techniques (Nostr-safe)

Ranked for Obscur (privacy-first, minimal ambient traffic):

| ID | Method | Pros | Cons | Fit |
|----|--------|------|------|-----|
| **M1** | **REQ→EOSE RTT** on pool socket (`["REQ", id, {kinds:[…], limit:0}]` or ultra-narrow filter) | True L-app; no second WS; works on quiet relays | Must CLOSE; avoid overlapping product sub IDs; some relays slow on empty REQ | **Best next** for accuracy |
| **M2** | **EVENT→OK** sample (ephemeral disposable kind or dry-run only if relay allows) | Matches publish path | Write traffic; policy/spam risk on public relays | Prefer **self-hosted/VPS** only |
| **NIP WebSocket ping** | Browser/Tauri WS ping frames | Cheap keepalive + RTT | Not always exposed to JS; not Nostr-semantic | Platform-dependent |
| **M3** | Keep L-open probe but **tag** `source: "handshake" \| "app"` in metrics | UI honesty without new dial | Still two numbers to explain | UI slice |
| **M4** | Separate sparkline: connect vs app | Clear | More UI surface | After M1 |

**Avoid:** Recording frame-timeout wall clock as latency (fixed earlier). **Avoid:** Extra long-lived probe sockets to active pool members when M1 is available.

### 2.3 Success-rate / confidence UI

- Keep ≥5 sample gate **or** show early rate with explicit “low confidence” (already partially there) once `successfulConnections` is recorded consistently on mesh open/fail.
- Do not invent “network speed Mbps” from RTT alone — RTT ≠ throughput. Throughput needs sized publish/subscribe soak (L3), not Relays card math.

---

## 3. Stability & speed — public Nostr vs self-hosted VPS

### 3.1 Public clearnet relays (nos / primal / damus-class)

| Factor | Reality | Obscur lever |
|--------|---------|--------------|
| Shared multi-tenant load | Variable RTT, rate limits, 503/TLS flaps (damus often weak on maintainer path) | E1 probe-preferred order; demote flaky hosts |
| No SLA | “Best effort” | Pack copy honesty (already charter) |
| Geography | RTT dominated by path to relay PoP | Prefer nearer hosts in preset; optional later geo/probe rank (E3 backlog) |
| Idle disconnects | Relays drop quiet sockets | Pool keepalive / resubscribe (supervisor); freshness badge already surfaces idle |

**Speed ceiling:** You cannot make a distant public relay “local-fast.” Improve **selection + dial + reconnect**, not physics.

### 3.2 Self-hosted server nodes (VPS / private mesh)

| Factor | Reality | Obscur lever |
|--------|---------|--------------|
| Single-tenant | Stable RTT, controllable capacity | First-class “team/VPS” URL in Relays; trust assessment |
| TLS + region | Choose region near users | Operator runbook (docs), not client magic |
| Auth | Often NIP-42 / allowlists | Out of Relays-metrics scope; identity/auth bands |
| Lab localhost | Fast but **not remote** | Product rule: lab-only; E2c keeps remotes dialed when both enabled |

**Stability playbook (ops, not client):** reverse proxy (nginx/caddy) WebSocket timeouts; idle ping; adequate file descriptors; strfry/nostr-rs-relay tuning; monitor disk for event DB; prefer WSS with valid certs.

### 3.3 Connection stability (client-side research backlog)

| ID | Theme | Notes | Risk |
|----|-------|-------|------|
| **S1** | Single owner reconnect | Mesh/NativeRelay vs supervisor — avoid dual reconnect storms | Dual-owner |
| **S2** | Backoff + circuit breaker | Already on `relayHealthMonitor`; tune thresholds with evidence | Over-tuning |
| **S3** | Keepalive on open pool sockets | Periodic lightweight REQ or WS ping; feeds L-app (M1) | Traffic budget |
| **S4** | Dial membership honesty | E2c done (L1); verify L3 with local+public | — |
| **S5** | Tor / privacy route | Higher RTT expected; UI should not mark “high latency” same as clearnet thresholds without mode-aware copy | False degraded |

---

## 4. Ranked improvement backlog (pick one slice next)

| Priority | Slice | Outcome | Proof |
|----------|-------|---------|-------|
| **P0** | Desktop smoke: E2c + metrics bridge | Confirm public open + ms latency with local enabled | Manual / light CDP |
| **P1** | **M1 — in-pool REQ→EOSE latency** (design then impl) | Accurate ongoing RTT without second socket | L1 unit + Relays UI L3 |
| **P2** | **M3 — label sample source** in Relays UI | “Connect 17ms” vs “RTT …” | Frontend after P1 contract |
| **P3** | Success-rate sample wiring on mesh open/fail | Fewer permanent “Insufficient data (0)” when sockets flap | **Done L1 2026-08-01** · [design](./relay-mesh-connection-sample-wiring-design-2026-08.md) |
| **P4** | Freshness copy: idle ≠ slow | Reduce “looks broken” when RTT is fine | **Done L1 2026-08-01** · [design](./relay-freshness-idle-copy-design-2026-08.md) |
| **P5** | Self-hosted VPS operator notes | Stability/speed for operators | **Done 2026-08-01** · [self-hosted-relay-vps-operator-notes-2026-08.md](../../docs/program/self-hosted-relay-vps-operator-notes-2026-08.md) |
| **P6** | E3 probe-rank public presets | Prefer currently healthy clearnet hosts | **Done L1 2026-08-01** · [design](./relay-probe-rank-dial-preference-design-2026-08.md) · selector **19 Pass** |

**Forbidden drift:** COM-RUN / AUTH-SESSION / claiming production public SLA.

---

## 5. Mental model (one user action)

1. User enables public + optional local lab.  
2. Pool dials remotes (E2c) + may keep local.  
3. UI shows **L-open** quickly; later **L-app** (M1) updates sparkline.  
4. “No recent events” only if no useful EVENT in window — user sends/receives or waits for traffic.  
5. For true multi-user remote: VPS or healthy public relay, not localhost alone.

---

## 6. Decision gate

Maintainer pick **one** next atomic:

1. **P0 smoke** (evidence only) — **Done 2026-08-01 Pass** · report `test-results/p0-relay-smoke-2026-08-01.json` · writable=3 · nos+primal+local · UI Avg Latency ~50ms  
2. **P1 design+impl** — **Done L1 2026-08-01** · [relay-in-pool-app-rtt-design-2026-07.md](./relay-in-pool-app-rtt-design-2026-07.md) · vitest 5 Pass · desktop refresh optional  
3. **P5 docs** self-hosted stability runbook — **Done 2026-08-01** · [self-hosted-relay-vps-operator-notes-2026-08.md](../../docs/program/self-hosted-relay-vps-operator-notes-2026-08.md) · or **P2** UI connect-vs-RTT labels — **Done L1**.

No code until that pick (except P0 read-only probes).

---

## Related specs

- [local-lab-remote-interaction-dial-design-2026-07.md](./local-lab-remote-interaction-dial-design-2026-07.md)  
- [relay-standby-probe-open-handshake-design-2026-07.md](./relay-standby-probe-open-handshake-design-2026-07.md)  
- [relay-settings-latency-metrics-investigation-2026-07.md](./relay-settings-latency-metrics-investigation-2026-07.md)  
- [public-nostr-relay-pool-module-design-2026-07.md](./public-nostr-relay-pool-module-design-2026-07.md)
