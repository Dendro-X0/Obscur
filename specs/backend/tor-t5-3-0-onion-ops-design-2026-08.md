# Design — T5-3.0 Obscur onion Nostr ops (production HS)

**Date (UTC):** 2026-08-08  
**Status:** Design **Ready** (await maintainer Accept of this ops design)  
**Charter:** [tor-t5-onion-ops-charter-2026-08.md](./tor-t5-onion-ops-charter-2026-08.md) — **T5-3-A Accepted**  
**Parents:** [self-hosted-relay-vps-operator-notes-2026-08.md](../../docs/program/self-hosted-relay-vps-operator-notes-2026-08.md) · [tor-t5-tor-viable-pool-design-2026-08.md](./tor-t5-tor-viable-pool-design-2026-08.md) · `infra/docker-compose.nostr.yml` · `infra/nostr/nostr-rs-relay.toml`

```text
HANDOFF ATOMIC STEP:  T5-3-A Accepted → T5-3.0 ops design
PAUSED / CANCELLED:   Community · AUTH-SESSION
CANONICAL OWNER:      Ops VPS Tor HS + nostr-rs-relay · docs publish · Tor-viable allowlist (T5-3.1+)
PROOF BEFORE DONE:    This design Accepted · then T5-3.1 live onion URL (not invented here)
OUT OF SCOPE:         Fake *.onion in product defaults · UI SOCKS · Arti · CF Tor SLA · Community
```

## Verdict

**T5-3-A** = Obscur-operated Tor **hidden service** in front of a NIP-01 relay. Reuse the lab stack’s **nostr-rs-relay** binary/image (already in `infra/`), not a second relay dialect. Prefer **`ws://….onion`** (no TLS terminator) for Tor clients; clearnet `wss://` remains optional and separate.

**Do not** put placeholder onions in `NEXT_PUBLIC_OBSCUR_TOR_VIABLE_HOSTS`, presets, or allowlists until T5-3.1 publishes a real hostname from a live HS.

---

## 1. Topology (production)

```text
Obscur desktop / gateway tunnel (4b)
        │  SOCKS5h (obscur-mesh-ws) → Tor network
        ▼
   Onion service (v3)
        │  HiddenServicePort 80 127.0.0.1:8080
        ▼
   nostr-rs-relay  (loopback only — never public clearnet bind for Tor path)
```

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Relay | **nostr-rs-relay** (`scsibug/nostr-rs-relay`) | Already compose-baselined · compaction docs · operator familiarity |
| Alt | strfry | Defer unless LMDB/scale needs appear; do not dual-run in v1 |
| Tor | Separate **server** Tor daemon (not `obscur-tor-gateway` client process) | Client gateway owns SocksPort for dials; HS is an ops host concern |
| Scheme | **`ws://<v3>.onion`** (port 80 via HS) | Avoids onion+TLS cert story; SOCKS5h resolves `.onion` |
| Clearnet twin | Optional later `wss://relay.obscur…` | Not required for Tor-viable SLA; must not be CF-fronted for Tor dials |

Lab `ws://localhost:7000` stays **lab-only** (TI / T5 lab escape hatch). It is **not** the production onion.

---

## 2. Host layout

Recommended single VPS (or dedicated VM):

| Path / unit | Purpose |
|-------------|---------|
| `/var/lib/obscur-onion-relay/db` | nostr-rs-relay SQLite (backed up) |
| `/var/lib/tor/obscur-nostr-hs/` | Tor `HiddenServiceDir` (keys = identity — offline backup) |
| `/etc/tor/torrc.d/obscur-nostr-hs.conf` | HS-only torrc fragment |
| systemd `obscur-nostr-relay.service` | Relay container or binary |
| systemd `tor@default` / distro Tor | Provides the onion |

### 2.1 Tor HS fragment (sketch)

```torrc
# Obscur T5-3-A — Nostr onion (ops host; not client gateway torrc)
HiddenServiceDir /var/lib/tor/obscur-nostr-hs/
HiddenServiceVersion 3
HiddenServicePort 80 127.0.0.1:8080
```

After first start, read hostname from:

`/var/lib/tor/obscur-nostr-hs/hostname` → product URL `ws://<hostname>`

### 2.2 Relay config (production delta vs lab)

