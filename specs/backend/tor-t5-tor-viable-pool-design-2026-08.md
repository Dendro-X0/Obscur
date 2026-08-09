# Design — T5-0 Tor-viable dial pool & SOCKS isolation

**Date (UTC):** 2026-08-08  
**Status:** Design **Accepted** · T5-1/T5-2 **Implemented (L1)** · next L3 / T5-3  


**Charter:** [tor-t5-stability-latency-charter-2026-08.md](./tor-t5-stability-latency-charter-2026-08.md) (T5-B)  
**Parents:** [tor-stability-latency-web-research-2026-08.md](./tor-stability-latency-web-research-2026-08.md) · [adaptive-public-nostr-design-2026-08.md](./adaptive-public-nostr-design-2026-08.md) · [tor-r4-slice-4b-tunnel-design-2026-08.md](./tor-r4-slice-4b-tunnel-design-2026-08.md)

```text
HANDOFF ATOMIC STEP:  Tor T5-0 design (Tor-viable pool + isolation)
PAUSED / CANCELLED:   Community · AUTH-SESSION
CANONICAL OWNER:      resolveTorViableDmRelayUrls (new) · gateway SOCKS isolation · relay.rs dial gate
PROOF BEFORE DONE:    Spec accepted · L1 tests named for T5-1/T5-2 (no dial change in T5-0)
OUT OF SCOPE:         Product dial change in this slice · onion ops (T5-3) · Arti · Community
```

## Goal

When Tor preference is ON and gateway is bootstrap-ready, NativeRelay must dial **only Tor-viable endpoints**, share **one SOCKS isolation identity** across the mesh WS pool, and prefer **sticky opens** over reconnect storms. When Tor is OFF, today’s adaptive public multi-relay path is unchanged.

T5-0 locks the **contracts**. T5-1 implements gateway isolation/`torrc`. T5-2 implements pool subtraction + honesty.

---

## 1. Tor-viable endpoint classification

### Predicate (single owner)

New pure helper (PWA, mirrored by Rust tests if needed):

```text
classifyTorRelayEndpoint(url) →
  | "onion_ws"      — ws:// or wss:// host ends with .onion
  | "onion_http"    — http(s):// host ends with .onion  (mesh HTTP; not NativeRelay WS)
  | "tor_allowlist" — host on TOR_VIABLE_CLEAR_HOSTS (explicit, curated)
  | "lab_loopback"  — localhost / 127.0.0.1 WS (lab only; Tor optional)
  | "public_cf"     — Default Stable public hosts (nos.lol, primal, damus, …)
  | "other_clear"   — other clearnet WS/HTTP
```

Reuse existing signals where possible:

| Signal today | File |
|--------------|------|
| Public default hosts | `isPublicDefaultRelayHost` / `discovery-relay-set` |
| Onion mesh HTTP | `isOnionMeshEndpoint` / `classifyRelayEndpointAdapter` → `tor_mesh` |
| Loopback lab | `isLocalDevWorkspaceRelayUrl` / `isLocalMeshHttpGatewayUrl` |

### Tor-viable for **NativeRelay dial** (when Tor ON)

An enabled URL may enter the Tor dial pool iff:

1. Class is `onion_ws`, **or**
2. Class is `tor_allowlist`, **or**
3. Class is `lab_loopback` **and** no onion/allowlist remotes are enabled (lab soak escape hatch), **or**
4. User explicitly tagged the entry (future: profile flag `torViable: true`) — **not in T5-1**; allowlist covers interim.

**Subtract** from Tor dial pool:

- `public_cf` (Default Stable publics) — **always** when Tor ON  
- `other_clear` unless on allowlist  
- `onion_http` — stays on HTTP mesh / gateway fetch path, **not** NativeRelay WS

### Allowlist (v1)

Start **empty** or with maintainer-curated non-CF hosts only. Do **not** put nos/primal/damus on the allowlist. Document that empty allowlist + no onion ⇒ Tor dial pool empty until T5-3 onion ships or user adds `ws://….onion`.

Optional env for lab: `OBSCUR_TOR_VIABLE_HOSTS=comma,separated,hosts` (gateway/desktop read for tests).

### Mesh policy alignment

| `ConduitNetworkPolicy` | Tor ON dial |
|------------------------|-------------|
| `TorRequired` | Endpoint must classify Tor-viable; else skip |
| `TorPreferred` | Prefer Tor-viable; do not fall back to `public_cf` while Tor ON |
| `Clearnet` | Eligible only if Tor OFF **or** allowlisted |

Extend `partition_by_tor_policy` in T5-2 only as needed so mesh configure does not schedule CF publics under Tor.

---

## 2. Pool resolution (subtraction, one owner)

### Clearnet (Tor OFF) — unchanged

```text
resolveDmTransportRelayUrls(relays)  // adaptive public / lab demote (Slice A)
```

### Tor ON + bootstrap ready

```text
resolveTorViableDmRelayUrls(relays) =
  filter enabled DM URLs by classifyTorRelayEndpoint ∈ {onion_ws, tor_allowlist}
  ∪ lab_loopback only if that set empty and lab enabled
```

Wire at the **same call sites** that feed NativeRelay / mesh active set (subtract CF from inputs — do not add a second parallel dialer).

| Tor OFF | Tor ON |
|---------|--------|
| Multi public redundancy OK | Prefer **1** Tor-viable primary (+ optional 1 standby onion) |
| Max redundancy 3 publics | Max dial targets **2** (sticky primary first) |

### Empty Tor pool honesty

If Tor ON and `resolveTorViableDmRelayUrls` is empty:

