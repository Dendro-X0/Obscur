# v2.0.0 GIF inventory

**Purpose:** M5-2 evidence map — link visual assets to [demo script](./README.md) segments  
**Last audited:** 2026-07-04  
**Capture policy (2026-07-04):** Maintainer-owned refresh using **installed production build** (v1.9.10 NSIS). Current library is **v1.3.15-era** (~months old) — do not use for v2.0.0 trust demos without re-capture. **Video:** not planned (no AI editing pipeline). **Agent capture:** deferred until maintainer completes production install GIF pass.

---

## Canonical library (`docs/assets/gifs/`)

| File | Size | Captured | Script segment | Website feature card | Freshness |
|------|------|----------|----------------|----------------------|-----------|
| `obscur_login_1.gif` | ~10 MB | 2026-04-04 | §2 Unlock | Auth And Onboarding | **Replace** — v1.3.15-era UI |
| `obscur_chat_ui_1.gif` | ~7.6 MB | 2026-04-04 | §3 DM | Direct Messaging | **Replace** |
| `obscur_settings_panel_1.gif` | ~17 MB | 2026-04-04 | §4 Settings | Settings And Profiles | **Replace** |
| `multi_profile_management_1.gif` | ~28 MB | 2026-04-11 | §5 Multi-profile | Multi-Profile Workflows | **Replace** |
| `multimedia_files_upload_and_transfer_1.gif` | ~11 MB | 2026-04-10 | §7 Media | Media Transfer | **Replace** |
| `voice_notes_and_calls_1.gif` | ~5.9 MB | 2026-04-10 | §7 Voice | Voice Notes And Calls | **Replace** |

**Raw paths:** `docs/assets/gifs/<filename>`  
**Website URLs:** `site-content.ts` → `raw.githubusercontent.com/.../docs/assets/gifs/...`

All six files **exist on disk** and still power the Phase 4 website gallery — but they reflect **v1.3.15-era** chrome, not v1.9.10. For v2.0.0 demos use **live installed build**; refresh GIFs on maintainer schedule (see § Capture recipe).

**Maintainer deferral (2026-07-04):** GIF re-capture blocked on production install + manual screen recording. Video (long-form) not in scope. Phase 5 script/checklist remain valid for **live** cold runs without refreshed GIFs.

---

## Missing captures (recommended for M5-2 refresh)

| Priority | Proposed filename | Script segment | Capture notes |
|----------|-------------------|----------------|---------------|
| **P0** | `community_group_send_receive_1.gif` | §6 Group | Dual-window · managed workspace · send `demo-<ts>` · both threads · no room-key chrome |
| **P1** | `cold_restart_unlock_1.gif` | §2 Unlock | `taskkill obscur_desktop_app.exe` → relaunch → password unlock (R2 path) |
| **P1** | `download_checksum_verify_1.gif` | §1 Install | Website `/download` or manifest · copy SHA · optional SmartScreen |
| **P2** | `coordination_relay_settings_1.gif` | §4 Settings | Coordination preferred + local relay connected |
| **P2** | `participants_roster_honest_1.gif` | §6 Group | Show Participants with **ACC-02 disclaimer** voiceover — not “fixed” |

**Communities GIF** called out in root [README.md](../../../../README.md) as next asset to add.

---

## Legacy demo folders (reference only)

| Folder | Relevance to v2.0.0 |
|--------|---------------------|
| `docs/assets/demo/v1.9.0/` | K-M matrix + runbook — still valid for coordination leave scenarios |
| `docs/assets/demo/v1.3.8/` | GIF shot list template · runtime evidence JSON |
| `docs/assets/demo/v1.2.x/` | M10 storyboard — historical |

Do not mix v1.2/v1.3 captures into v2.0.0 script without re-labeling freshness.

---

## Capture recipe (new GIF — maintainer)

**When:** After v1.9.10 NSIS installed from `release-assets/` (verify SHA first). No dev server required.

**Tools (no AI, no edit suite required):**

| Tool | Role |
|------|------|
| Windows **Xbox Game Bar** (`Win+Alt+R`) | Record short clip → trim in Photos or ShareX |
| **ShareX** / **ScreenToGif** | Direct GIF export from screen region |
| **OBS** (optional) | Record only — export GIF via ShareX if needed; full video edit **not required** |

**Steps:**

1. **Resolution:** 1280×720 or native window · 8–15 s loop · ≤30 MB if possible  
2. **Naming:** `<topic>_<variant>_1.gif` under `docs/assets/gifs/` (overwrite v1.3.15-era file or suffix `_v1910`)  
3. **Record:** Scenario setup → user action → on-screen outcome (see [v1.3.0 gif-shot-list.md](../v1.3.0/gif-shot-list.md))  
4. **Register:** Add row to this table · update `apps/website/src/app/site-content.ts` when ready for website embed  
5. **Proof:** Optional PNG still → `docs/assets/demo/v2.0.0/evidence/`

**Priority order when you capture:** P0 community group → login/unlock → DM → settings → multi-profile → media/voice (see § Missing captures).

---

## Phase 5 task status

| ID | Status | Notes |
|----|--------|-------|
| M5-1 Demo script | **Draft** | [README.md](./README.md) |
| M5-2 Evidence | **Partial** | 6 GIFs · 0 v2.0.0-specific · P0 gap: community |
| M5-3 Website embed | **Blocked** | Phase 4 Vercel deploy PAUSED · gallery code ready |
| M5-4 Limitations link | **Done in script** | Points to canonical limitations sheet |

**EXIT gate:** Maintainer cold run per [presenter-checklist.md](./presenter-checklist.md) — not automated CI.
