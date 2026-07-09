# Plan — Vault encryption sandbox (desktop native)

**Status:** Approved for phased delivery (2026-07-09)  
**Charter parent:** [v1.9.8-portable-storage-and-encryption-charter.md](../../docs/program/v1.9.8-portable-storage-and-encryption-charter.md)  
**Rollback checkpoint:** commit tagged in handoff before sandbox iterations  
**Band:** `VAULT-SANDBOX-1` — **ACTIVE** (replaces chat→vault save band, **DISABLED**)

---

## 1. Product intent

Obscur Vault becomes an **encryption sandbox**: media bytes under the user data root stay **ciphertext on disk** unless the user explicitly chooses **Export / Decrypt to disk**.

| User story | Requirement |
|------------|-------------|
| **Filesystem safety** | Opening `vault-media/` in Explorer shows opaque `.obscurvault` blobs — not executable scripts, not previewable images |
| **Client-only viewing** | Thumbnails, previews, and playback decrypt **inside Obscur** while the profile is unlocked |
| **Explicit export** | Plaintext leaves the sandbox only via labeled actions (Download, Save as…) with user-chosen path |
| **E2EE + local hardening** | Network E2EE limits relay surveillance; local sandbox limits **offline filesystem abuse** (stolen drive, USB copy, malicious “double-click” payloads) |
| **Honest limits** | Unlocked session (T8): memory/screen compromise is out of scope — document clearly |

**Non-goal for v1:** WASM/process-isolated viewer. v1 sandbox = **encrypt-on-disk + decrypt-in-client + no accidental plaintext paths**.

---

## 2. Current state (2026-07-09)

### What already works

| Layer | Implementation | Owner |
|-------|----------------|-------|
| PDK derivation | PBKDF2 → profile-scoped key material | `profile-data-key.ts` |
| Vault envelope | `obscur-storage-envelope-v1` AES-GCM, purpose `vault-media` | `storage-envelope-v1.ts`, `vault-at-rest.ts` |
| Opaque filenames | `{sha256(profileId\|url).slice(0,24)}.obscurvault` | `vault-at-rest.ts` |
| Encrypt on write (when PDK session present) | `encryptVaultBytesIfAvailable` in save/cache paths | `local-media-store.ts` |
| Decrypt for display | `decryptVaultFileBytesIfNeeded` → blob URL | `local-media-store.ts` → `resolveLocalMediaUrl` |
| SQLite at-rest (separate) | `.obscur-enc` sidecar while locked | `storage_at_rest.rs` |
| Secure Upload | `saveFileToLocalVault` | `vault-upload-modal.tsx` |
| Vault grid / preview UX | Grid, lightbox, mobile rail, open-in-folder | `vault-media-grid.tsx` |

### Gaps (why sandbox is not “done”)

| ID | Gap | Risk |
|----|-----|------|
| G1 | **Plaintext fallback** when PDK session missing at write | T1/T5 fail — readable files on disk |
| G2 | **Legacy corpus** — pre-v1.9.8 files with human filenames | Mixed security posture |
| G3 | **Index in localStorage** — filenames, URLs, sizes plaintext | Metadata leak (T1) |
| G4 | **Decrypt in main WebView** — blob URLs in renderer | T8 / script context — acceptable v1 limit, not true isolation |
| G5 | **Reveal in Explorer** can open ciphertext path | User confusion; not execution risk for `.obscurvault` |
| G6 | **Chat→vault save disabled** (`VAULT_SAVE_FROM_CHAT_ENABLED = false`) | Intake path is Upload + Download only until pipeline proven |
| G7 | **Shared `vault-media/` folder** across profiles | Isolation by hash + index only — charter target is `profiles/{id}/vault/` |
| G8 | **Phase 4 evidence incomplete** — no portable soak sign-off | Marketing “encryption guarantee” still blocked |

### Threat model extension (script injection)

| Scenario | Without sandbox | With sandbox (target) |
|----------|-----------------|------------------------|
| User downloads chat image to Desktop | OS may associate/execute disguised file | N/A if user uses Vault instead |
| Attacker copies `vault-media/` | May get `photo.jpg` + EXIF/scripts in polyglot | Only `.obscurvault` JSON/binary AEAD — **not a valid image/script for OS handlers** |
| User double-clicks vault file in Explorer | Preview app may parse malicious content | Envelope is not a recognized media type — **neutralized by default** |
| Obscur preview | Decrypt in memory | Same — user explicitly opened in trusted client |

---

## 3. Architecture — canonical owners

