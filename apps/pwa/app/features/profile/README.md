# `features/profile` — social display & publish

**Plane:** social / peer presentation (not desktop profile slots)  
**Rewrite band:** [platform-boundary-map K4](../../../../specs/backend/platform-boundary-map-2026-11.md)

## Owns

- Peer / self **display metadata** (name, avatar, about, NIP-05 resolve helpers)
- Kind-0 style **publish** (`use-profile-publisher`) and metadata hydrate/cache
- Avatar / completeness UI for social identity

## Does not own

- Profile **slots**, window↔profile binding, registry CRUD
- Isolation snapshot, data-root wipe, slot login / account switch
- PDK / at-rest open paths

Those live under **`features/profiles`**.

## Allowed reads from `profiles`

- Active scope id / storage key helpers (`getResolvedProfileId`, `getScopedStorageKey`)
- Registry **change events** (listen only) — not `ProfileRegistryService.create/switch/remove` from production UI here

## Canonical consumers

Messaging, search, avatar chrome — import display hooks from this tree.
