# Vault encryption sandbox — L3/L4 verification runbook

**Band:** `VAULT-SANDBOX-1`  
**Parent plan:** [vault-encryption-sandbox-plan-2026-07.md](./vault-encryption-sandbox-plan-2026-07.md)  
**Charter:** [v1.9.8-portable-storage-and-encryption-charter.md](../../docs/program/v1.9.8-portable-storage-and-encryption-charter.md)  
**Status:** Ready for maintainer sign-off (Phases 1–5 implemented · `a04c747d`)

---

## 1. Scope

Manual evidence required before claiming **“Vault stores media encrypted on disk”** in product copy or demos.

| Layer | What it proves |
|-------|----------------|
| **L1** | Unit/contract tests (agent-run before handoff) |
| **L3** | Desktop native script-injection + export contract (this doc §3) |
| **L4** | Portable USB / two-folder soak (this doc §4) |

**Out of scope:** Phase 6 chat→vault (DISABLED). Unlocked-session malware (T8).

---

## 2. Prerequisites

- **Surface:** Tauri desktop build (not PWA browser dev).
- **Data root:** Non-default path recommended (junction or custom folder).
- **Profile:** Unlocked once for upload/preview steps; lock used for step 6.
- **Demo path:** Secure Upload only — not chat→vault.

### L1 gate (run first)

```bash
pnpm -C apps/pwa exec vitest run \
  app/features/storage/services/vault-at-rest.test.ts \
  app/features/vault/services/local-media-store.test.ts \
  app/features/vault/services/local-media-vault-path.test.ts \
  app/features/vault/services/vault-layout-migration.test.ts \
  app/features/vault/services/vault-legacy-migration.test.ts \
  app/features/vault/services/vault-media-blob-lifecycle.test.ts \
  app/features/vault/components/vault-media-grid.test.tsx

pnpm verify:storage-encryption-v1.9.8
```

Optional broader storage resilience:

```bash
pnpm verify:storage-resilience-v1.9.9
```

---

## 3. L3 — Script injection checklist (desktop)

Record: date, profile id, data root path, Obscur version/commit, pass/fail per row.

| # | Step | Expected | Pass |
|---|------|----------|------|
| 1 | Unlock profile. **Vault → Secure Upload** a `.jpg` and `.mp4`. | Success toast; items appear in Vault grid with LOCAL badge. | ☐ |
| 2 | Open data root in Explorer. Inspect vault area. | Under `profiles/{profileId}/vault/` only **`.obscurvault`** blobs. No `photo.jpg` / `clip.mp4` plaintext. Legacy `vault-media/` empty or absent after layout migration. | ☐ |
| 3 | Double-click a `.obscurvault` file in Explorer. | OS does **not** open image/video player with decrypted content. | ☐ |
| 4 | Open the same items in **Obscur Vault preview**. | Image/video render inside app. | ☐ |
| 5 | **Export decrypted copy…** to Desktop (explicit path). | Plaintext exists **only** at chosen export path. Vault folder still ciphertext-only. | ☐ |
| 6 | **Lock** app. Re-open Vault preview URL / refresh grid (if accessible). | Blob previews dead; unlock required. SQLite sidecar `.obscur-enc` present while locked. | ☐ |
| 7 | Copy entire data root to USB (or second folder). On another machine **without** password, browse copied tree. | No readable media bytes; index/metadata not usable without unlock. | ☐ |

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
   - Preview works after unlock
   - Export still works
5. Lock on target; confirm at-rest audit still passes (step 6 above).

| Field | Value |
|-------|--------|
| Source path | |
| Target path / machine | |
| Profiles tested | |
| Pass/fail | |

---

## 5. Sign-off

| Role | Name | Date | L3 | L4 |
|------|------|------|----|----|
| Maintainer | | | ☐ | ☐ |

When both are checked, update plan gap **G8** and product copy per plan §9.

---

## 6. Rollback ladder

| SHA | Milestone |
|-----|-----------|
| `5c301ca6` | Checkpoint (chat→vault disabled) |
| `2a6dabea` | Phase 1 encrypt-on-write |
| `5483b9e4` | Phase 2 legacy plaintext migration |
| `6acd1086` | Phase 3 SQLite metadata index |
| `d0533def` | Phase 4 export contract + blob revoke |
| `a04c747d` | Phase 5 `profiles/{id}/vault/` layout |

---

## 7. Known gaps (not blocking L3)

| Item | Notes |
|------|--------|
| `app-overlay-layer.tsx` | Required for Vault fullscreen preview portal; commit with shell wiring if missing from checkout. |
| Phase 6 chat→vault | DISABLED until investigation + maintainer unpause. |
| Marketing “encryption guarantee” | Blocked until §5 sign-off. |
