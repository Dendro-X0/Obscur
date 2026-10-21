# Charter — Network Infrastructure Module (NIM)

**Date (UTC):** 2026-10-10  
**Status:** Research → architecture lock · **design before code**  
**Maintainer intent:** End long neglect of connectivity; craft a dedicated network plane (public Nostr by default · Tor opt-in seamless · VPN/proxy/SSH honest) with engine-grade precision.  
**Parents:** [release-without-tor-transport-sovereignty-charter-2026-08.md](./release-without-tor-transport-sovereignty-charter-2026-08.md) · [obscur-conduit-mesh-concept-2026-06.md](./obscur-conduit-mesh-concept-2026-06.md) · [obscur-backend-engine-roadmap.md](./obscur-backend-engine-roadmap.md) · [encyclopedia/15-relay-foundation-hardening-spec.md](../encyclopedia/15-relay-foundation-hardening-spec.md) · [encyclopedia/13-relay-and-startup-failure-atlas.md](../encyclopedia/13-relay-and-startup-failure-atlas.md)  
**Sibling slices:** [relay-network-diagnostics-design-2026-10.md](../../specs/backend/relay-network-diagnostics-design-2026-10.md) · [public-nostr-restore-charter-2026-08.md](../../specs/backend/public-nostr-restore-charter-2026-08.md) · [production-tor-opt-in-public-default-design-2026-07.md](../../specs/backend/production-tor-opt-in-public-default-design-2026-07.md) · [tor-transport-mode-design-2026-08.md](../../specs/backend/tor-transport-mode-design-2026-08.md) · [tor-verified-infeasible-2026-08.md](../../specs/backend/tor-verified-infeasible-2026-08.md)

```text
GOAL:     One Network Infrastructure Module — dial · underlay · pool policy · diagnostics
DEFAULT:  Public Nostr (Default Stable) enabled unless user disables
TOR:      Opt-in sidecar + explicit transport arm · never wedges clearnet · no fake Verified
METHOD:   Consolidate owners (subtract parallel truth) · tune like a game-engine netcode layer
NOT:      Second crypto stack · dialect tourism as NIM · Discord GTM · invent VPN killer app
```

---

## 0. Research synthesis (what already exists)

### 0.1 Corpus (read before inventing)

| Path | Role |
|------|------|
| encyclopedia/12 · 13 · 15 | Owner truth · failure atlas · hardening invariants |
| conduit-mesh concept + C* archive | Multi-conduit frame · Tor host / SOCKS charters |
| transport-engine W* archive | Host publish · snapshot · legacy deletion |
| production-tor-opt-in-public-default | **Public default · Tor off at boot** (settled product) |
| tor-transport-mode-design | Sidecar ≠ routing · `transportArmed` gate |
| tor-verified-infeasible | Tor Verified **INFEASIBLE** here · keep L1 code |
| public-nostr-restore-charter | Public Nostr restore **ACTIVE** · ≠ Tor pause |
| release-without-tor sovereignty | Clearnet ship · Tor optional underlay |
| relay-network-diagnostics-design (2026-10) | VPN vs disabled vs local — honesty UX |
| r-relay SSH underlay L3 handoff | SSH forward as proven underlay pattern |
| SELF-T1-BOOT / private-trust-local-setup | Operator cell path (local Docker / VPS) |

### 0.2 Settled product contracts (do not renegotiate)

| Contract | Source |
|----------|--------|
| Boot = public Default Stable (`nos` / primal / damus); Tor **off** | production-tor-opt-in-public-default |
| Tor enable starts sidecar; **Route via Tor** arms SOCKS | tor-transport-mode-design |
| Tor Verified not a release gate | tor-verified-infeasible · release-without-tor |
| Public Nostr goal not cancelled by Tor pause | public-nostr-restore-charter |
| One owner per lifecycle · local ≠ network truth | encyclopedia 12 / 15 · sovereignty charter |
| Managed workspace may bind private relays (public blocked for *communities*) | private-trust docs — **orthogonal** to DM public default |

### 0.3 Why it feels “neglected”

Not absence of code — **fragmented truth**:

- Settings metrics, supervisor readiness, mesh `publishReady`, NativeRelay dials, OS VPN/proxy, Tor sidecar — often disagree.  
- Operators see “offline” when URLs are **disabled**, or “Ready” when sockets never opened (historical honesty bugs).  
- VPN/proxy/Tor failure classes were diagnosed in specs but never unified into one **Network Infrastructure** plane with clocks, budgets, and classifiers.

---

## 1. North star (Swiss-watch / game-engine analogy)

