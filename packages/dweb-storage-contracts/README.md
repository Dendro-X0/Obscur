# @dweb/storage-contracts

**Phase 2 (v1.5.0)** shared layer: persistence **ports**, **scoped context**, **native migration ownership**, and **client capability** flags.

- **PWA** implements ports against **IndexedDB** (`@dweb/storage`); no SQLite/Drizzle in the browser.
- **Desktop / mobile (native)** implement ports against **SQLite** (Drizzle and/or Tauri/Rust), with **exactly one** migration owner for the on-disk DB — see `migration-policy`. **Today:** desktop schema/migrations for `app.db` are owned by **`libobscur`** (Rust); the first shipped slice (**delete tombstones**) persists via the existing **`tombstones`** table and Tauri commands from **`@dweb/db`**, not a second TS migrator.

Product code should depend on these contracts when extracting storage behind injectable adapters. Keep this package **free of app imports**; use generics or minimal DTOs until shapes stabilize.

Full plan: `docs/v1.5.0-implementation-plan.md` (Phase 2).
