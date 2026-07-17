# Vault encryption sandbox — L3/L4 verification runbook (G8)

**Band:** `VAULT-SANDBOX-1`  
**Parent plan:** [vault-encryption-sandbox-plan-2026-07.md](./vault-encryption-sandbox-plan-2026-07.md)  
**Scope release:** [v1.9.13-scope.md](../../docs/program/v1.9.13-scope.md)  
**Taxonomy design:** [vault-profile-directory-taxonomy-design-2026-07.md](./vault-profile-directory-taxonomy-design-2026-07.md)  
**Charter:** [v1.9.8-portable-storage-and-encryption-charter.md](../../docs/program/v1.9.8-portable-storage-and-encryption-charter.md)  
**Status:** Ready for maintainer G8 soak — Phases 1–5 + **5b taxonomy** (L1 green) · chat→vault still **DISABLED**

---

## 1. Scope

Manual evidence required before claiming **“Vault stores media encrypted on disk”** in product copy or demos, and before **Phase 6b** (`VAULT_SAVE_FROM_CHAT_ENABLED` flip).

| Layer | What it proves |
|-------|----------------|
| **L1** | Unit/contract tests (agent-run before handoff) — includes category path + migration list |
| **L3** | Desktop native Secure Upload + category dirs + export + lock (this doc §3) |
| **L3-MP** | Two-profile isolation — no cross-profile objects (this doc §3.1) |
| **L4** | Portable USB / reconnect-folder soak with category trees (this doc §4) |

**Out of scope this soak:** Phase 6 chat→vault (flag false). Unlocked-session malware (T8). Community band.

### Expected on-disk taxonomy (Phase 5b)

```text
{dataRoot}/
  profiles/{profileId}/vault/
    images/{24hex}.obscurvault
    videos/{24hex}.obscurvault
    audio/{24hex}.obscurvault
    files/{24hex}.obscurvault
  vault-media/                    ← legacy; empty or absent after migration
```

| Kind uploaded | Subdir |
|---------------|--------|
| `.jpg` / image | `images/` |
| `.mp4` / video | `videos/` |
| audio / voice note | `audio/` |
| pdf / other | `files/` |

Filenames remain **opaque** `{24hex}.obscurvault` — categories organize only; display names live in the encrypted index, not on disk.

---

## 2. Prerequisites

- **Surface:** Tauri desktop build (not PWA browser). Prefer a build that includes taxonomy L1 (post–1.9.12 vault track / 1.9.13 WIP).
- **Data root:** Non-default path recommended (junction or custom folder).
- **Profiles:** At least **one** unlocked profile for §3; **two** profiles for §3.1.
- **Demo path:** **Secure Upload only** — do not use chat→vault.
- **Stop desktop** before L2 encryption verify if the gate complains about exe lock.

### L1 gate (run first)

```bash
pnpm verify:vault-sandbox-l1
pnpm verify:storage-encryption-v1.9.8
```

After Secure Upload (§3 steps 1–2), optionally probe the data root without unlock:

```bash
pnpm vault:g8-disk-probe -- "D:\\path\\to\\data-root"
pnpm vault:g8-disk-probe -- "D:\\path\\to\\data-root" --profile <profileId>
```

Optional broader storage resilience:

```bash
pnpm verify:storage-resilience-v1.9.9
```

Record: L1 pass/fail, commit SHA, build stamp / version.

---

## 3. L3 — Script injection checklist (desktop)

Record: date, **profile id(s)**, data root path, Obscur version/commit, pass/fail per row.

| # | Step | Expected | Pass |
|---|------|----------|------|
| 1 | Unlock profile **A**. **Vault → Secure Upload** a `.jpg` and a `.mp4`. | Success toast; items appear in Vault grid with LOCAL badge. | ☐ |
| 2 | Open data root in Explorer. Inspect vault area for **A**. | New blobs under `profiles/{A}/vault/images/` and `profiles/{A}/vault/videos/` respectively — only **`.obscurvault`**. No `photo.jpg` / `clip.mp4` plaintext at vault root or elsewhere. Legacy `vault-media/` empty or absent. Flat leftovers under `profiles/{A}/vault/*.obscurvault` may exist only until unlock migration finishes; after unlock/migration they should move into category dirs. | ☐ |
| 3 | Double-click a `.obscurvault` file in Explorer. | OS does **not** open image/video player with decrypted content. | ☐ |
| 4 | Open the same items in **Obscur Vault preview**. | Image/video render inside app. | ☐ |
| 5 | **Export decrypted copy…** to Desktop (explicit path). | Plaintext exists **only** at chosen export path. Vault category folders still ciphertext-only. | ☐ |
| 6 | **Lock** app. Re-open Vault preview URL / refresh grid (if accessible). | Blob previews dead; unlock required. SQLite sidecar `.obscur-enc` present while locked. | ☐ |
| 7 | Copy entire data root to USB (or second folder). On another machine **without** password, browse copied tree. | No readable media bytes; category dirs still only `.obscurvault`; index/metadata not usable without unlock. | ☐ |

