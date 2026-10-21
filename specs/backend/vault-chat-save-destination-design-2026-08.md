# Design — Chat attachment save destinations (Vault vs folder) (2026-08-20)

**Status:** Design · implement this slice  
**Parents:** [vault-chat-save-destination-investigation-2026-08.md](./vault-chat-save-destination-investigation-2026-08.md)

## Goal

From any chat attachment (image / video / audio / file / voice note), user can choose:

1. **Save to Vault** — encrypted LES catalog (existing).
2. **Download to folder…** — OS save dialog → plaintext bytes at chosen path (reuse `downloadAttachmentToUserPath`).

Vault empty state must describe encrypted storage and how items arrive (not “automatic chat sync”).

## Non-goals

- Auto-ingest every chat attachment into LES.
- Change LES encryption / commit proof path.
- New Settings download-root UX (optional later; dialog already uses `downloadRootPath` default when set).

## Contract

### Attachment context menu (canonical chat entry)

Order:

1. Save to Vault (desktop / LES available only) — existing
2. Download to folder… — **new** (always when native or browser download fallback)
3. Copy URL
4. Open in new tab

Download:

- Call `downloadAttachmentToUserPath({ attachment })`.
- Toast success: `vault.exportDecryptedCopySuccess` (or dedicated key).
- Toast failure: existing save-failed style.
- Risky filename: soft confirm via `requiresAttachmentExportConfirm` with structural filename signals (`isPeerAccepted: true` when peer context absent).

### Empty state copy

- Title: keep `vault.empty`.
- Desc: Vault is your **encrypted local catalog**. Add files with **Secure Upload**, or **Save to Vault** from a chat attachment. Chat media does not appear until you save it.

### Recording beat (Segment G)

1. Open Vault → show empty + encrypted copy.
2. From DM: right-click / long-press media → Save to Vault → Refresh → tile appears.
3. Same attachment → Download to folder… → pick Desktop path → open file outside Obscur.
4. Optional: Secure Upload a local file.

## Proof

| Layer | Command / action |
|-------|------------------|
| L1 | `vitest` attachment-context-menu (+ download mock) |
| L3 | Packaged: Save to Vault populates grid; Download writes chosen path |

## i18n

- `en.json` (+ en chunks): `vault.emptyDesc`, `vault.downloadToFolder`, success toast reuse.
- zh/es best-effort if keys mirrored; EN is recording source of truth.