```text
┌─────────────────────────────────────────────────────────────┐
│  Vault UI (grid, lightbox, upload modal)                     │
└───────────────────────────┬─────────────────────────────────┘
                            │ read/write intents
┌───────────────────────────▼─────────────────────────────────┐
│  local-media-store.ts          ← SINGLE filesystem owner     │
│    saveFileToLocalVault / cacheAttachmentLocally             │
│    resolveLocalMediaUrl (decrypt → blob)                     │
│    downloadAttachmentToUserPath (explicit plaintext export)  │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  vault-at-rest.ts              ← envelope + opaque names     │
│  profile-storage-key-session   ← PDK in memory while unlock  │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  {dataRoot}/vault-media/*.obscurvault   ← ciphertext only    │
│  localStorage index (v1) → SQLite vault_index (v2 target)    │
└─────────────────────────────────────────────────────────────┘
```

**Subtraction rules**

- No parallel vault write paths (chat save stays off until G6 resolved with L3 proof).
- No UI-side encryption — all bytes pass through `local-media-store.ts`.
- Download / export is the **only** intentional plaintext exit; disable or gate `convertFileSrc` for encrypted paths (already: encrypted → blob, not file://).

---

## 4. Phased delivery

### Phase 0 — Rollback checkpoint (this plan)

- [x] Disable chat→vault save (`VAULT_SAVE_FROM_CHAT_ENABLED = false`)
- [x] Publish this plan
- [x] **Git commit** — rollback tag before sandbox iterations (`5c301ca6`)

**Proof:** `git log -1` records checkpoint; handoff links commit SHA.

---

### Phase 1 — Encrypt-on-write hardening (no new plaintext)

**Goal:** After unlock, every new vault byte is ciphertext; fail closed if PDK missing.

| Task | Detail |
|------|--------|
| 1.1 | Remove silent plaintext fallback in `encryptVaultBytesIfAvailable` callers — surface error/toast if PDK absent |
| 1.2 | `saveFileToLocalVault` / Secure Upload: refuse write when locked |
| 1.3 | Settings copy: “Vault files are encrypted on disk while locked” (only when 1.1–1.2 green) |
| 1.4 | Contract tests: write without PDK → rejected |

**Status (2026-07-09):** **Implemented** — `encryptVaultBytesForWrite`, `VaultWriteEncryptionRequiredError`, `vault-at-rest.test.ts`

**Owner:** `local-media-store.ts`, `vault-at-rest.ts`, `use-identity.ts` (unlock must establish PDK before vault writes)

**Proof**

| Layer | Command |
|-------|---------|
| L1 | `pnpm -C apps/pwa exec vitest run app/features/vault/services/local-media-store.test.ts app/features/storage/services/vault-at-rest.test.ts` |
| L2 | `pnpm verify:storage-encryption-v1.9.8` |
| L3 | Manual: upload while unlocked → only `.obscurvault` on disk; lock → Explorer shows opaque files |

---

### Phase 2 — Legacy plaintext migration

**Goal:** Existing `photo.jpg` etc. encrypted in place or re-written as `.obscurvault`.

| Task | Detail |
|------|--------|
| 2.1 | Scanner: list index entries where `relativePath` lacks `.obscurvault` |
| 2.2 | Migration job on unlock: read bytes → encrypt → write opaque name → update index → delete plaintext |
| 2.3 | Idempotent + resumable; log counts in diagnostics |
| 2.4 | Vault UI banner while migration pending |

**Status (2026-07-09):** **Implemented** — `vault-legacy-migration.ts`, unlock hook, Vault banner

**Owner:** new `vault-legacy-migration.ts` called from `local-media-store.ts` on unlock

**Proof:** L1 migration unit tests; L3 before/after USB copy — no plaintext media files.

---

### Phase 3 — Encrypted metadata index

**Goal:** Filenames and remote URLs not in plaintext localStorage.

| Task | Detail |
|------|--------|
| 3.1 | SQLite table `vault_media_index` inside encrypted DB (or dedicated encrypted JSON blob) |
| 3.2 | Read path: merge aggregator uses DB index; localStorage read deprecated |
| 3.3 | One-time import from localStorage on unlock |

**Status (2026-07-09):** **Implemented** — SCHEMA_V4, sqlite store + unlock import + in-memory cache

**Owner:** `local-media-store.ts` + `@dweb/db` schema migration

**Proof:** L1 aggregator tests; L3 lock → copy data root → no readable vault filenames in any JSON under root.

---

### Phase 4 — Controlled decrypt surface (export contract)

**Goal:** User understands every plaintext exit; sandbox policy documented.

| Task | Detail |
|------|--------|
| 4.1 | Rename UI: “Export decrypted copy…” vs internal “download” |
| 4.2 | `revealLocalMediaItemPath`: open **containing folder**, not file execute; copy explains ciphertext |
| 4.3 | Revoke blob URLs on preview close / lock (`URL.revokeObjectURL`) |
| 4.4 | Lock handler: zeroize in-memory decrypt caches |

**Owner:** `vault-media-grid.tsx`, `lightbox.tsx`, `local-media-store.ts`, lock pipeline

**Proof:** L3 manual script-injection checklist (§6).

**Status (2026-07-09):** **Implemented** — export labeling, folder-only reveal, `vault-media-blob-lifecycle.ts`, lock/refresh revoke

---

### Phase 5 — Layout alignment (charter Phase 2 completion)

**Goal:** `profiles/{profileId}/vault/` replaces flat `vault-media/` where feasible.

| Task | Detail |
|------|--------|
| 5.1 | `data_root.rs` creates per-profile vault dir |
| 5.2 | Migration moves blobs + updates manifest |
| 5.3 | Deprecate `customRootPath` vault split |

**Owner:** `data_root.rs`, `local-media-vault-path.ts`

**Proof:** L3 portable USB soak (charter Phase 4 checklist).

---

### Phase 6 — Chat→vault re-enable (optional, blocked on G6)

**Goal:** Only after Phases 1–4 green with L3 evidence.

| Task | Detail |
|------|--------|
| 6.1 | Investigation spec: profile scoping, URL shapes, index key parity |
| 6.2 | Flip `VAULT_SAVE_FROM_CHAT_ENABLED` only with chain proof |
| 6.3 | No success toast without aggregator row visible |

**Status:** **DISABLED** — do not schedule until maintainer unpause.

---

## 5. UX / demo guidance (until Phase 4 sign-off)

| Show in demos | Avoid |
|---------------|-------|
| Vault → **Secure Upload** | Chat → “Save to Vault” (hidden) |
| Encrypted preview inside Obscur | Claiming “malware-proof” |
| **Export** / Download to disk as explicit user action | Explorer double-click on vault files as workflow |
| LOCAL badge on uploaded items | Chat→vault intake |

---

## 6. Manual verification — script injection checklist (L3)

1. Upload `.jpg` / `.mp4` via Secure Upload while unlocked.
2. Open data root in Explorer — confirm **only** `.obscurvault` (no `photo.jpg`).
3. Double-click `.obscurvault` — OS does **not** open image/video player with content.
4. Open same item in Obscur Vault preview — renders correctly.
5. Export decrypted copy to Desktop — plaintext appears **only** at chosen path.
6. Lock app — blob URLs dead; SQLite sidecar encrypted.
7. Copy data root to USB — second machine without password cannot view media bytes.

---

## 7. Proof matrix (summary)

| Phase | L1 (unit) | L2 (contract) | L3 (manual desktop) | L4 (portable / two-device) |
|-------|-----------|---------------|---------------------|----------------------------|
| 0 checkpoint | — | — | — | — |
| 1 hardening | local-media-store, vault-at-rest | `verify:storage-encryption-v1.9.8` | encrypt-only writes | — |
| 2 migration | migration module tests | — | no plaintext corpus | — |
| 3 metadata | aggregator + index tests | — | no LS metadata leak | — |
| 4 export | lock/revoke tests | — | §6 checklist | — |
| 5 layout | data_root tests | — | — | charter Phase 4 soak |
| 6 chat save | save-chat-attachment tests | — | vault row appears | — |

---

## 8. Non-goals

- Cloud sync of vault blobs
- Per-file content keys (KW wrap) — defer until performance study; PDK-direct envelope sufficient for v1 sandbox
- Separate native viewer process / WASM sandbox
- Re-enabling chat→vault before Phase 1–4
- Protection against unlocked-session malware beyond lock discipline (T8)

---

## 9. Exit criterion — “encryption sandbox” claim

All must pass on **desktop native**, user data on **non-default path**:

1. Zero plaintext media files under vault after migration (Phase 2)
2. New writes always ciphertext when profile unlocked (Phase 1)
3. Metadata not readable from localStorage alone (Phase 3)
4. §6 manual checklist signed
5. Charter Phase 4 portable soak (Phase 5)

Until then, product copy:

> **“Vault stores media encrypted on disk. Previews work inside Obscur. Export creates a decrypted copy at your chosen location.”**

Do **not** claim process isolation or malware immunity — only **filesystem-neutralized ciphertext by default**.

---

## 10. References

| Topic | Path |
|-------|------|
| Charter | `docs/program/v1.9.8-portable-storage-and-encryption-charter.md` |
| Vault owner | `apps/pwa/app/features/vault/services/local-media-store.ts` |
| Envelope | `apps/pwa/app/features/storage/services/vault-at-rest.ts` |
| Aggregator | `apps/pwa/app/features/vault/services/vault-media-aggregator.ts` |
| Chat save (disabled) | `apps/pwa/app/features/vault/services/save-chat-attachment-to-vault.ts` |
| Verification matrix | `docs/releases/core-verification-media-and-vault-durability.md` |
| Data root | `apps/desktop/src-tauri/src/data_root.rs` |
