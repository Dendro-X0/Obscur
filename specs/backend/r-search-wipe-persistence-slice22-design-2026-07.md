# Design — R-SEARCH-WIPE-PERSISTENCE Slice 22

**Status:** Designed · 2026-07-30  
**Prior:** [investigation](./r-search-wipe-persistence-slice22-investigation-2026-07.md)

---

## Session gate

```text
NEXT ATOMIC STEP:     Slice 22 — search/wipe → persistence.*
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab · R-RELAY
CANONICAL OWNER:      persistence.* + profile-local-reset-service (wipe)
PROOF BEFORE DONE:    cargo test persistence_wipe_profile_local_data · vitest profile-local-reset + boundary
OUT OF SCOPE:         Tombstone search/wipe IPC · group · P2 soak
```

---

## Keep-set

| # | Change |
|---|--------|
| 1 | Rust `dispatch_persistence` — `searchMessages`, `wipeProfileLocalData` |
| 2 | Contracts + `@obscur/persistence-engine` helpers |
| 3 | Migrate `profile-local-reset-service` wipe off bare `db_*` |
| 4 | Boundary asserts · L1 |

## Methods

| Method | Payload | Result |
|--------|---------|--------|
| `searchMessages` | `{ query, limit? }` camelCase | `MessageSearchResult[]` |
| `wipeProfileLocalData` | `{ removeProfileRow }` camelCase | `WipeProfileLocalDataReport` |

## Claim language

| May say | When |
|---------|------|
| Implemented | Keep-set landed |
| Verified | Named L1 green |
| Fixed (wipe sole engine product path) | Verified — search engine-ready; IPC may remain until Slice 23 |
