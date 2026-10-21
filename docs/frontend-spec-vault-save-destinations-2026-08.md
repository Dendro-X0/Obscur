# Frontend note — Vault save destinations (Segment G)

Companion to `specs/backend/vault-chat-save-destination-design-2026-08.md`.

## Surfaces

| Action | Where |
|--------|--------|
| Save to encrypted Vault | Attachment context menu · lightbox · image/video quick save |
| Download to folder… | Attachment context menu (new) · lightbox export |
| Secure Upload | Vault page header |

## Empty state

Honest copy: encrypted local catalog; Secure Upload or Save to Vault; no automatic chat ingest.

## Recording beat

1. Vault empty → read empty copy (encrypted).
2. From DM attachment menu: Save to Vault → Refresh → tile.
3. Same/other file: Download to folder… → pick path → open outside Obscur.
4. Optional Secure Upload of a local file.
