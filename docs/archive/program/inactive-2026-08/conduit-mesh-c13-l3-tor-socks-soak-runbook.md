# Conduit Mesh C13 — L3 Tor SOCKS HTTP soak runbook

**Status:** **BLOCKED** — Tor circuit bootstrap (env) · 2026-07-15  
**Last updated:** 2026-07-15  
**Parent:** [conduit-mesh-c13-tor-socks-drivers-charter.md](./conduit-mesh-c13-tor-socks-drivers-charter.md)  
**Design:** [conduit-mesh-c13-tor-socks-drivers-design.md](../../specs/backend/conduit-mesh-c13-tor-socks-drivers-design.md)

---

## Goal

Prove desktop HTTP mesh traffic for `tor_required` / `.onion` conduits exits via **SOCKS** (`mesh_http_fetch_via_socks`) — not clearnet `fetch` — when Tor is ready.

---

## Preconditions

| Check | Action |
|-------|--------|
| L1 | `pnpm verify:conduit-mesh-c13` |
| Tor | Desktop Settings → Tor enabled; `get_tor_status` → `ready: true` + `proxyUrl` (e.g. `socks5h://127.0.0.1:9050`) |
| Gateway | Prefer a reachable **onion** HTTP mesh URL, **or** map a clearnet URL only after confirming descriptor policy is `tor_required` in diagnostics |
| Desktop | Rebuild after C13 |

---

## Row T — Policy + route

| Step | Action | Pass |
|------|--------|------|
| T1 | Enable Tor; wait ready | Snapshots show Tor ready in Conduits panel |
| T2 | Pool includes onion `http://….onion:…` | Descriptor `networkPolicy` = `tor_required` |
| T3 | Tor off / not ready | Publish fail-closed (`tor_unreachable`); **no** clearnet POST to onion host |
| T4 | Tor on | Publish succeeds; native invoke `mesh_http_fetch_via_socks` appears in desktop logs / CDP (or SOCKS listener sees CONNECT) |

---

## Row B — Dual-window DM over Tor HTTP

| Step | Action | Pass |
|------|--------|------|
| B1 | A → B marker `C13-L3-tor-YYYYMMDDX` | Delivered within 60s (Tor latency budget) |
| B2 | B → A reply | Delivered within 60s |
| B3 | Prove route | At least one SOCKS fetch path evidence (command log or traffic capture) |

---

## Sign-off

| Field | Value |
|-------|--------|
| Date | 2026-07-15 |
| Tor proxyUrl | `socks5h://127.0.0.1:9050` (port open; desktop `ready: true` via TCP probe only) |
| Onion / URL | Local HS `3rrwnnfli6m6oujmvldtjbsrcnl3ao3ubhe27ggbwxxdhn2iey4juoyd.onion` → `127.0.0.1:8788` published |
| Markers | _(not run — circuits unavailable)_ |
| Result | **BLOCKED** |

```text
C13 L3 Tor SOCKS — BLOCKED — 2026-07-15 — Tor HS + client stuck Bootstrapped 10% (TLS_ERROR / unexpected eof on relay handshake); SOCKS listener up but no usable circuits; Row B deferred
```

**Evidence notes**

- T1 partial: `save_tor_settings` + `start_tor` → status `connected`/`ready: true` (proxy TCP reachability only — not circuit-ready).
- HS Tor log: repeated `handshaking (TLS) with SSL state error in HANDSHAKE`; stuck `Bootstrapped 10% (conn_done)`.
- Row T2–T4 / Row B not claimed until Tor bootstrap reaches 100% on this host.
- Code path L1 remains green: `pnpm verify:conduit-mesh-c13`.

---

## Out of scope

- Browser PWA SOCKS (infeasible)
- Circuit isolation per conduit
- C14 SSE latency (separate runbook)