Start from `infra/nostr/nostr-rs-relay.toml`:

| Knob | Lab | Production onion |
|------|-----|------------------|
| `relay_url` | `ws://localhost:7000` | `ws://<v3>.onion` (document after provision) |
| `address` / `port` | `0.0.0.0:8080` in container | Bind **`127.0.0.1:8080`** on host (HS only) |
| `messages_per_sec` / `subscriptions_per_min` | 200 | Tighten (e.g. 20–50 / 30–60) once live |
| `pubkey_whitelist` | unset (open lab) | Prefer **unset or steward list** — full AUTH-SESSION still PAUSED; firewall is Tor reachability |

**Abuse baseline (v1):**

- Rate limits in toml (above).  
- Tor HS is the only ingress (no clearnet `:8080` publish).  
- Disk alerts on DB volume; compaction playbook: [operator-relay-compaction.md](../../infra/nostr/operator-relay-compaction.md) when workspace hide applies (optional for DM-only onion).  
- Do **not** invent NIP-42 auth in this slice while AUTH-SESSION is CANCELLED/PAUSED.

---

## 3. Persistence & backup

| Asset | Frequency | Notes |
|-------|-----------|-------|
| `HiddenServiceDir` (`hs_ed25519_*`, `hostname`) | Offline encrypted copy after create + after any rotate | Losing keys = new onion = client allowlist churn |
| Relay SQLite | Daily snapshot + pre-compaction | Same as clearnet VPS notes |
| torrc / systemd units | Git or config management | No secrets in public repo |

**Rotation:** dual-publish window — keep old onion HS up until clients migrate allowlist/preset (T5-3.1 docs + dual URL period). Never delete old HS keys until soak confirms new URL.

---

## 4. Client publish path (T5-3.1+ — not this slice)

After hostname exists:

1. Document URL in `docs/` + handoff (single source of truth).  
2. Set product Tor-viable path:
   - Prefer **literal onion URL** in a Tor ON transport pack / boot list, **and/or**
   - `NEXT_PUBLIC_OBSCUR_TOR_VIABLE_HOSTS=<v3.onion>` for allowlist class `tor_allowlist` (hostname only).  
3. `classifyTorRelayEndpoint` already returns `onion_ws` for `ws://….onion` — no second dialer.  
4. Honesty copy (TI-3) remains when pool empty; after onion ships, empty-pool CTA is secondary.

**Forbidden in T5-3.0:** committing invented hostnames.

---

## 5. Proof plan

| Slice | Proof |
|-------|--------|
| **T5-3.0** (this file) | Maintainer Accept of topology + binary + backup |
| **T5-3.1** | Live `hostname` · L2: gateway tunnel CONNECT/open to `ws://….onion` · URL in docs + allowlist/preset |
| **T5-3.2** | Default Tor pack includes onion · L1 unit · Relays UI |
| **T5-3.3** | Two-machine DM soak · Tor OFF clearnet regression · production Tor-ready candidate |

L2 smoke (after provision): from a host with `obscur-tor-gateway` Ready, dial onion via tunnel (same path as NativeRelay 4b) — expect sticky OPEN, not CF 503 loops.

---

## 6. Mental simulation

**Provision**

1. Ops installs Tor + nostr-rs-relay on VPS.  
2. HS publishes v3 hostname.  
3. Maintainer records `ws://….onion` in handoff.  
4. T5-3.1 patches allowlist/preset with that URL only.

**User Tor ON (after T5-3.1)**

1. Warming → clearnet (TI-1).  
2. Ready → dial onion_ws only.  
3. Gateway tunnel → sticky open → DMs.

**Compromise / rotate**

1. New HS dir → new hostname.  
2. Dual-list old+new briefly.  
3. Retire old after soak.

---

## 7. Claim language

| May say | When |
|---------|------|
| T5-3-A Accepted | Maintainer chose A (2026-08-08) |
| T5-3.0 Design Ready | This file |
| T5-3.0 Accepted | Maintainer accepts this ops design |
| Onion ops Implemented | T5-3.1 live URL + L2 101 — **not** this file alone |

## Accept → next

Maintainer Accept this design → **T5-3.1** provision (ops) + publish real URL; agents then wire allowlist/preset **only** with that URL.
