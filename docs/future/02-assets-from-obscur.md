# Assets from Obscur — harvest map for future kernel

_Last reviewed: 2026-05-15 (baseline commit 0797ce1c)._

**Status:** Inventory draft  
**Last updated:** 2026-05-16

Use this when splitting repos or designing the kernel. **Do not delete** working product code to match this map prematurely.

---

## Packages (`packages/`)

| Package | Reuse for kernel | Reuse for app only |
|---------|------------------|-------------------|
| `@dweb/crypto` | Yes — keys, E2E | |
| `@dweb/core` | Profile bus, isolation patterns | |
| `@dweb/storage-contracts` | Tombstones, contracts | |
| `@dweb/storage` | IndexedDB adapters | |
| `@dweb/client-gateway` | Port definitions; split later | App binding stays in PWA |
| `@dweb/nostr` | **Adapter only** | |
| `@dweb/crdt` | Community state experiments | |
| `@dweb/db` | SQLite / native persistence | |
| `ui-kit` | | Yes |

---

## Application features worth preserving (90%+)

- Desktop + PWA shells, profile isolation, auth/unlock
- DM threads, attachments, voice/call signaling (as shipped)
- Communities / sealed groups (membership ingress, coordinator)
- Account sync backup (with honest convergence rules)
- Dev tools, relay dashboard, privacy settings

---

## Documentation worth merging into encyclopedia over time

- [Client unified gateway](../gateway/client-unified-gateway.md)
- [Core architecture truth map](../encyclopedia/12-core-architecture-truth-map.md)
- [Deletion roster limitations](../messaging/deletion-roster-limitations.md)
- [DM recall for everyone](../messaging/dm-recall-for-everyone.md) — cooperative semantics

---

## Experiments to keep in `docs/future/` until chartered

- Full SQLite single-store rewrite ([roadmap-v2-draft](../architecture/roadmap-v2-draft.md)) — evaluate against kernel port model first
- Team intranet deployment topology
- NIP-17-only ingest with NIP-04 legacy read

When an experiment graduates, open a program issue — do not land drive-by code from this folder alone.
