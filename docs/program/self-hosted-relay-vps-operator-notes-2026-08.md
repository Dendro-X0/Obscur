# Self-hosted relay / VPS operator notes

- Date (UTC): 2026-08-01 · **updated 2026-08-04** (public default first-class)
- Audience: Operators who want **stable remote** messaging (team / private mesh), not public-Nostr SLA
- Research: [relay-latency-stability-research-2026-07.md](../../specs/backend/relay-latency-stability-research-2026-07.md) · **P5**
- Lab vs remote: [local-lab-remote-interaction-dial-design-2026-07.md](../../specs/backend/local-lab-remote-interaction-dial-design-2026-07.md)
- **Ship default + Single/Multi:** [relay-pool-auto-correction-operator-notes-2026-08.md](./relay-pool-auto-correction-operator-notes-2026-08.md)
- Compaction (managed workspace): [infra/nostr/operator-relay-compaction.md](../../infra/nostr/operator-relay-compaction.md)

**Paused bands (do not expand here):** COM-RUN-* · AUTH-SESSION · Dev Lab as production validation.

---

## 1. Product rule

| Surface | Role |
|---------|------|
| `ws://localhost:7000` (Docker / ephemeral) | **Lab / L3 fixture only** — not multi-user remote |
| Public clearnet Default Stable (`nos` / `primal` / `damus`) | **Ship / cold-boot default** (`PRODUCT_BOOT_TRANSPORT_PRESET`) — Multi-node · **no SLA** |
| Self-hosted VPS (`wss://relay.example.org`) | Controllable capacity + region — **optional** for team remote |

Obscur cannot make a distant public relay “local-fast.” For true remote interaction between users, the **public default pool** is the first-class rendezvous; run a **VPS / private mesh** you operate when you need controllable capacity. Single/Multi auto-correct applies to whichever enabled URLs the profile has — see [auto-correction operator notes](./relay-pool-auto-correction-operator-notes-2026-08.md).

---

## 2. Recommended topologies

### A — Minimal clearnet relay (DM / general Nostr wire)

```text
Clients (Obscur Relays URL)
        │  wss://relay.yourdomain
        ▼
   TLS terminator (Caddy / nginx)
        │  ws://127.0.0.1:8080
        ▼
   nostr-rs-relay (or equivalent NIP-01 store)
```

**Local compose baseline** (dev only): `infra/docker-compose.nostr.yml` → host `ws://localhost:7000` → container `:8080`.  
Config: `infra/nostr/nostr-rs-relay.toml`.

### B — Managed-workspace path (hide suppress + optional compaction)

```text
Clients → relay-gateway (D1 filter) → nostr-rs-relay
```

Compose: `infra/docker-compose.nostr-gateway.yml` (`pnpm dev:relay:gateway:docker`).  
Ops after hide: [operator-relay-compaction.md](../../infra/nostr/operator-relay-compaction.md).

Use **B** when you need Obscur workspace hide semantics. Use **A** when you only need a trusted store-and-forward socket.

---

## 3. Stability playbook (ops, not client magic)

### 3.1 TLS and WebSocket proxy

- Prefer **WSS** with a valid cert (Let’s Encrypt via Caddy is fine).
- Raise idle / proxy timeouts so quiet sockets are not killed before Obscur reconnects.

**Caddy (sketch):**

```caddy
relay.yourdomain {
  reverse_proxy 127.0.0.1:8080
}
```

**nginx (sketch — tune timeouts):**

```nginx
location / {
  proxy_pass http://127.0.0.1:8080;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_read_timeout 3600s;
  proxy_send_timeout 3600s;
}
```

### 3.2 Region and capacity

| Choice | Why |
|--------|-----|
| Region near users | RTT floor is physics; client labels show Connect / RTT honesty, not Mbps |
| Single-tenant VPS | Avoid multi-tenant public load spikes |
| Disk for event DB | Monitor volume growth; backup before compaction |
| File descriptors | Raise `ulimit -n` / systemd `LimitNOFILE` under concurrent WS clients |
| Rate limits | `messages_per_sec` / `subscriptions_per_min` in `nostr-rs-relay.toml` — open for lab; tighten for public exposure |

### 3.3 Auth / allowlists

Pubkey whitelist, NIP-42, and operator trust UX live under **AUTH-SESSION / trust** bands — **out of scope** for this note. Do not invent parallel auth in Relays settings while those bands are paused. For a private team VPS, firewall + VPN / private DNS is an acceptable interim control.

---

## 4. Wire the URL in Obscur

1. Deploy topology A or B with a stable hostname.
2. In desktop **Settings → Relays**, add `wss://relay.yourdomain` (or `ws://…` only on trusted LAN).
3. Keep `localhost:7000` only if you still need lab fixtures — E2c keeps remotes dialed when both are enabled; local alone is **not** remote.
4. Expect Relays badges:
   - **Connect {n}ms** — open / handshake sample
   - **RTT {n}ms** — in-pool REQ→EOSE (after P1/P2)
   - Freshness (“no recent events”) ≠ slow RTT

---

## 5. Operator smoke checklist

Run after deploy (same network as users when possible):

| Step | Pass if |
|------|---------|
| DNS + TLS | Browser / `curl -I https://relay.yourdomain` returns OK (or Caddy serves WS path) |
| WebSocket open | Client Relays card shows **Connected** / healthy for the VPS URL |
| Latency honesty | Badge shows **Connect** then ideally **RTT** (not permanent `n/a`) |
| Publish path | Send a lab DM / sealed event; peer on another profile receives (two-user when claiming remote) |
| Idle | After quiet period, reconnect recovers without manual recycle |
| Disk | `du` / volume metrics on relay DB within budget |

**Claim language:** smoke **Pass** only with evidence (screenshot / CDP / soak note). Do **not** claim public SLA, Mbps, or “fixed latency” from a single Connect sample.

---

## 6. Lab commands (not production)

```bash
pnpm dev:relay:docker          # nostr-rs-relay on :7000
pnpm dev:relay:gateway:docker  # gateway + upstream (managed path)
pnpm dev:relay:down
```

Ephemeral Node relay (`scripts/dev-relay-ephemeral.mjs`) is **not** for VPS.

---

## 7. Non-goals

- Production public-Nostr SLA or Mbps from UI RTT
- Dual-owner reconnect redesign (research **S1**)
- AUTH-SESSION / NIP-42 product work
- Replacing public presets with a mandatory Obscur HQ relay

---

## Related

- [relay-latency-source-label-design-2026-07.md](../../specs/backend/relay-latency-source-label-design-2026-07.md) — Connect vs RTT labels  
- [relay-in-pool-app-rtt-design-2026-07.md](../../specs/backend/relay-in-pool-app-rtt-design-2026-07.md) — in-pool RTT  
- [obscur-conduit-mesh-concept-2026-06.md](./obscur-conduit-mesh-concept-2026-06.md) — team / custom conduit framing  
