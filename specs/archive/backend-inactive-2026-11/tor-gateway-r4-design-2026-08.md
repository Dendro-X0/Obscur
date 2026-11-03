# Design — R4 Tor gateway (separate OS process)

**Status:** Design Ready · Slices 1–3 + P0 + **Slice 4a HTTP dials** **Implemented** (L1) · 2026-08-08  
**Baseline:** Clean `v1.9.15` / `ca348e79`  
**Parents:** [tor-radical-options-charter-2026-08.md](./tor-radical-options-charter-2026-08.md) · [tor-performance-conflicts-research-2026-08.md](./tor-performance-conflicts-research-2026-08.md)

```text
HANDOFF:              R4 → Slice 4a L1 done → L3 soak (Tor ON + UI interactive)
FORBIDDEN:            UI-local SOCKS · in-process sidecar
SUCCESS:              UI process stays interactive even if Tor/gateway dies
```

## Product shape

```text
┌─────────────────────────┐         localhost IPC (JSON / HTTP)        ┌──────────────────────────┐
│  obscur desktop (UI)    │  ←—— health / start / stop / dial? ——→    │  obscur-tor-gateway      │
│  AppShell + clearnet    │         hard timeouts + kill-switch         │  owns tor.exe + SOCKS    │
│  NEVER spawns tor.exe   │                                             │  optional dial worker    │
└─────────────────────────┘                                             └──────────────────────────┘
```

| Process | Owns | Must not |
|---------|------|----------|
| UI (`obscur_desktop`) | AppShell, SQLite, clearnet Relays (until gateway dial API exists) | `tor.exe`, SOCKS connect loops, bootstrap log scraping |
| Gateway (`obscur-tor-gateway`) | Sidecar lifecycle, SocksPort, optional relay dials via Tor | WebView, React, signing UI path |

**Kill-switch:** If gateway is down or times out → UI stays on clearnet/local; never blocks paint/signing.

---

## Phases

| Slice | Work | Exit |
|-------|------|------|
| **1** | **Subtract:** UI process never `start_tor` / never `net_runtime.set(true)` / no mount auto-start; Settings honest “gateway required”; force `enable_tor` file off for routing | UI interactive; enabling Tor toggle cannot wedge host |
| **2** | Gateway binary: spawn/stop tor, bootstrap 100% only, `/health` + `/status` on `127.0.0.1` | **L1 done** — crate `apps/tor-gateway`; L3 soak still open |
| **3** | UI discovers gateway; start/stop via IPC; status mirror | **L1 done** — `tor_gateway_client` + Settings; L3 soak open |
| **P0** | Split lifecycle-ready vs dial-ready; mesh/`mesh_http_fetch_via_socks` fail closed | **L1 done** — enable Tor must not open UI SOCKS |
| **4a** | Gateway `POST /v1/http/fetch` via SOCKS (cap 4); UI proxies only; dial-ready = lifecycle | **L1 done** — UI still never opens SOCKS |
| **4b** | Optional: gateway WS/NativeRelay dials; keep `net_runtime` false in UI | Later |
| **L3** | Tor ON + desktop interactive soak | Gateway Verified gate |

Slice 1 is **mandatory** before any gateway polish — otherwise R4 is theater.

---

## Slice 1 contracts (this impl)

| Surface | Behavior |
|---------|----------|
| `start_tor` | **Refuse** — return error: use gateway (not implemented in Slice 1) / does not spawn |
| `stop_tor` | Best-effort stop child if any + orphan cleanup; disarm routing |
| `save_tor_settings(true)` | Persist preference only; **`net_runtime.set(false, …)` always** in UI process |
| Boot | `NativeNetworkRuntime::new(false, proxy)`; ignore file `enable_tor` for SOCKS |
| `use-auto-lock` | Remove mount auto-start; toggle must not call `start_tor` (or call and expect refuse) |
| Settings UI | Copy: Tor requires separate gateway; toggle cannot arm in-process SOCKS |

