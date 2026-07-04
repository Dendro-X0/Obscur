# Conduit Mesh C3 — Tor probe integration spec

**Status:** **Design** — maps desktop Tor to mesh; implementation in host port (post-C3)  
**Last updated:** 2026-06-26  
**Code:** [commands/tor.rs](../../apps/desktop/src-tauri/src/commands/tor.rs) · `@obscur/conduit-mesh-contracts` `tor-policy.ts`

---

## Principle

Tor is **not** a parallel relay pool. It is a **network policy** on each `ConduitDescriptor.networkPolicy`. The mesh asks one question before publish: **is Tor ready for conduits that require it?**

Obscur encrypts envelopes; Tor only affects **which routes are legal**, not ciphertext format.

---

## Desktop → mesh mapping

| `TorStatusSnapshot` (Tauri) | `MeshTorRuntimeState` (mesh) |
|-----------------------------|------------------------------|
| `configured` (`enable_tor`) | `configured` |
| `ready` (proxy reachable) | `ready` |
| `proxy_url` | `proxyUrl` |
| `state === Connected` | `ready: true` (necessary but mesh uses `ready` flag from snapshot) |

```typescript
// Future host adapter (not wired in C3)
export const mapTorStatusSnapshotToMeshTorState = (
  snapshot: Readonly<{
    configured: boolean;
    ready: boolean;
    proxyUrl: string;
  }>,
): MeshTorRuntimeState => ({
  configured: snapshot.configured,
  ready: snapshot.ready,
  proxyUrl: snapshot.proxyUrl,
});
```

**Refresh cadence (recommended):**

1. On mesh boot / `configureConduits`
2. Before each `publishEnvelope` when any candidate has `tor_preferred` or `tor_required`
3. On `tor-status` Tauri event (desktop already emits)

**Probe today (Rust):** `probe_tor_proxy` — TCP connect to SOCKS host:port, 5s timeout. Desktop exposes readiness via Tauri `get_tor_status`. Mesh does **not** duplicate this in TS; host supplies `ready` through `getTorState`.

---

## Policy matrix (headless — implemented C3)

| Conduit `networkPolicy` | Tor `ready: false` | Tor `ready: true` |
|-------------------------|-------------------|-------------------|
| `clearnet` | Viable | Viable |
| `tor_preferred` | Viable (driver may use direct fallback — C4+) | Viable (driver uses SOCKS) |
| `tor_required` | **Blocked** — excluded from publish candidates | Viable |

| Outcome | `recoveryReasonCode` | Evidence `failureReason` |
|---------|---------------------|---------------------------|
| All candidates blocked by Tor | `tor_unreachable` | `tor_unreachable` |
| No candidates after envelope filters | `no_viable_conduit` | `no_viable_conduit` |

**Fail-closed:** `tor_required` conduit never silently publishes over clearnet when `ready: false`.

---

## Snapshot fields

| Field | Source |
|-------|--------|
| `torConfigured` | `torState.configured` OR any conduit `networkPolicy !== clearnet` |
| `torReady` | `torState.ready` |
| `effectiveNetworkPolicy` | `deriveEffectiveNetworkPolicy(conduits, torState)` |

---

## End-to-end probe (future L3 — maintainer)

1. Enable Tor in desktop settings; wait for `ready: true`
2. Configure conduit with `networkPolicy: tor_required`
3. `publishEnvelope` → evidence `accepted_by_operator`
4. Stop Tor → `publishEnvelope` → `tor_unreachable`, snapshot `recoveryReasonCode: tor_unreachable`

**Not in C3 gate** — headless mock `getTorState` only.

---

## Performance research (untested — backlog)

- WS over SOCKS vs HTTP long-poll for DM throughput
- Sidecar bootstrap vs external Tor on 9050
- One Tor circuit per profile vs per conduit

Track under Conduit Mesh experimental band; no ship claims until measured.
