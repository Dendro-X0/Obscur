# Investigation — Voice call OS notification layout / actions

**Date (UTC):** 2026-08-04  
**Status:** Investigation complete · design follows  
**Owner:** `notification-presentation.ts` · `commands/notification.rs` · `desktop-notification-handler.tsx`

---

```text
HANDOFF ATOMIC STEP: DM send Phase-1 skip (user pivot: voice call OS notification)
PAUSED / CANCELLED:   Dev Lab · COM-RUN-* · O-2/O-4 · RIW-8 · AUTH-SESSION · groups/**
CANONICAL OWNER:      notification-presentation · show_notification (Windows toast)
PROOF BEFORE DONE:    L1 presentation + handler tests · L2 cargo check · L3 Windows toast
OUT OF SCOPE:         Soft L3 Docker · public Nostr SLA · AUTH-SESSION · groups/** · video
```

## Symptoms (maintainer screenshots)

1. Incoming voice toast shows peer avatar as a **large rectangular inline image** (image-preview style), not a circular face beside the name.
2. Title and body each prefix a **phone emoji** → two identical icons.
3. Body copy says “Open chat in Obscur to respond” with **no Accept / Reject** buttons.
4. In-app call dock already has Accept / End; OS toast does not.

## Evidence / owners

| Layer | Finding |
|-------|---------|
| Presentation | `buildIncomingCallNotificationPresentation` puts `📞` in **both** `title` and `body`. |
| Avatar path | Peer `https://` picture → Tauri `icon` → Rust `resolve_notification_image_path` → `notify_rust::Notification::image_path`. |
| Windows mapping | `notify-rust` `windows.rs` maps `path_to_image` to winrt `Toast::image(...)` (inline / hero-style below text), **not** `Toast::icon(..., IconCrop::Circular)` (`appLogoOverride`). |
| Actions | TS passes `actions: [{ open_chat }]` only; Rust param is `_actions` and **ignored**. |
| Action bridge | Frontend already listens for `desktop://incoming-call-action` and relays `accept` / `decline` / `open_chat` (tray / popup path). |
| Prior design | `notification-peer-avatar-design-2026-08.md` intended “face beside title” but chose `image_path`, which Windows renders as large preview. |

## Root cause

1. **Wrong Windows image placement** for peer avatars (inline `image` vs circular `appLogoOverride`).
2. **Duplicate content-kind emoji** in call title + body.
3. **Actions not applied** on the native Windows toast path; call Accept/Reject never sent as buttons.

## Mental simulation (desired)

Background/foreground toast for ringing peer → circular avatar left of **username** → preview line below (“Incoming voice call”) → **Accept** / **Reject** buttons → Accept emits same `desktop://incoming-call-action` as tray → chat surface joins; Reject declines. Single visual icon (avatar or one glyph), not two phone emojis.
