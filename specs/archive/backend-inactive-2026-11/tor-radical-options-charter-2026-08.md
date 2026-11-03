# Charter — Radical Tor options (stop protecting the broken path)

**Date (UTC):** 2026-08-08  
**Status:** Maintainer picked **R4** · Slice 1 in progress · 2026-08-08  
**Baseline:** Clean `v1.9.15` / `ca348e79` only  
**Parents:** [tor-rust-integration-regression-investigation-2026-08.md](./tor-rust-integration-regression-investigation-2026-08.md)

```text
HANDOFF:              Radical Tor options — pick one; stop WIP patches
SETTLED:              Tor ON wedges host · Tor OFF works · Option A / fail-closed / dial-hold did not restore Tor product
FORBIDDEN:            More gates, retries caps, false-ready fixes, “Route via Tor” CTAs on the current NativeRelay×sidecar model
```

## Honest diagnosis

Previous work (auto-start subtraction, dial hold, fail-closed, Option A transport arm) **protected a flawed architecture**:

- Packaged `tor.exe` sidecar inside the UI process lifecycle  
- Fake browser `WebSocket` → Tauri IPC → Rust SOCKS × N relays  
- Shared async/command queue with paint/signing  

That model is the regression vs early TS. Scaffolding around it is not a product.

---

## Radical options (pick exactly one)

### R1 — **Excise Tor from the desktop product** (fastest honesty)

| | |
|--|--|
| **Do** | Remove Settings Tor toggle, sidecar spawn, SOCKS in `NativeNetworkRuntime` / `connect_relay`. Document: “Tor not in this build.” |
| **Keep** | Clearnet Relays, local-first shell, AppShell |
| **Gain** | Host stability; stop lying that Tor exists |
| **Loss** | No in-app Tor until a later rewrite |
| **Exit** | Ship without Tor UI; charter reopen only with R3/R4 |

### R2 — **External Tor only — never embed `tor.exe`**

| | |
|--|--|
| **Do** | Delete packaged sidecar. If user runs system Tor / Tor Expert Bundle on `9050`, optional **opt-in** “use system SOCKS” with hard global dial concurrency 1 and no auto-start. |
| **Gain** | Obscur never owns Tor process lifecycle (orphan kill / bootstrap lies go away) |
| **Loss** | Setup burden; still must fix dial fan-out or wedge returns |
| **Requires** | Still needs R3 dial ownership rewrite, or wedge risk remains |

### R3 — **Replace NativeRelay dial ownership** (real rewrite)

| | |
|--|--|
| **Do** | Delete TS parallel `NativeRelay.connect` fan-out as the product dial path. One Rust `TransportSupervisor`: single queue, max 1–2 dials, Tor as a **mode** of that supervisor only. TS subscribes to events; never `Promise.all` connects. |
| **Gain** | Matches “early TS one client” intent; Tor can become an advantage again |
| **Cost** | Multi-week; touches relay pool, mesh configure, account-sync warm paths |
| **Exit** | Tor mode L3 Pass on clean tag + rewrite branch |

### R4 — **Two products / two processes**

| | |
|--|--|
| **Do** | `obscur` = no Tor (default). Optional `obscur-tor-gateway` separate OS process: owns sidecar + SOCKS dials; UI talks over localhost IPC with hard timeouts and kill-switch. |
| **Gain** | Tor crash cannot black-screen WebView |
| **Cost** | Packaging, IPC contract, ops complexity |

### R5 — **CANCELLED Tor product (formal)**

| | |
|--|--|
| **Do** | Maintainer CANCELLED in handoff + feasibility note. Same code outcome as R1, explicit goal abandonment of in-app Tor. |
| **When** | Only if you accept no Tor in Obscur for this generation |

---

## Explicitly rejected (waste)

| Rejected | Why |
|----------|-----|
| More ready/probe/retry/UI gates on current path | Protects flawed code |
| Blind `stash apply` of Option A / local-first WIP | Re-pollutes clean tag |
| ThinAppChrome as Tor “fix” | Wrong product UI |
| Tor-OFF re-verify loops as progress | Settled |

---

## Recommendation (agent)

If the priority is **stop losing the host now**: **R1** (or R5 if you want formal cancel).  
If the priority is **Tor must work in-app again**: **R3** (optionally + **R4** isolation), on a **new branch from clean `v1.9.15`**, not patches on wedged WIP.  
**R2 alone** is insufficient without R3.

---

## Decision table (fill)

| Pick | Date | Notes |
|------|------|-------|
| ☐ R1 Excise | | |
| ☐ R2 External Tor only | | |
| ☐ R3 TransportSupervisor rewrite | | |
| ☑ R4 Dual process | 2026-08-08 | Design: `tor-gateway-r4-design-2026-08.md` · Slice 1: UI never owns tor.exe |
| ☐ R5 CANCELLED | | |
| ☐ R3+R4 | | |

**Implementation follows R4 design slices only — no protective patches on in-process sidecar.**
