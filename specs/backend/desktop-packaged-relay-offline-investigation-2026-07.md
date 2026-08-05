# Investigation — packaged desktop relay transport stays offline

**Status:** Capture complete (2026-07-28) — implementation slice next  
**Date:** 2026-07-28 (UTC)  
**Symptom:** packaged NSIS desktop stays on *“Relay transport is offline”* after unlock  
**Handoff:** [`docs/handoffs/current-session.md`](../../docs/handoffs/current-session.md)

---

## Summary

The packaged desktop build is **not** running the experiment offline stub. Production packaging sets `NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE=1`, so the real relay provider and network provider are mounted.

Two owner mismatches explain why packaged desktop stayed offline while dev could look healthy:

1. **Pool routing:** native desktop defaults to the **Conduit Mesh relay pool** (`shouldUseConduitMeshRelayPoolHook`), not the enhanced WebSocket pool used by many dev smoke paths.
2. **Socket owner:** that Conduit Mesh client opened relays with raw `new WebSocket(url)` instead of `createRelayWebSocket` → `NativeRelay` → Rust `connect_relay`.
3. **Secondary mismatch (also fixed):** `NativeRelay` previously preferred browser WebSocket whenever Tor was disabled, even though Rust already supports direct non-Tor native WebSocket in `connect_relay_internal(...)`.

Result: production could ship with public default relays present in settings while the active pool never obtained a writable native connection.

This explains why a packaged build can remain permanently offline even though:

- production shell is built with online transport enabled
- default relay settings exist in the UI layer
- Rust native relay commands are registered and available

---

## Symptom contract

| Field | Value |
|-------|--------|
| User action | Install packaged NSIS build → create/unlock account → land in shell |
| Expected | Public DM relays connect and readiness becomes healthy/degraded with real candidates |
| Actual | Banner remains **Relay transport is offline** |
| Known non-cause | offline experiment stub (`NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE=0`) |
| Proof tier target | L3 packaged desktop runtime |

---

## Evidence

### Packaging / build evidence

- `scripts/build-pwa-shell.mjs` defaults production shell builds to `NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE=1`
- `docs/program/obscur-v2-install-build-guide.md` explicitly says production desktop embeds live relay transport
- latest packaged installer was rebuilt from `pnpm desktop:package`

### Runtime owner evidence

- `experiment-shell-policy.ts`
  - offline stub only when experiment shell is on **and** online flag is off
- `network-provider.tsx`
  - full network provider is used unless offline stub is active
- `relay-provider.tsx`
  - full relay provider is used unless offline stub is active

### Native relay mismatch

#### TypeScript owners

`apps/pwa/app/features/transport-kernel/conduit-mesh-nostr-ws-client.ts`

- production native pool path (Conduit Mesh hook owner)
- previously used raw `new WebSocket(url)` for `wss://` relays

`apps/pwa/app/features/relays/hooks/native-relay.ts`

- when Tor is disabled, previously preferred browser WebSocket and skipped `relayNativeAdapter.connectRelay(...)`

#### Rust owner

`apps/desktop/src-tauri/src/relay.rs`

- `connect_relay_internal(...)` supports:
  - Tor-routed native WS when Tor is enabled
  - direct `connect_async(...)` native WS when Tor is disabled

So TS and Rust disagree about the canonical owner for non-Tor desktop relay connections.

---

## Root-cause hypothesis

**Primary hypothesis:** packaged desktop uses the Conduit Mesh pool with browser WebSockets, bypassing the native relay connector that dev-enhanced-pool paths exercise. Public relays (`wss://relay.damus.io`, `wss://nos.lol`) are already in `DEFAULT_RELAYS`; the failure is transport wiring, not missing relay configuration.

---

## Fix direction

Use the native desktop relay path for non-local relays regardless of Tor state.

Keep the existing browser WebSocket exception only for local workspace relay hosts, where same-object OK-frame behavior is intentionally required.

### Minimal implementation slice

1. Route Conduit Mesh WS connections through `createRelayWebSocket` (native-first on desktop).
2. Update `NativeRelay` to initialize native listeners and call `connectRelay(...)` even when Tor is disabled.
3. Keep browser fallback only as degraded recovery after native connect failure.
4. Rebuild packaged installer and verify relay readiness leaves `offline` on a fresh account without private nodes.

---

## Proof plan

- L1: targeted `auth-screen` / relay hook tests plus native relay tests
- L2: targeted static type/lint on touched files
- L3: packaged desktop runtime re-check on rebuilt installer
