# Operator relay compaction (v1.8.10 — D2)

**Audience:** Operators running managed-workspace infra  
**Related:** [managed-workspace-relay-deletion.md](../messaging/managed-workspace-relay-deletion.md), [v1.8.10-scope](../program/v1.8.10-scope.md)

---

## What D2 adds (after v1.8.9 D1/D3)

| Phase | Behavior |
|-------|----------|
| **D1** | Live suppress — hidden `EVENT` ids not forwarded to clients |
| **D3** | Honest UI — “Remove from this workspace” |
| **D2** | **Storage compaction** — remove hidden message rows from **nostr-rs-relay** SQLite (opt-in, operator-run) |

D2 does **not** erase copies on other relays, backups, or already-synced clients.

---

## Architecture

```text
Obscur clients → relay-gateway (:7000) → nostr-rs-relay (upstream)
                      ├─ D1 filter (global registry)
                      └─ D2 persist → hide-registry.json
Operator (manual) → operator-relay-storage-compact.mjs → DELETE FROM event …
```

1. Point workspace relay at **gateway** (`pnpm dev:relay:gateway:docker` maps `:7000` → gateway).
2. Kind **5** hide events append target ids to `apps/relay-gateway/data/hide-registry.json`.
3. When ready, operator runs compaction against relay DB (relay **stopped** or DB copy recommended).

---

## Compaction command

**Prerequisites:** `sqlite3` CLI; path to `nostr.db` (Docker volume or bind mount).

```bash
# Dry run — print DELETE statements
node scripts/operator-relay-storage-compact.mjs --dry-run

# Compact (default paths: registry + infra/nostr/data/nostr.db)
node scripts/operator-relay-storage-compact.mjs

# Custom paths
node scripts/operator-relay-storage-compact.mjs \
  --registry apps/relay-gateway/data/hide-registry.json \
  --db /path/to/nostr.db
```

Uses `PRAGMA foreign_keys = ON` and `DELETE FROM event WHERE event_hash = x'…'` per [nostr-rs-relay database maintenance](https://github.com/scsibug/nostr-rs-relay/blob/master/docs/database-maintenance.md).

**Backup the database before compacting.**

---

## Environment (relay-gateway)

| Variable | Default | Purpose |
|----------|---------|---------|
| `OBSCUR_RELAY_HIDE_SUPPRESS` | `1` | D1 filter (`0` disables) |
| `OBSCUR_RELAY_HIDE_PERSIST` | `1` | Write registry JSON on hide (`0` disables) |
| `OBSCUR_RELAY_HIDE_REGISTRY_PATH` | `apps/relay-gateway/data/hide-registry.json` | Persist file |

---

## Test D2 (demo matrix)

See [v1.8.10 demo matrix](../assets/demo/v1.8.10/README.md): after remove-from-workspace, run compaction, confirm new REQ from relay DB does not return hidden event.
