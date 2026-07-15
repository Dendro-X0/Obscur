# Design — C13 Tor SOCKS on HTTP drivers

**Date:** 2026-07-15  
**Charter:** [conduit-mesh-c13-tor-socks-drivers-charter.md](../../docs/program/conduit-mesh-c13-tor-socks-drivers-charter.md)  
**Status:** Approved for L1 implementation

---

## Decision (L1)

| Choice | Why |
|--------|-----|
| Explicit `proxyUrl` from `getTorState` for each SOCKS request | End-to-end honesty — not silent global Tor flag alone |
| New Tauri command `mesh_http_fetch_via_socks` | Keeps `fetch_remote_*` unscoped; mesh owns policy |
| Per-descriptor routed `ConduitMeshFetch` | Single injection in pool runtime; drivers stay Tor-agnostic |
| `.onion` endpoints → `tor_required` in descriptor map | No Settings UI needed to exercise path |
| WS SOCKS via existing native relay `NetRuntime` | Already SOCKS when Tor enabled; document PWA browser WS limitation |
| SSE / circuit isolation | Out of scope |

---

## Transport mode

```ts
resolveConduitHttpTransportMode(descriptor, torState):
  clearnet → "direct"
  tor_preferred + ready + proxyUrl → "socks"
  tor_preferred + !ready → "direct"   // C9 fallback
  tor_required + ready + proxyUrl → "socks"
  tor_required + !ready → "blocked"  // fail closed (should not publish)
```

---

## Owners

| Concern | Module |
|---------|--------|
| Mode resolve | `@obscur/conduit-mesh` `resolve-conduit-http-transport.ts` |
| Fetch factory | `createRoutedConduitMeshFetch` (`create-routed-conduit-mesh-fetch.ts`) |
| Native SOCKS HTTP | `apps/desktop/.../commands/system.rs` `mesh_http_fetch_via_socks` |
| Host port | `conduit-mesh-socks-fetch-port.ts` (invoke native) |
| Pool wiring | `conduit-mesh-relay-pool-runtime` — per-driver routed fetch |
| Descriptor onion | `resolve-relay-pool-conduit-descriptors` — `.onion` → `tor_required` |
| Hook | `use-conduit-mesh-relay-pool` — pass `socksFetch` from host port |

---

## Native command contract

```
mesh_http_fetch_via_socks({
  url, method, headers?, bodyText?, proxyUrl
}) → { status, bodyText, contentType? }
```

- Allows `http://` and `https://` (team gateway + clearnet HTTPS).
- Uses `reqwest` with `Proxy::all(proxyUrl)` (SOCKS5/SOCKS5h).
- Does not use browser CORS (desktop only).

---

## Mental simulation

1. User adds `http://xyz.onion:8788` → descriptor `tor_required`.
2. Tor ready with `socks5h://127.0.0.1:9050` → driver GET/POST via native SOCKS.
3. Tor down → publish blocked by C9 (`tor_unreachable`); no clearnet leak.
4. Clearnet `http://127.0.0.1:8788` → direct `fetch` (unchanged C10/C12 path).

---

## Tests (L1)

| File | Cases |
|------|-------|
| `resolve-conduit-http-transport.test.ts` | Mode matrix |
| `create-routed-conduit-mesh-fetch.test.ts` | socks vs direct; blocked throws / returns failure |
| `conduit-mesh.c13.integration.test.ts` | Pool + tor_required records proxyUrl on socksFetch |
| `conduit-mesh-socks-fetch-port.test.ts` | Maps invoke payload |
| engine-lab contract | charter + command + hook anchors |
| Rust unit (optional light) | proxy URL parse reject |

---

## Out of scope (explicit)

- Changing global Tor toggle UX
- Browser PWA SOCKS (impossible without extension)
- Per-conduit SOCKS isolation circuits