- Do **not** dial CF publics “just to try.”  
- Surface Relays copy (charter wording): Tor on · CF publics unreliable over Tor · add onion / turn Tor off.  
- Status: not “ISP blocked”; open sockets stay 0 honestly.

---

## 3. SOCKS isolation (gateway)

### Problem

Default `IsolateSOCKSAuth` makes distinct SOCKS user/pass → distinct circuits. Parallel tunnel dials without shared auth → N cold circuits → SOCKS timeouts.

### Contract

| Dial class | SOCKS5 username | Password |
|------------|-----------------|----------|
| NativeRelay mesh WS (all URLs in one profile session) | `obscur-mesh-ws` | `v1` (constant) |
| HTTP fetch (`/v1/http/fetch`) | `obscur-http` | `v1` |
| After hard CF/edge reject on a **clear** allowlist host | bump mesh password to `v1-{epoch}` once (isolate next dials) | — |

Onion dials use the **same** `obscur-mesh-ws` identity (share warm circuits). Do **not** NEWNYM globally on each 503.

### Implementation locus (T5-1)

- `apps/tor-gateway` SOCKS CONNECT (tunnel + HTTP) must pass username/password.  
- Desktop does not invent per-URL auth.  
- Cap: keep `MAX_CONCURRENT_DIALS` but mesh WS effective concurrency **1** (desktop dial gate already serializes; align gateway handshake semaphore so HTTP cannot starve WS).

### torrc (T5-1)

Patient client defaults (gateway-owned file):

| Knob | Intent |
|------|--------|
| Persist data dir | Already — keep |
| `CircuitBuildTimeout` | Prefer failover ~10–15s over infinite hang |
| `KeepalivePeriod` | Help long-lived WS |
| Avoid lowering `MaxCircuitDirtiness` aggressively | Sticky WS over churn |

Landed T5-1: `CircuitBuildTimeout 15`, `KeepalivePeriod 60`, `IsolateSOCKSAuth 1` (`render_client_torrc` + unit test).

---

## 4. Sticky WS & dial policy (desktop)

Already landed (keep):

- Fail-fast HTTP 403/429/5xx + cool-down  
- Fail-fast SOCKS timeout (no in-invoke second attempt)  
- Per-attempt dial gate  
- `Connected` → OPEN · JS timeout 120s  

T5-2 additions:

| Rule | Behavior |
|------|----------|
| Sticky | If URL already in `RelayPool` → `Already connected`; do not recycle unless error/disconnect |
| Max in-flight Tor connects | 1 (global gate) |
| Max Tor targets | 2 URLs from Tor-viable list |
| Reconnect backoff | Existing pool backoff; Tor empty-pool → no CF fallback |

---

## 5. Interaction with adaptive public Nostr

| Mode | Owner |
|------|--------|
| Tor OFF | Adaptive public / lab demote — **unchanged** |
| Tor ON | **Subtraction** via `resolveTorViableDmRelayUrls` — CF defaults never enter dial |

No dual owner: do not keep `resolveDmTransportRelayUrls` dialing CF while a side path dials onion.

Upload / HTTP Tor (Slice 4a) continues via gateway fetch; onion HTTP mesh uses existing `tor_mesh` adapter.

---

## 6. Mental simulation (one user action)

**Tor ON, no onion configured**

1. Unlock → pool resolve → Tor-viable empty.  
2. No NativeRelay dials to nos/primal/damus.  
3. Relays UI: honesty banner; open 0/0 or 0/N disabled CF shown as “not dialed under Tor.”  
4. User adds `ws://….onion` or turns Tor OFF → dials proceed.

**Tor ON, onion configured**

1. Pool = onion (+ optional second).  
2. Gateway SOCKS with shared `obscur-mesh-ws` auth.  
3. Tunnel → (no TLS for `ws://onion` or TLS if `wss://onion`) → open sticky.  
4. DM publish uses open onion path.

**Tor OFF**

1. Same as today’s clearnet multi-public path.

---

## 7. Proof plan (for later slices)

| Slice | L1 | L2 | L3 |
|-------|----|----|-----|
| T5-0 | Spec only | — | — |
| T5-1 | Gateway: SOCKS auth applied; semaphore; torrc smoke | Tunnel onion or allowlist host 101 | — |
| T5-2 | `classifyTorRelayEndpoint` · `resolveTorViableDmRelayUrls` unit matrix | — | Tor ON · onion or lab · ≥1 sticky open · Tor OFF clearnet OK |
| T5-3 | — | — | Obscur onion DM soak |

### Claim language

| May say | When |
|---------|------|
| T5-0 Design Ready | This file |
| T5-1/2 Implemented | Named L1 green |
| Tor-only Verified | T5-2 L3 + Tor OFF regression |

---

## 8. File / owner map (impl preview)

| Concern | Owner file(s) |
|---------|----------------|
| Classify + resolve Tor-viable | `relay-transport-scope.ts` (or sibling `relay-tor-viable.ts`) |
| Wire into provider / mesh configure | `relay-provider.tsx` · transport configure |
| Honesty copy | `relay-transport-scope-copy.ts` / Relays panel |
| SOCKS auth | `apps/tor-gateway` `tunnel.rs` · `dial.rs` |
| Dial gate / cool-down | `relay.rs` (mostly done) |
| Mesh policy | `mesh/tor_policy.rs` |

---

## Non-goals (T5-0)

- Shipping an onion relay (T5-3)  
- Allowlisting CF publics  
- Re-arming UI SOCKS  
- Arti migration  
- Product code in this slice

## Accept → next

Maintainer accept this design → **T5-1** (gateway isolation + torrc) in parallel-safe order with **T5-2** (pool subtraction), preferred order: **T5-1 then T5-2** so dials that remain use warm circuits.
