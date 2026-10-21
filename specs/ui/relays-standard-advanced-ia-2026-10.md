# UI — Relays Standard vs Advanced IA

**Date (UTC):** 2026-10-17  
**Status:** Landed (Slice 1 + Slice 2 paths)  
**Surface:** Settings → Network → Relays (+ Protocols/Network sibling)

```text
HANDOFF ATOMIC STEP: Relays Standard / Advanced information architecture
PAUSED / CANCELLED: Soft L3 Fixed · remount · uncapped Quiet · Tor Verified
CANONICAL OWNER: RelaysSettingsTabPanel · TransportPresetCatalogPanel
PROOF: vitest settings-search + relays panel structure contract; desktop rebuild
```

## Problem

Relays already has an “Advanced Settings” toggle, but **Standard still shows operator surfaces**: offline USB/QR packs, conduit mesh, coordination API, community modes, and RTT metric dashboards. Non-technical users hit technical modes before pack selection finishes.

Protocols/Network is already a short three-step panel (protocol → path → Matrix login). Keep it single-mode.

## Split

| Mode | Surfaces |
|------|----------|
| **Standard** | Readiness banner · Transport packs (+ Open Protocols/Network) · Custom endpoint · Compact pool status · Multi-node toggle · Advanced entry |
| **Advanced** | Offline pack · Conduit mesh · Coordination API health · Verbose pool copy · Community modes / membership sync · Performance metrics · Bulk ops · Per-node enable/reorder list |

## Slice 1 (this mutate)

Gate Offline pack, Conduit mesh, API health, community modes, and performance metrics behind `showAdvancedRelays`. Search “relay-advanced” still expands Advanced. No behavior change to pack apply / Tor gate / Soft L3.

## Slice 2

Standard catalog = four paths (`default_stable` · `hybrid_public_http` · `local_dev_mesh` · `tor_onion_mesh`). Full pack list when Advanced open. See [relays-transport-paths-2026-10.md](./relays-transport-paths-2026-10.md).

## Non-goals

Persist mode preference · redesign metric cards · merge Relays into Protocols · Tor Verified

_Last updated: 2026-10-18T08:20:00Z_
