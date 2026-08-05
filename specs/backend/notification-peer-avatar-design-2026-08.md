# Design — System notification peer avatar

**Date (UTC):** 2026-08-04  
**Status:** Pass (L1) · maintainer desktop verify pending  
**Owner:** `notification-peer-icon.ts` · `notification-presentation.ts` · `commands/notification.rs`

---

```text
NEXT ATOMIC STEP:     System notification peer avatar (identify sender)
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION · groups/**
CANONICAL OWNER:      desktop-notification-handler → show_notification (image_path)
PROOF BEFORE DONE:    L1 notification-presentation + notification-peer-icon tests
OUT OF SCOPE:         Soft L3 · AUTH-SESSION · groups/** feature work · public Nostr SLA
```

## Problem

1. Handler already sets `iconUrl` from `senderProfile?.picture` / group avatar, but Windows Tauri `show_notification` **does not accept or apply `icon`**.
2. Windows `notify_rust` needs **`image_path` to a local file**, not a remote URL or XDG icon name.
3. Content-kind SVG data-URIs are not suitable as Windows toast images (PNG/JPEG expected).

## Contract

1. **Resolve** peer/group avatar to an absolute `https://` URL only (`resolveNotificationPeerIconUrl`). Relative/blob/data URLs are not OS-toast avatars.
2. **Prefer** that URL over content-kind SVG in `buildMessageNotificationPresentation` / call presentation (emoji kind glyphs stay in title/body).
3. **Native show:** `show_notification` accepts `icon: Option<String>`:
   - `https://` → short timeout download → cache under `app_data_dir/notification-icons/` → `image_path` (Windows) or plugin `.icon(path)` (other).
   - Missing/failed download → toast without custom image (emoji still identifies kind).
4. **Calls:** pass peer picture when known.
5. **Do not** claim OS avatar without maintainer desktop verify (L3).

## Proof

| Layer | Command / check |
|-------|-----------------|
| L1 | `pnpm -C apps/pwa exec vitest run app/features/notifications/utils/notification-presentation.test.ts app/features/notifications/utils/notification-peer-icon.test.ts` |
| L2 | `cargo check -p obscur_desktop_lib` (desktop crate) when Rust changes |
| L3 | Maintainer: background DM toast shows peer avatar when kind-0 picture is `https://` |

## Mental simulation

Peer with Nostr picture sends DM while Obscur is backgrounded → discovery cache has `picture` → presentation `icon` is that URL → Rust caches bytes → Windows toast shows face beside title → content emoji still prefixes title.
