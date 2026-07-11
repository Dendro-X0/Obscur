# v2.0.0 GIF inventory

**Purpose:** M5-2 evidence map — link visual assets to [demo script](./README.md) segments  
**Last audited:** 2026-07-10  
**Capture policy:** Maintainer-owned refresh using **v1.9.10 desktop** (static shell rebuild before record). **Video:** not in scope.

**Group suite runbook:** [group-chat-gif-shot-list.md](./group-chat-gif-shot-list.md)

---

## Library status (2026-07-10)

| Track | On disk | Status |
|-------|---------|--------|
| **Legacy six-pack** (Apr 2026) | 0 | **Removed** — refs updated to v1.9.10 filenames |
| **July captures** | 18 | Renamed `*.gif.gif` → `*.gif` |
| **Group suite G2–G5** | 4 | Captured |
| **Settings panel refresh** | 0 | **Pending** → `settings_panel_1.gif` |
| **Contacts / media / voice** | 0 | **Pending** — see gap table below |

**Raw path:** `docs/assets/gifs/<filename>`

---

## Captured (ready)

| File | Script § | Website card | Notes |
|------|----------|--------------|-------|
| `auth_unlock_1.gif` | §2 Unlock | Auth | Primary unlock path |
| `auth_create_1.gif` | §2 Create | — | Optional README embed |
| `auth_unlock_2.gif` | §2 Unlock alt | — | Spare take |
| `e2e-dm-base_1.gif` | §3 DM | Direct Messaging | Replaces `obscur_chat_ui_1.gif` |
| `search_message_history_1.gif` | §3 polish | Message Search | Search + jump in thread |
| `emoji_icons_1.gif` | §3 polish | — | Composer emoji picker |
| `relay_overview_1.gif` | §4 Relays | Relays And Settings | Relay list / overview |
| `relay_enable_disable_1.gif` | §4 Relays | — | Toggle relay |
| `export_local_profile_1.gif` | §5 Multi-profile | Multi-Profile | Export flow |
| `Import_local_profile_and_sync_account_data_1.gif` | §5 | — | Import + sync |
| `delete_profile_window_isolation_1.gif` | §5 | — | Window isolation |
| `group_create_managed_workspace_1.gif` | §6 Group | — | G2 |
| `group_invite_member_1.gif` | §6 Group | — | G3 |
| `community_group_send_receive_1.gif` | §6 Group | Communities | G4 P0 proof |
| `group_participants_settings_1.gif` | §6 Group | — | G5 |

---

## Gap — still to record

| Priority | Topic | Target filename | Script beat | Capture notes |
|----------|-------|-----------------|-------------|---------------|
| **P1** | Settings panel | `settings_panel_1.gif` | §4 | Settings nav, security, profile prefs — **not** relay-only |
| **P1** | Add contact | `add_contact_1.gif` | §3 / Network | Network → add by pubkey or QR · open DM |
| **P1** | Media upload | `multimedia_files_upload_and_transfer_1.gif` | §7 | Attach image/file in DM · progress · render |
| **P1** | Voice notes | `voice_notes_1.gif` | §7 | Hold-to-record · send · playback bubble |
| **P1** | Voice calls | `voice_calls_1.gif` | §7 | Start call · ringing · join/accept UI (split from old combined GIF) |
| P2 | Relay setup (group context) | `group_relay_setup_1.gif` | §6 G1 | Optional if relay GIFs insufficient for group reel |

**Suggested record order:** settings panel → add contact → voice notes → voice calls → media upload (media last — largest files).

---

## Pre-capture checklist (every session)

```bash
# Terminal 1
pnpm dev:coordination

# Terminal 2 (group / relay demos)
pnpm dev:relay:docker

# Terminal 3 — MUST rebuild after UI edits
pnpm dev:desktop:no-coord -- --rebuild
```

| Check | Command / action |
|-------|------------------|
| Shell not stale | No `[desktop-static] STALE` error; dev badge shows `shell-…` stamp |
| Coordination | `curl http://127.0.0.1:8787/health` |
| Relay | `curl http://127.0.0.1:7000` |
| Probe (optional) | `node scripts/demo-gif-readiness-probe.mjs` |

**Do not use `--skip-build`** after editing `apps/pwa/` — static shell serves `out/`.

---

## Capture recipe

| Tool | Role |
|------|------|
| **ShareX** / **ScreenToGif** | Direct GIF export |
| Windows Xbox Game Bar | Record clip → trim → GIF |

1. **Resolution:** 1280×720 · **Duration:** 8–15 s · **Size:** ≤30 MB when possible  
2. **Naming:** `<topic>_1.gif` under `docs/assets/gifs/`  
3. **Register:** Update this table · README § Feature GIF Previews · `site-content.ts` when ready  
4. **Evidence stills:** `docs/assets/demo/v2.0.0/evidence/P5-<topic>-<date>.png`

---

## Phase 5 task status

| ID | Status | Notes |
|----|--------|-------|
| M5-1 Demo script | **Draft** | [README.md](./README.md) |
| M5-2 Evidence | **In progress** | 18 on disk · 5 gaps (settings, contacts, media, voice×2) |
| M5-3 Website embed | **Blocked** | Phase 4 Vercel deploy PAUSED |
| M5-4 Limitations link | **Done in script** | ACC-02 for group roster |

**EXIT gate:** Maintainer cold run per [presenter-checklist.md](./presenter-checklist.md).