### 3.1 L3-MP — Multi-profile object isolation

Use **two** profiles on the same data root (or sequential unlock on one install).

| # | Step | Expected | Pass |
|---|------|----------|------|
| M1 | Profile **A**: Secure Upload one unique image. Note path under `profiles/{A}/vault/images/`. | Blob exists only under **A**. | ☐ |
| M2 | Switch to profile **B** (lock/unlock as required). Open Vault grid. | Grid shows **B-only** items (or empty). **No** A’s LOCAL rows. No stale preview of A’s image. | ☐ |
| M3 | Profile **B**: Secure Upload a different file (e.g. video or pdf). | Lands under `profiles/{B}/vault/videos/` or `…/files/` — **not** under `profiles/{A}/…`. | ☐ |
| M4 | Switch back to **A**. | A’s grid restores A’s items; B’s blobs absent from A’s UI. Explorer still shows separate trees. | ☐ |

### UX copy checks (Phase 4)

| UI | Expected label |
|----|----------------|
| Vault export action | **Export decrypted copy…** |
| Open folder (encrypted) | **Open vault folder** (parent dir, not file execute) |

---

## 4. L4 — Portable soak (charter)

Adapted from [v1.9.8 Phase 4 checklist](../../docs/archive/program/inactive-2026-06/v1.9.8-phase-4-manual-checklist.md).

1. Quit Obscur completely.
2. Copy entire data root to USB or second directory.
3. On target: install Obscur → **Settings → Storage → Reconnect folder** → select copied root → restart.
4. Unlock profile(s); verify:
   - DM history loads
   - Vault grid shows uploaded items
   - Category trees still present under each `profiles/{id}/vault/{images\|videos\|audio\|files}/`
   - Preview works after unlock
   - Export still works
5. If two profiles were used in §3.1: unlock each and confirm isolation still holds after reconnect.
6. Lock on target; confirm at-rest expectations still pass (§3 step 6).

| Field | Value |
|-------|--------|
| Source path | |
| Target path / machine | |
| Profiles tested | |
| Category dirs observed | ☐ images ☐ videos ☐ audio ☐ files (as applicable) |
| Pass/fail | |

---

## 5. Sign-off (closes G8)

| Role | Name | Date | L3 | L3-MP | L4 |
|------|------|------|----|-------|----|
| Maintainer | | | ☐ | ☐ | ☐ |

When **L3 + L3-MP + L4** are checked:

1. Mark gap **G8** closed in [vault-encryption-sandbox-plan-2026-07.md](./vault-encryption-sandbox-plan-2026-07.md).
2. Product copy may claim vault-at-rest encryption per plan §9.
3. **Phase 6b** chat→vault flag may flip only after this sign-off **and** the Phase 6 L3 chat-save chain in [vault-chat-save-phase6-design-2026-07.md](./vault-chat-save-phase6-design-2026-07.md).

---

## 6. Rollback ladder

| SHA / milestone | Note |
|-----------------|------|
| `5c301ca6` | Checkpoint (chat→vault disabled) |
| `2a6dabea` | Phase 1 encrypt-on-write |
| `5483b9e4` | Phase 2 legacy plaintext migration |
| `6acd1086` | Phase 3 SQLite metadata index |
| `d0533def` | Phase 4 export contract + blob revoke |
| `a04c747d` | Phase 5 `profiles/{id}/vault/` layout |
| **1.9.13 Phase 5b** | Category subdirs + multiprofile path gate — see taxonomy design |

---

## 7. Known gaps (not blocking L3 sandbox claim)

| Item | Notes |
|------|-------|
| `app-overlay-layer.tsx` | Required for Vault fullscreen preview portal; commit with shell wiring if missing from checkout. |
| Phase 6 chat→vault | Flag **false** until G8 §5 + Phase 6 chat-save L3. |
| Flat Phase-5 blobs | Acceptable briefly until unlock migration; §3 step 2 expects post-migration category placement. |
| Marketing “encryption guarantee” | Blocked until §5 sign-off. |