---

## IPC (Slice 2 — `apps/tor-gateway`)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/v1/health` | 200 if gateway alive |
| GET | `/v1/tor/status` | `{ state, bootstrapReady, socks, detail? }` — `bootstrapReady` only after `Bootstrapped 100%` |
| POST | `/v1/tor/start` | Spawn `tor.exe` in gateway process |
| POST | `/v1/tor/stop` | Stop child + orphan cleanup |
| POST | `/v1/http/fetch` | Slice 4a: SOCKS HTTP dial in gateway (max 4 concurrent) |
| Default bind | `127.0.0.1:17950` (`OBSCUR_TOR_GATEWAY_BIND`) | Loopback only; non-loopback bind refused |

**Env:** `OBSCUR_TOR_BIN`, `OBSCUR_TOR_GATEWAY_DATA`, `OBSCUR_TOR_SOCKS_URL`  
**Run:** `pnpm dev:tor-gateway` · **L1:** `pnpm verify:tor-gateway`

---

## Slice 3 contracts

| Surface | Behavior |
|---------|----------|
| `tor_gateway_client` | Loopback HTTP to gateway; ≤2s timeout; fail open |
| `start_tor` | POST `/v1/tor/start` only — **never** `shell.sidecar("tor")`; `net_runtime` stays false |
| `stop_tor` | POST `/v1/tor/stop` + legacy child clear; SOCKS stays disarmed |
| `get_tor_status` | Mirror gateway; **no** SOCKS TCP false-READY; `gatewayReachable` on snapshot |
| Settings toggle ON | `save_tor_settings` + `start_tor` (gateway) |
| Settings toggle OFF | `save_tor_settings` + `stop_tor` |
| Kill-switch | Gateway down → UI clearnet/local; status `ready: false` |

Env: `OBSCUR_TOR_GATEWAY_URL` (default `http://127.0.0.1:17950`)

---

## P0 ready-split (post Slice 3 freeze) → superseded by 4a for dial-ready

| Surface | Behavior |
|---------|----------|
| `lifecycleReady` | Gateway `Bootstrapped 100%` |
| `ready` (dial) | Slice 4a: `GATEWAY_OWNS_HTTP_DIALS && lifecycleReady` (**UI SOCKS stays false**) |
| `mesh_http_fetch_via_socks` | Proxies gateway `/v1/http/fetch` — no local SOCKS |
| `NativeNetworkRuntime` | Remains unarmed (`set(false,…)`) — WS clearnet until 4b |

## Slice 4a contracts

| Surface | Behavior |
|---------|----------|
| Gateway dial | `POST /v1/http/fetch` only when bootstrap ready; semaphore ≤4 |
| UI | Loopback JSON to gateway; `UI_PROCESS_MAY_DIAL_VIA_SOCKS=false` forever |
| Kill-switch | Gateway down / not ready → fetch error; UI stays interactive |

Research: [tor-performance-conflicts-research-2026-08.md](./tor-performance-conflicts-research-2026-08.md)

---

## Claim language

| May say | When |
|---------|------|
| R4 Design Ready | This file |
| Slice 1 Implemented | UI cannot spawn/arm Tor; L1 |
| Slice 2 Implemented | Gateway binary + L1 unit tests; **not** Gateway Verified |
| Slice 3 Implemented | UI discovers/start/stop via gateway IPC; L1; **not** Gateway Verified |
| P0 ready-split Implemented | Dial-ready forced false; mesh SOCKS refused; L1 |
| Slice 4a Implemented | Gateway HTTP SOCKS dials + UI proxy; L1; **not** Gateway Verified |
| Gateway Verified | L3: Tor ON + dials not in UI + host interactive |
| Tor opt-in Verified | Product Tor path usable under L3/L4 |

**Forbidden:** Re-introducing in-process `shell.sidecar("tor")` in the UI binary.
