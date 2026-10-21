# Investigation — WebView mic grant not sticky (Obscur in-app Allow useless)

**Date (UTC):** 2026-08-21  
**Status:** Findings → design  
**Evidence:** Maintainer screenshot — in-app Device Access shows “Permission was denied…” after system `tauri.localhost` prompt; Allow does not obtain mic

---

```text
HANDOFF ATOMIC STEP: none — greenfield / Segment H media pivot
PAUSED / CANCELLED:  dialect research · Tor Verified (not this band)
CANONICAL OWNER:     desktop WebView2 permission install · media-device-access · MediaDeviceConsentDialog
PROOF BEFORE DONE:   L1 media-device-access · L3 voice note records without permanent deny
OUT OF SCOPE:        Shipping video calls · changing Windows Privacy policy outside app control
```

---

## Symptom

1. First voice use shows WebView system prompt (`http://tauri.localhost` wants microphone).
2. Later attempts show Obscur **Device access** recovery with red “Permission was denied…”.
3. In-app **Allow** cannot grant OS/WebView permission — only retries `getUserMedia`, which fails again.
4. Maintainer: OS will not grant the app mic/camera configuration through Obscur popups.

## Root cause

| Layer | Behavior |
|-------|----------|
| **WebView2** | Mic/camera require `PermissionRequested` handling or persisted profile permission. Wry only auto-allows **clipboard** today. Block (or a failed grant) persists as DENY for `tauri.localhost` → no re-prompt. |
| **Obscur UI** | Recovery dialog’s **Allow** is not an OS grant API — it only calls `getUserMedia` again. |
| **Windows Privacy** | Separate toggle (“Microphone access for desktop apps”). App cannot force this; must open Settings. |

## Fix direction

See [webview-media-permission-grant-design-2026-08.md](./webview-media-permission-grant-design-2026-08.md).
