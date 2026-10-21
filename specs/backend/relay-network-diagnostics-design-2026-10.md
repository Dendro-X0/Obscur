# Design — Relay network diagnostics (VPN / local / config honesty)

**Date (UTC):** 2026-10-10  
**Status:** Slices A+C **L1 Pass** (2026-10-13) · B/D await pick  


**Trigger:** Self T1 Track L — banner *Relay transport is offline*; Metrics show public DISCONNECTED + `ws://localhost:7000` / `http://127.0.0.1:8788` **DISABLED**  
**Parents:** [network-infrastructure-module-charter-2026-10.md](../../docs/program/network-infrastructure-module-charter-2026-10.md) (**NIM P1**) · [relay-settings-latency-metrics-design-2026-07.md](./relay-settings-latency-metrics-design-2026-07.md) · [transport-pool-health-design-2026-07.md](./transport-pool-health-design-2026-07.md) · [tor-r4-relay-connect-firewall-diagnosis-2026-08.md](./tor-r4-relay-connect-firewall-diagnosis-2026-08.md) · [docs/business/SELF-T1-BOOT.md](../../docs/business/SELF-T1-BOOT.md)

```text
HANDOFF ATOMIC STEP: Self T1 boot (Lane A) — blocked on transport
PAUSED / CANCELLED:  Dialect research · Tor Verified as gate
CANONICAL OWNER:     Settings Relays metrics + readiness copy (+ optional native probe)
PROOF BEFORE DONE:   L1 unit · L3 maintainer screenshot with classified reasons
SURFACE:             Desktop Settings → Relays / Network performance metrics
```

---

## 1. Problem (evidence-backed)

| Observed | Meaning today |
|----------|----------------|
| Banner: transport offline | Supervisor: no writable / open pool members |
| `nos.lol` PRIMARY (OFFLINE) · primal/damus STANDBY | **Enabled** but **no open socket** — network / proxy / VPN / firewall candidates |
| `ws://localhost:7000` **DISABLED** | Operator (or default) **will not dial** — Docker up is irrelevant until enabled |
| `http://127.0.0.1:8788` DISABLED | Mis-typed / non-WS “relay”; coordination is HTTP `:8787`, not a Nostr WS |
| Latency `n/a` on all | No successful connect RTT (expected when nothing opens) |
| Other apps work on same VPN | Does **not** prove Nostr WS/443 paths are allowed; VPN often splits or blocks WS |

**Gap:** UI collapses **disabled**, **disconnected**, and **wrong URL kind** into a red wall. Operators blame VPN when the local Track L relay was never in the active pool.

---

## 2. Goals / non-goals

### Goals

1. **Classify failure** per URL: `disabled` | `invalid_scheme` | `loopback_unreachable` | `remote_unreachable` | `tls_or_proxy` | `open` | `connecting` | `circuit_open`.  
2. **Pool-level hypothesis** when ≥2 remotes fail and loopback is disabled or untested: suggest *VPN/proxy may block public relays; enable local lab or disable VPN for test*.  
3. **One-tap / one-line recovery** for Track L: enable `ws://localhost:7000`, set primary, demote public for private-trust soak.  
4. Keep **one metrics owner** (`relayHealthMonitor` + mesh activity) — no second orchestrator ([latency design](./relay-settings-latency-metrics-design-2026-07.md)).

### Non-goals

- Auto-disable VPN or mutate OS proxy settings  
- Tor Verified / onion path as launch gate  
- New dialect / second pool stack  
- Full traceroute / packet capture UI  
- Treating coordination HTTP URL as a relay “fix” by inventing WS on 8787  

---

## 3. Diagnosis model

### 3.1 Per-URL state machine (display)

```text
config.enabled?
  no  → reason=disabled · CTA=Enable
  yes → url.kind?
         http(s) non-mesh → reason=invalid_scheme · CTA=Use ws/wss (or remove)
         ws/wss loopback  → probe dial
         ws/wss remote    → probe dial

probe outcome:
  open (+ optional RTT)     → open
  timeout / refused         → loopback_unreachable | remote_unreachable
  TLS/proxy error classes   → tls_or_proxy (when detectable)
  circuit open              → circuit_open (existing)
```

### 3.2 Pool hypothesis (derived, not guessed root cause)

| Pattern | Hypothesis copy (honest) |
|---------|---------------------------|
| All **enabled remotes** fail + **loopback disabled** | Public path unhealthy; **local relay not tried** — enable `ws://localhost:7000` for private-trust |
| All enabled remotes fail + **loopback open** | VPN/firewall likely on **public** only; local cell OK — continue T1 on local |
| Remotes fail + loopback enabled but refused | Docker/relay process down or wrong port — check `:7000` |
| Only primary fails · standby open | Failover / primary pick — not “whole network dead” |
| Tor preference ON + remotes fail | Point to Tor vs clearnet split ([R4 diagnosis](./tor-r4-relay-connect-firewall-diagnosis-2026-08.md)) — separate from VPN |

