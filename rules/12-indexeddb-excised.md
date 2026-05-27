# IndexedDB permanently excluded

**Status:** Mandatory (greenfield persistence policy)  
**Last updated:** 2026-05-24

## Rule

- Do **not** call `indexedDB.open`, `indexedDB.deleteDatabase`, or use browser IndexedDB as durable storage in this monorepo.
- `@dweb/storage/indexed-db` uses an **in-memory engine** only; it must not be reverted to real IDB.
- Web durable paths: **chat-state localStorage** + **account projection**; native: **SQLite** via `@dweb/db`.
- Legacy IDB migration, hydrate-from-indexed, and IDB authority branches are disabled.

## Canonical policy module

`apps/pwa/app/features/runtime/persistence-policy.ts` — `INDEXED_DB_PERMANENTLY_EXCLUDED`

## Rationale

Avoid database path conflicts and dual-stack truth as Obscur moves to a single unified persistence stack per `docs/greenfield/`.
