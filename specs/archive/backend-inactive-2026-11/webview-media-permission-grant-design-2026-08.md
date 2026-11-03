# Design — Grant WebView2 mic/camera + honest recovery

**Date (UTC):** 2026-08-21  
**Investigation:** [webview-media-permission-denied-investigation-2026-08.md](./webview-media-permission-denied-investigation-2026-08.md)

---

```text
CANONICAL OWNER: desktop webview_media_permissions · MediaDeviceConsentDialog
PROOF: L3 voice note on Windows after rebuild; Block→recovery opens Settings
```

---

## Native (Windows)

On each `WebviewWindow` (main + profile windows), after build:

1. `add_PermissionRequested` → for `MICROPHONE` and `CAMERA`, `SetState(ALLOW)`.
2. Best-effort `ICoreWebView2Profile4::SetPermissionState(ALLOW)` for origins:
   - `http://tauri.localhost/`
   - `https://tauri.localhost/`
   - `tauri://localhost/` (if used)

Helper: `install_webview_media_permissions(window)`.

No auto-prompt UI in Rust — frontend still calls `getUserMedia`; WebView2 no longer sticks DENY without a path to recover.

## Frontend recovery

When `permission_denied` after getUserMedia:

- Opaque dialog.
- Primary: **Try again** (retry stream) — works once WebView/OS allow.
- Secondary: **Open microphone settings** → `ms-settings:privacy-microphone` (shell open).
- Copy: explain Obscur cannot flip Windows Privacy; only WebView grant is app-owned.

Camera QR path benefits from the same native Allow.

## Proof

| Layer | Action |
|-------|--------|
| Compile | `pnpm desktop:build:exe` |
| L3 | Mic → record voice note; if Windows Privacy off → Settings link visible |