Never claim “VPN confirmed” without a split test (VPN off vs on) logged by operator.

### 3.3 Split-test ritual (operator, documented in UI help)

```text
1) Note enabled URLs + statuses (screenshot)
2) Enable only ws://localhost:7000 · disable public · Tor OFF
3) If local opens → public path problem (VPN/proxy/ISP) · Track L continues
4) If local refused → stack/process problem · not VPN
5) Optional: disable VPN briefly · re-enable one public · compare
```

---

## 4. UX design (Settings → Relays metrics)

### 4.1 Card subtext (replace vague lines)

| Today | Proposed |
|-------|----------|
| “This relay is configured… but currently disabled.” | Keep + **Enable** control prominence |
| “Selected primary — no open socket yet.” | Add: *Dial attempted / not attempted* · last error class if any |
| STANDBY “Not in the active transport pool.” | Clarify: standby may still be dialed or not (match real supervisor policy) |

### 4.2 Banner enrichment (readiness copy)

When offline:

```text
No writable relays.
· N disabled (incl. local ws://localhost:7000)
· M enabled remotes with no open socket
Suggested: Enable local relay for private-trust · or check VPN/proxy for public Nostr
```

Keep short; details expand under metrics.

### 4.3 “Diagnose” action (Slice B)

Button: **Run path check** (maintainer/dev + optional prod)

- For each **enabled** URL: short dial (reuse standby/latency probe sockets — no second pool).  
- Write results into `relayHealthMonitor` + a small `RelayPathCheckResult[]` for UI.  
- Show table: URL · class · ms · hint.

### 4.4 Private-trust preset hint

When category Workspace / lab URLs present and remotes all red: surface link to private-trust setup / “Use local Docker relay” (docs already exist).

---

## 5. Architecture (owners)

| Concern | Owner | Must not |
|---------|-------|----------|
| Sample store | `relayHealthMonitor` | Parallel Settings-only store |
| Pool sockets | Conduit mesh / NativeRelay | Extra permanent sockets for diagnose beyond probe policy |
| Primary/standby | Existing selector + supervisor | Reintroduce hook-level auto-reconcile loops |
| Copy | `relay-readiness-copy` + metrics card mappers | Blame VPN as fact |
| Path check | New pure classifier + thin probe wrapper | OS VPN APIs |

**Classifier module (proposed):**  
`apps/pwa/app/features/relays/services/relay-path-diagnosis.ts`  
Pure: `(url, config, probe) → RelayPathDiagnosis` — unit-tested heavily.

---

## 6. Implementation slices

| Slice | Deliverable | Unblocks |
|-------|-------------|----------|
| **A — Honesty copy** | Map disabled vs disconnected vs invalid_scheme in metrics cards + offline banner counts | Self T1 understanding today |
| **B — Path check** | Manual “Run path check” · probe enabled URLs · show class + RTT | VPN vs local vs down |
| **C — Track L CTA** | One control: enable localhost:7000 · disable public · set primary local | Self T1 ritual speed |
| **D — Proxy hints** | Optional: detect system proxy / Tor preference · show as *context* not verdict | Fewer false VPN takes |

**Recommend ship order:** A → C → B → D.  
A+C alone may finish Self T1 without B.

---

## 7. Immediate operator steps (before any code)

Do **not** wait on this design to continue Lane A:

1. Confirm `pnpm dev:relay:docker` · `curl` `:7000` responds.  
2. Settings → Relays: **Enable** `ws://localhost:7000`.  
3. **Disable** (or demote) `nos.lol` / primal / damus for this soak.  
4. Remove or ignore `http://127.0.0.1:8788` as a relay (coordination ≠ relay).  
5. Tor **OFF**.  
6. Set primary to localhost · wait for open · continue DM/group ritual.  
7. If public still needed later: retry with VPN off once and note EG-LOG.

---

## 8. Proof plan

| Layer | Evidence |
|-------|----------|
| L1 | Vitest: classifier cases (disabled, invalid http, loopback refuse, remote timeout, open) · banner copy with counts |
| L2 | N/A |
| L3 | Screenshot: local enabled+open with publics disabled · optional path-check table · Self T1 EG-LOG Result |

**Claim language:** design ≠ implemented ≠ verified.

---

## 9. Decision

- [x] **Slice A** (copy honesty) — shipped L1 2026-10-13  
- [x] **Slice C** (Track L CTA) — shipped L1 2026-10-13  
- [ ] **B** (path check button)  
- [ ] Park remainder · operator-only §7  

**Evidence:** `relay-path-diagnosis.ts` · `relay-track-l-private-trust-plan.ts` · Settings readiness CTA `track-l-private-trust-cta` · invalid-scheme badge  



---

**Assistant lock:** Specs before code. Do not invent VPN APIs. Do not reopen dialects. Prefer enabling local over building a VPN dashboard.
