# v2.0.0 GIF inventory

**Purpose:** M5-2 evidence map — link visual assets to [demo script](./README.md) segments  
**Last audited:** 2026-07-17  
**Capture policy:** Maintainer-owned refresh on desktop (static shell rebuild before record).  
**Web policy:** Archive GIFs stay in `docs/assets/gifs/`; site embeds use `docs/assets/gifs/web/*.mp4` via [compress-demo-gifs.mjs](../../../scripts/compress-demo-gifs.mjs).  
**Charter:** [website-user-guide-charter-2026-07.md](../../../specs/backend/website-user-guide-charter-2026-07.md)

---

## Library status (2026-07-17)

| Track | On disk | Status |
|-------|---------|--------|
| **Archive captures** | **22** | Double `*.gif.gif` renamed → `*.gif` |
| **Contacts / media / voice** | Captured | `accept_*`, `send_*`, `multimedia_*`, `send_voice_note_*`, `start_a_voice_call_*`, `preview_files_*` |
| **Web compress** | **22 / 22** | MP4 total **7.81 MB** (was 208 MB archive) — all ≤1.0 MB |
| **Archive total size** | **~208 MB** | Keep for capture truth; do not embed on site |

**Raw path:** `docs/assets/gifs/<filename>`  
**Web path:** `docs/assets/gifs/web/<stem>.mp4` (+ optional `.poster.webp`)

```bash
node scripts/compress-demo-gifs.mjs --report
node scripts/compress-demo-gifs.mjs --all   # needs ffmpeg or pnpm add -Dw ffmpeg-static
```

---

## Captured (archive)

| File | Guide section | Website card | ~MB |
|------|---------------|--------------|-----|
| `auth_unlock_1.gif` | Unlock | Auth | 3.3 |
| `auth_unlock_2.gif` | Unlock alt | — | 2.6 |
| `auth_create_1.gif` | Create | — | 30.1 |
| `e2e-dm-base_1.gif` | DM | Direct Messaging | 1.6 |
| `search_message_history_1.gif` | DM polish | Message Search | 1.3 |
| `emoji_icons_1.gif` | DM polish | — | 1.1 |
| `relay_overview_1.gif` | Relays | Relays And Settings | 12.6 |
| `relay_enable_disable_1.gif` | Relays | — | 13.5 |
| `settings_panel_1.gif` | Settings | Relays And Settings | 16.3 |
| `export_local_profile_1.gif` | Profiles | Multi-Profile | 9.3 |
| `Import_local_profile_and_sync_account_data_1.gif` | Profiles | — | 29.0 |
| `delete_profile_window_isolation_1.gif` | Profiles | — | 8.7 |
| `group_create_managed_workspace_1.gif` | Groups | — | 0.6 |
| `group_invite_member_1.gif` | Groups | — | 3.1 |
| `community_group_send_receive_1.gif` | Groups | Communities | 0.7 |
| `group_participants_settings_1.gif` | Groups | — | 1.8 |
| `send_a_contact_request_1.gif` | Contacts | — | 2.3 |
| `accept_a_contact_request_1.gif` | Contacts | — | 1.4 |
| `multimedia_files_upload_and_transfer_1.gif` | Media | — | 20.2 |
| `preview_files_1.gif` | Media preview | — | **45.3** |
| `send_voice_note_1.gif` | Voice notes | — | 1.1 |
| `start_a_voice_call_1.gif` | Voice calls | — | 1.9 |

---

## Compression priority (largest first)

1. `preview_files_1.gif` (45 MB)  
2. `auth_create_1.gif` (30 MB)  
3. `Import_local_profile_and_sync_account_data_1.gif` (29 MB)  
4. `multimedia_files_upload_and_transfer_1.gif` (20 MB)  
5. `settings_panel_1.gif` / relay GIFs (12–16 MB)

Homepage feature cards use **web MP4** (`/guide-media/*.mp4`) with “Open in guide” links. Full library embeds on `/guide` (9 sections · all 22 stems).

---

## Phase 5 / website task status

| ID | Status | Notes |
|----|--------|-------|
| M5-1 Demo script | Draft | [README.md](./README.md) |
| M5-2 Evidence | **22 on disk** | Inventory refreshed 2026-07-17 |
| M5-3 Website embed | **Landing + guide wired** | 10 landing MP4 cards · `/guide` stacks all 22 demos |
| M5-4 Limitations | Done in script | ACC-02 for group roster |

**EXIT for guide MVP:** web MP4s under budget · `/guide` build smoke · nav Guide link.

---

## Pre-capture checklist (every session)

```bash
pnpm dev:coordination
pnpm dev:relay:docker   # when needed
pnpm dev:desktop:no-coord -- --rebuild
```

| Check | Command / action |
|-------|------------------|
| Shell not stale | No `[desktop-static] STALE`; rebuild after UI edits |
| Naming | `<topic>_1.gif` — never `*.gif.gif` |
| After capture | `node scripts/compress-demo-gifs.mjs --only <file.gif>` |

---

## Capture recipe

| Tool | Role |
|------|------|
| **ShareX** / **ScreenToGif** | Direct GIF export |
| Windows Xbox Game Bar | Record clip → trim → GIF |

1. **Resolution:** 1280×720 · **Duration:** 8–15 s · **Archive size:** ≤30 MB when possible  
2. **Naming:** `<topic>_1.gif` under `docs/assets/gifs/`  
3. **Web:** run compress script before site embed  
4. **Register:** Update this table · site-content / guide sections
