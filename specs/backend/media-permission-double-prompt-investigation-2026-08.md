# Investigation — Media permission double prompt (Tauri WebView)

**Date (UTC):** 2026-08-21  
**Status:** Findings → design  
**Evidence:** Maintainer screenshots — in-app `MediaDeviceConsentDialog` + WebView `http://tauri.localhost` “Use your microphones” on first voice use

---

```text
HANDOFF ATOMIC STEP: none — greenfield / demo Segment H pivot
PAUSED / CANCELLED:  dialect research · Tor Verified gate (not this band)
CANONICAL OWNER:     media-device-access.ts · VoiceRecorder · ensureVoiceLocalStream
PROOF BEFORE DONE:   L1 media-device-access · L3 first mic → one WebView prompt only
OUT OF SCOPE:        Shipping video calls · removing WebView/OS permission UI
```

---

## Symptom

First voice-note (or voice-call) tap shows **two** confirms:

1. In-app **Device access / Enable microphone**
2. WebView **tauri.localhost wants to Use your microphones**

Maintainer wants **one** permission decision for media (mic now; camera later when product supports it).

## Root cause

Prior single-step policy (`shouldRequestMediaPermissionDirectly`):

| `permissions.query` | Intended UX |
|---------------------|-------------|
| `prompt` / `unknown` / `granted` | `getUserMedia` immediately (OS/WebView only) |
| `denied` | In-app recovery dialog first |

On **Tauri WebView2**, `navigator.permissions.query({ name: "microphone" })` commonly returns **`denied` before any grant** (or otherwise mis-reports). Callers then open the in-app dialog **without** calling `getUserMedia`. User taps **Allow** → `getUserMedia` → real WebView prompt → **double confirm**.

WebView/OS prompt cannot be removed or merged with a custom dialog. Camera and microphone remain separate Chromium permission names; a future video feature can request both in **one** `getUserMedia` call, but voice notes must not light the camera today.

## Fix direction

See [media-permission-single-prompt-design-2026-08.md](./media-permission-single-prompt-design-2026-08.md).