Treat networking like a dedicated **netcode subsystem**:

| Game-engine idea | NIM analogue |
|------------------|--------------|
| Fixed tick / budgets | Dial concurrency · probe cadence · failover cooldown |
| Prediction vs authority | Optimistic UI ≠ open socket authority |
| Interest management | Which URLs are in the **armed dial set** |
| Lag compensation | Queued publish · reconnect without toast storms |
| Dedicated net thread | Native dial plane (`net.rs` / NativeRelay) — not React effects as dialers |
| Telemetry | Path diagnosis · RTT · reason codes — one metrics owner |

**Craft rule:** Every state the user sees must be reducible to a **typed reason code** from one owner. No vibes.

---

## 2. Layered architecture (low → high)

```text
L0  Host / OS path
      DNS · TCP/TLS · system proxy · VPN TUN · (optional) Tor SOCKS · SSH local forward
L1  Dial plane (native-first)
      connect_relay · budgets · error taxonomy · clearnet vs SOCKS vs loopback
L2  Underlay policy
      Mode: Clearnet | TorArmed | (future) ProxyExplicit | SshForward
      Invariant: enabling underlay never mass-refuses clearnet until armed
L3  Pool membership & roles
      enabled/disabled · primary/standby · Default Stable · lab localhost · workspace binds
L4  Mesh / transport snapshot
      Conduit mesh · TransportSnapshot · publish/subscribe readiness (evidence-backed)
L5  Supervisor & recovery
      relay-runtime-supervisor · recovery policy · failover (single owner)
L6  Diagnostics & UI
      Path classifier · metrics cards · readiness copy · path-check ritual
L7  Product packs
      Transport presets · Tor pack fail-closed · private-trust presets
```

**NIM** = the **named program** that owns L0–L6 contracts and forbids parallel owners.  
Packages today map roughly: `apps/desktop/.../net|relay|tor` (L0–L1) · `transport-kernel` + `@obscur/conduit-mesh` (L2–L4) · `relay-runtime-supervisor` (L5) · Settings metrics (L6).

**Forbidden:** a new `apps/pwa/.../network-v2` that re-dials beside NativeRelay.

---

## 3. Protocol & underlay research notes (operator truth)

| Underlay | What it is | Product stance |
|----------|------------|----------------|
| **Clearnet WSS** | TLS to public/private Nostr | **Default** for DM / Default Stable |
| **System VPN** | OS routes/TUN; opaque to app | Detect *effects* (timeouts, fake-IP DNS); never “control” VPN |
| **HTTP(S) proxy** | Often breaks or alters WS; fake-IP DNS (e.g. `198.18.x`) | Context in diagnostics; split-test ritual |
| **Tor SOCKS** | Circuit privacy when **armed** | Opt-in · bootstrap ≠ routing · no Verified claim here |
| **SSH local forward** | `localhost:L` → bastion → relay | Proven L3 pattern for private cells / sneakernet-adjacent |
| **Loopback Docker** | `ws://localhost:7000` | Lab / Track L · must be **enabled** to dial |
| **Coordination HTTP** | `:8787` membership directory | **Not** a Nostr relay URL |

WebSocket upgrade (`101`) is the unit of “relay reachable.” HTTPS to unrelated sites ≠ Nostr path OK.

---

## 4. Product requirements (NIM)

| ID | Requirement |
|----|-------------|
| **N1** | Fresh profile: Default Stable public relays **enabled**; Tor **off**; localhost present but **disabled** until user/lab enables |
| **N2** | User may disable any public relay; pool must degrade honestly (not fake Ready) |
| **N3** | Tor: sidecar start/stop separate from **transportArmed**; clearnet dials OK until armed |
| **N4** | When Tor armed: dials via SOCKS with global budget; disarm restores clearnet without restart hell |
| **N5** | Diagnostics classify: disabled · invalid_scheme · loopback_down · remote_unreachable · tls_or_proxy · tor_warming · open |
| **N6** | VPN hypothesis only as **derived pattern**, never asserted fact without split-test |
| **N7** | Private-trust / workspace bind rules stay; they must not silently delete public DM default |
| **N8** | One metrics owner (`relayHealthMonitor` + mesh activity); one dial owner (native plane) |

---

## 5. Target module shape (consolidation, not greenfield)

### 5.1 Logical package (name)

```text
Network Infrastructure Module (NIM)
  contracts:  reason codes · underlay mode · path-check results · dial budgets
  host:       desktop net/tor/ssh ports (Rust)
  kernel:     transport-kernel underlay + dial policy (TS)
  mesh:       conduit-mesh runtime (existing)
  supervisor: single recovery owner (existing)
  diagnose:   relay-path-diagnosis (+ UI mappers)
```

