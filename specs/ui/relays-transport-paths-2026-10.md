# UI — Transport packs as distinct paths (Slice 2)

**Date (UTC):** 2026-10-18  
**Status:** Landed  
**Parent:** [relays-standard-advanced-ia-2026-10.md](./relays-standard-advanced-ia-2026-10.md)

## Problem

Standard Relays still lists ~9 packs across four categories (3 public + Tor + 4 private + hybrid). Choice overload for non-technical users.

## Distinct paths (Standard)

| Path | Preset | Intent |
|------|--------|--------|
| Everyday clearnet | `default_stable` | Product-clear public Nostr |
| Public + private | `hybrid_public_http` | Mixed adapters (boot default family) |
| Local only | `local_dev_mesh` | No public Nostr dependency |
| Tor onion | `tor_onion_mesh` | Tor-gated template |

## Advanced-only packs

`high_redundancy` · `low_latency` · `local_http_mesh` · `private_lan_ws` · `ssh_bastion_forward`

Full `TRANSPORT_PRESET_GROUPS` when Advanced is open. Catalog API unchanged — apply/match still use the full catalog.

## Non-goals

Delete advanced packs · change PRODUCT_BOOT · Tor Verified · Soft L3

_Last updated: 2026-10-18T08:15:00Z_
