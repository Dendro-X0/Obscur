# Investigation — Vault empty after Segment F media DMs (2026-08-20)

**Status:** Investigation complete → design  
**Surface:** Packaged desktop · LES Vault page

## Operator evidence

- Vault page (DemoUser): empty state — “Shared images and videos from your chats will appear here automatically.”
- Segment F already showed DM image/audio/video transfer between A/B.
- Header correctly labels LES as encrypted local catalog.

## Root cause (copy vs mechanism)

| Path | What it does | Fills Vault grid? |
|------|----------------|-------------------|
| Chat CDN upload + DM | Message attachment URLs | **No** (unless saved) |
| Auto local-media cache (sent) | Optional disk cache for playback | **Not** LES catalog |
| Context menu / lightbox **Save to Vault** | `saveChatAttachmentToLes` → encrypted `commit_object` | **Yes** |
| **Secure Upload** | Same LES commit from local files | **Yes** |
| Lightbox **Export decrypted copy** | `downloadAttachmentToUserPath` / save dialog | Filesystem only |

Empty vault after Segment F is **expected** if nobody used Save to Vault / Secure Upload. Empty-state copy overclaims “automatically.”

## Gap vs demo ask

User wants: save **any** Obscur file to **Vault (encrypted)** *or* a **user-chosen local directory**.

| Surface today | Save to Vault | Download to folder |
|---------------|---------------|--------------------|
| Lightbox (images/video) | Yes | Yes |
| Attachment context menu (all kinds) | Yes | **Missing** |
| Audio / file bubbles | Context menu vault only | **Missing** |

## Claim

Not a broken LES encrypt path — catalog is empty by policy until explicit ingest. Fix honesty copy + expose download destination choice on the chat attachment menu.
