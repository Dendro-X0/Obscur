# Obscur data root bind contract

**Status:** Active (2026-06-08)  
**Scope:** Native Obscur desktop data folder only — not arbitrary app migration (see Deco separately).  
**Charter:** [v1.9.8-portable-storage-and-encryption-charter.md](./v1.9.8-portable-storage-and-encryption-charter.md)  
**Implementation:** `apps/desktop/src-tauri/src/data_root.rs`, `data_root_bind.rs`

---

## 1. Problem

Users need one portable **Obscur data folder** (profiles, SQLite, vault, exports) on any drive. Tauri always exposes an **install-scoped anchor** (AppData / Application Support / XDG data dir). Obscur must bind that anchor to the user-chosen physical tree without requiring every subsystem to know about relocation.

This is **not** a general-purpose migrator. We only bind Obscur's own anchor path.

---

## 2. Two paths

| Path | Role | User-visible? |
|------|------|----------------|
| **Anchor** | Tauri `app_data_dir()` — what the framework names | Shown as "App path" in Settings |
| **Physical root** | Where bytes live (`profiles/`, `obscur.sqlite3`, …) | Shown as "Data location" |

All durable reads/writes use **`resolve_effective_data_root()`** → physical root.

---

## 3. Bind modes (per OS)

| Mode | Windows | macOS / Linux | When used |
|------|---------|---------------|-----------|
| **redirect** | NTFS directory junction (`mklink /J`) | Directory symlink | Primary after user picks a folder |
| **pointer** | JSON in anchor (`obscur_data_root.json`) | Same | Fallback if redirect fails (permissions, open handles) |
| **appdata** | Anchor is the physical root | Same | Default before migration |

**Recovery backups** (heal if anchor deleted/recreated): registry (Windows), XDG config (Unix), `{PhysicalRoot}/obscur_data_root.pointer.json`, `{PhysicalRoot}/obscur.json`, env `OBSCUR_DATA_ROOT`, portable sidecar `obscur-data-root.path`.

---

## 4. User flow

1. **Settings → Storage → Reconnect / Change folder** — pick `{PhysicalRoot}`.
2. **Plan** — validate absolute path, writable, optional size/migrate.
3. **Copy** — if needed, merge into destination (existing tree allowed on reconnect).
4. **Bind** — install redirect at anchor, or pointer fallback.
5. **Manifest** — write/update `{PhysicalRoot}/obscur.json`.
6. **Restart** — required after bind change.

---

## 5. Heal on startup

If anchor exists but is empty/wrong and a recovery backup points at a valid physical root:

1. Recreate redirect at anchor (preferred).
2. Else restore pointer file in anchor.

Obscur must not silently create fresh data on C: when `{PhysicalRoot}` on E: still exists.

---

## 6. Invariants

- **One owner:** `data_root.rs` + `data_root_bind.rs` — no parallel vault `customRootPath` for durable data (v1.9.8 goal).
- **Physical manifest:** `obscur.json` always describes the physical root, not the anchor.
- **Import from anchor:** Only when anchor holds real files (not a redirect) and physical root differs.
- **Runtime/cache:** Tor logs, updater staging may stay under anchor or OS temp — not required to move with user data.

---

## 7. Failure modes (document, do not hide)

| Failure | Mitigation |
|---------|------------|
| Open file handles during bind | Quit Obscur; retry; pointer fallback |
| `mklink` / symlink needs elevation | Pointer fallback + UI message |
| User deletes anchor (junction/symlink) | Heal from registry/XDG/manifest on next launch |
| User deletes physical root | Data loss — export backup is the recovery path |

---

## 8. Non-goals

- Migrating Cursor, VS Code, or arbitrary `%AppData%` trees (Deco scope).
- Cloud sync of the data root.
- Bind without restart (future consideration).
