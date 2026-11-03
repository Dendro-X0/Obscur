# `features/profiles` — slots, isolation & registry

**Plane:** Profiles (slots) — window binding, registry, data-root / isolation  
**Rewrite band:** [platform-boundary-map K4](../../../../specs/backend/platform-boundary-map-2026-11.md)

## Owns

- `ProfileRegistryService` and profile **slot** lifecycle (create / switch / remove)
- Desktop **isolation** snapshot, window boot, runtime scope (`getResolvedProfileId`, identity scope)
- Data-root / harvest / wipe / portability import-export around slots
- Slot login / account-conflict UX tied to multi-profile windows

## Does not own

- Social **kind-0 publish** or peer metadata hydrate as product owner
- NIP-05 resolution as the display plane

Those live under **`features/profile`** (singular).

## Allowed reads from `profile`

- Display name / metadata cache clears for switcher cards
- `useProfile` / draft sync when a slot UI needs the current social draft

Do **not** import `use-profile-publisher` into this tree — publish stays in `profile`.

## Canonical consumers

Auth door, title-bar switcher, desktop boot, storage scope resolution.