Physical layout preference (when implementing):

| Piece | Prefer |
|-------|--------|
| Reason codes + classifiers | `apps/pwa/app/features/transport-kernel/` or `packages/obscur-network-contracts` (if extracted) |
| Dial | Keep Rust `net` / relay commands — shrink glue, don’t fork |
| Docs | This charter + slice designs under `specs/backend/nim-*` |

### 5.2 Subtraction targets (when slices land)

- Duplicate “is online?” heuristics in UI that ignore supervisor  
- Fake open from publish-ready overlays (restore charter H1 spirit)  
- React effects that open sockets outside the dial plane  
- HTTP coordination URLs accepted as relay entries without `invalid_scheme`

---

## 6. Phase program (ordered)

| Phase | Name | Exit evidence |
|-------|------|----------------|
| **P0** | Architecture lock (this charter) | Maintainer accepts N1–N8 · layer map |
| **P1** | Honesty + diagnostics (Slice A±C) | [diagnostics design](../../specs/backend/relay-network-diagnostics-design-2026-10.md) L1 + L3 screenshot |
| **P2** | Public path restore | ≥1 public WSS open on a reachable network · DM evidence ([restore charter](../../specs/backend/public-nostr-restore-charter-2026-08.md) H2–H3) |
| **P3** | Dial plane budgets | Documented concurrency · error taxonomy · no toast storms when all remotes fail |
| **P4** | Tor seamlessness | Armed/disarm L1 + maintainer L3 **only on Tor-capable path**; never claim Verified on blocked LAN · ritual [tor-smoke-verification-ritual-2026-10.md](../../specs/backend/tor-smoke-verification-ritual-2026-10.md) |
| **P5** | Underlay kit | SSH forward + local lab presets as first-class “path packs” (docs + apply) |
| **P6** | Optional extract | `obscur-network-contracts` package if boundaries justify |

**Parallel (does not block P0–P1):** Self T1 Track L on **enabled** `ws://localhost:7000` while public path is restored on a capable network.

---

## 7. Tor — “seamless” redefined honestly

| Seamless means | Seamless does **not** mean |
|----------------|----------------------------|
| Clearnet keeps working while Tor sidecar starts | Tor bootstrap always reaches 100% on every LAN |
| One click to arm/disarm routing | Fake Ready / Verified for marketing |
| Dial budget prevents wedging the host | Tor replaces public Nostr as default |
| Failure copy: warming / SOCKS timeout / CF | Patch loops on INFEASIBLE verify surface |

Resume Tor Verified soak **only** when [tor-verified-infeasible](../../specs/backend/tor-verified-infeasible-2026-08.md) prerequisites flip.

---

## 8. VPN / SSH — design stance

| Topic | Stance |
|-------|--------|
| VPN | Underlay noise at L0; NIM measures reachability; operator split-test in diagnostics |
| SSH | Supported **pattern** (local forward to private relay); productize as preset/path pack in P5, not ambient auto-SSH |
| Dual stack | Prefer explicit underlay mode over silent “try everything” |

---

## 9. Proof & claim discipline

| Claim | Requires |
|-------|----------|
| Charter accepted | Maintainer ack on N1–N8 |
| Diagnostics Implemented | L1 tests for classifier + copy |
| Public Nostr Verified | Open socket + DM on public path (restore H3) |
| Tor seamless Implemented | Arm/disarm + clearnet restore L1; L3 only on capable net |
| Tor Verified | **Forbidden** until feasibility flip |

---

## 10. Decision gate (maintainer)

Reply with one:

- [ ] **Accept charter** — next atomic = **P1** diagnostics A+C  
- [ ] **Accept + P2 first** — prioritize public WSS reachability on this host (VPN/network) before UI  
- [ ] **Revise N*** — list which requirements to change  
- [ ] **Park NIM** — return to Self T1 local-only only  

---

## 11. Immediate operator note (today’s machine)

While NIM is designed:

1. Enable `ws://localhost:7000` for Track L (disabled ≠ VPN).  
2. Treat public DISCONNECTED as **path** problem until TCP/WSS 101 to a Default Stable host works.  
3. Tor OFF for clearnet/local soaks.  
4. Do not add `http://127.0.0.1:8788` as a relay.

---

**Assistant lock:** Research and architecture only until P0 accepted. Implement via named slices; subtract parallel owners; public default + Tor opt-in already settled — NIM makes them *reliable and diagnosable*, not reinvented.
