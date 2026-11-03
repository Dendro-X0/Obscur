# Design — Voice call OS notification (circular avatar + Accept/Reject)

**Date (UTC):** 2026-08-04  
**Status:** Ready to implement  
**Owner:** `notification-presentation.ts` · `commands/notification.rs` · `desktop-notification-handler.tsx`  
**Prior:** [voice-call-os-notification-investigation-2026-08.md](./voice-call-os-notification-investigation-2026-08.md) · supersedes Windows `image_path` choice in peer-avatar design for avatar placement

---

```text
HANDOFF ATOMIC STEP: DM send Phase-1 skip (user pivot: voice call OS notification)
PAUSED / CANCELLED:   Dev Lab · COM-RUN-* · O-2/O-4 · RIW-8 · AUTH-SESSION · groups/**
CANONICAL OWNER:      notification-presentation · show_notification (Windows)
PROOF BEFORE DONE:    L1 presentation + desktop-notification-handler · L2 cargo check · L3 toast
OUT OF SCOPE:         Soft L3 Docker · AUTH-SESSION · groups/** · video · changing DM emoji policy beyond call
```

## Contract

### 1. Call presentation (TS)

`buildIncomingCallNotificationPresentation`:

| Field | Value |
|-------|--------|
| `title` | Caller display name only (no emoji) |
| `body` | Single preview line: `Incoming voice call` (no emoji, no “open chat to respond”) |
| `icon` | Peer `https://` avatar when known; else call content-kind SVG (web) / omitted on Windows when unresolved |
| `contentKind` | `call` |

Rationale: Windows circular `appLogoOverride` is the single icon beside the username; duplicate 📞 glyphs are removed.

### 2. Handler actions (TS)

Incoming-call `showNotification` actions:

- `{ action: "accept", title: "Accept" }`
- `{ action: "decline", title: "Reject" }`

Keep `data.overlayAction: "open_chat"` and body-click / default activation → `open_chat` (via Rust emit when Tauri). Prefer existing `desktop://incoming-call-action` bridge (same as tray).

### 3. Windows native toast (Rust)

For `target_os = "windows"`, **do not** use `notify_rust` `image_path` (maps to inline `Toast::image`).

Use `tauri-winrt-notification` (`Toast`) directly:

1. `title(summary)` + `text1(body)` (preview under name).
2. Cached local avatar → `icon(path, IconCrop::Circular, …)` (`placement="appLogoOverride"`).
3. Apply `actions` as `add_button(label, action_id)`.
4. When actions include `accept` + `decline`: `scenario(IncomingCall)` + long duration when `require_interaction`.
5. `on_activated`:
   - `accept` / `decline` / `open_chat` → `emit_tray_call_action` + focus main window
   - default (`None`) → `open_chat` (or `data.overlayAction` when present) + focus
6. Non-Windows: keep plugin builder; map `icon` path as today; actions best-effort if plugin supports (no new claim).

### 4. Message / other toasts

Same circular `appLogoOverride` for peer avatars on Windows (fixes prior “face beside title” intent). No change to DM title/body emoji policy in this slice.

### 5. Subtraction

- Remove dual emoji from call presentation.
- Stop Windows avatar → `image_path` / inline hero for peer icons.
- Do not add a second accept path; reuse tray action event.

## Proof

| Layer | Command / check |
|-------|-----------------|
| L1 | `pnpm -C apps/pwa exec vitest run app/features/notifications/utils/notification-presentation.test.ts app/components/desktop-notification-handler.test.tsx` |
| L2 | `cargo check -p obscur_desktop_lib` (from `apps/desktop/src-tauri`) |
| L3 | Maintainer: rebuild desktop shell → incoming voice toast shows **circular** avatar left of name, preview under, **Accept/Reject**; Accept joins / Reject declines; only one icon |

## Mental simulation

Peer rings while Obscur visible or toast path active → toast: [circular face] **Tester1** / Incoming voice call / [Accept][Reject] → Accept → `desktop://incoming-call-action` `{action:"accept"}` → handler `relayCallActionToChatSurface("accept")` → join. No large lightning hero image.
