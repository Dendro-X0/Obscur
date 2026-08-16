# Conduit Mesh C13 — Tor SOCKS on HTTP / WS drivers charter

**Status:** **L1 landed** — routed HTTP SOCKS fetch + native command  
**Last updated:** 2026-07-15  
**Parent:** [conduit-mesh-c9-tor-host-integration-charter.md](./conduit-mesh-c9-tor-host-integration-charter.md)  
**Design:** [conduit-mesh-c13-tor-socks-drivers-design.md](../../specs/backend/conduit-mesh-c13-tor-socks-drivers-design.md) · [conduit-mesh-c3-tor-probe-integration.md](./conduit-mesh-c3-tor-probe-integration.md) §7

---

## Slice goal

Route **driver-level transport** (HTTP fetch + Nostr WebSocket) through the host Tor SOCKS proxy when conduit `networkPolicy` is `tor_preferred` or `tor_required` and `MeshTorRuntimeState.ready === true`.

C9 wired **policy + fail-closed**; C13 wires **actual packets**.

---

## Problem (C9 limitation)

| Layer | Today |
|-------|-------|
| Mesh policy | `tor_required` blocks publish when Tor down ✓ |
| Nostr WS (PWA) | `conduit-mesh-nostr-ws-client` uses browser `WebSocket` — **no SOCKS** |
| HTTP drivers | `globalThis.fetch` — **no SOCKS** |
| Native relay (legacy) | Rust `RelayClient` has SOCKS scaffold in `libobscur` — **not wired to mesh pool** |

Result: `tor_required` HTTP conduits can pass policy checks in tests but **clearnet fetch may still occur** in production PWA unless endpoints are `.onion` and reached by other means.

---

## In scope

| Deliver | Detail |
|---------|--------|
| **NetRuntime fetch port** | `ConduitMeshFetch` implementation that accepts `proxyUrl` from `getTorState()` |
| Desktop native command | Tauri `fetch_via_proxy` or extend existing net commands — SOCKS5h for HTTP(S) |
| Driver injection | `createConduitDriverFromDescriptor` receives fetch factory bound to conduit policy + tor state |
| WS path | Desktop: route Nostr WS through native relay adapter (`connect_relay` + `proxyUrl`) when mesh pool uses native path; document PWA web limitation |
| Probe e2e | `probe()` uses same routed transport as `publish` / `pull` |
| Headless tests | Mock fetch records `proxyUrl` header or metadata |
| `verify:conduit-mesh-c13` | L1 gate |

## Out of scope

- Mobile Tor (no sidecar) — snapshot reason `tor_unavailable_on_platform`
- Circuit isolation per conduit (research backlog)
- Assigning `tor_required` in Settings UI (user URL editor)
- Performance benchmarks (document only in L3) |

---

## Design rules (from concept doc)

1. Tor is **network policy on conduits**, not a separate pool.
2. **Single injection point** — `ConduitMeshFetch` factory in relay pool runtime, not per-call ad hoc.
3. `tor_required` + Tor down → **fail closed** (C9, unchanged).
4. `tor_preferred` + Tor down → clearnet allowed (driver uses direct fetch).
5. Probes must use **routed** transport (end-to-end honesty).

---

## Architecture

```text
createConduitMeshRelayPoolRuntime
  getTorState() → MeshTorRuntimeState { ready, proxyUrl }
  createFetchForConduit(descriptor, torState) → ConduitMeshFetch
    clearnet + (tor_preferred|required) + ready → native SOCKS fetch
    else → globalThis.fetch

createCustomHttpConduitDriver({ fetch: routedFetch })
createConduitMeshNostrWsClient / native adapter ({ proxyUrl })
```

**Owner:** relay pool runtime supplies fetch; drivers do not read Tor settings directly.

---

## Platform matrix

| Surface | HTTP SOCKS | WS SOCKS |
|---------|------------|----------|
| Desktop Tauri | Native command (in scope) | `relay-native-adapter` + `proxyUrl` (in scope) |
| PWA browser | **Not feasible** without extension | Browser WS — document limitation |
| Engine lab / vitest | Mock fetch with proxy metadata | In-memory wire |

---

## Proof

| Layer | Command / evidence |
|-------|-------------------|
| L1 | `pnpm verify:conduit-mesh-c13` |
| L3 | Enable Tor → `tor_required` HTTP conduit publish + receive — **not claimed** |

---

## Dependencies

- **C9 L1** landed (`getTorState` host port)
- **C10 L1** landed (HTTP pull uses same fetch)
- Investigation spec in `specs/backend/` before Tauri command changes (backend-rigor)

---

## Research backlog (no ship claims)

- WS over SOCKS vs HTTP long-poll over SOCKS throughput (see concept doc §7.2)
- Sidecar bootstrap vs external Tor on 9050
