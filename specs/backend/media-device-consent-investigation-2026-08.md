# Investigation — Media device enable dialog (mic / camera)

**Date (UTC):** 2026-08-04  
**Status:** Findings → design  
**Evidence:** Maintainer screenshot — toast “Microphone access denied” over composer mic control · ver. 1.9.14

---

```text
NEXT ATOMIC STEP:     (user pivot) Media device consent dialog
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION · groups/**
CANONICAL OWNER:      media-device-access + MediaDeviceConsentDialog → VoiceRecorder / voice call
PROOF BEFORE DONE:    L1 device-access + dialog contract · L3 desktop mic consent → record
OUT OF SCOPE:         Video conferencing · Soft L3 · AUTH-SESSION · groups/**
```

---

## Symptom

Tapping the composer microphone shows a red toast **“Microphone access denied”** with no in-app consent UI, no connected-device list, and no guidance when OS/WebView permission is missing or denied.

## Current owners

| Path | Behavior |
|------|----------|
| `VoiceRecorder.startRecording` | Immediate `getUserMedia({ audio: true })`; any failure → single toast `microphoneAccessDenied` |
| `main-shell.ensureVoiceLocalStream` | Same pattern; slightly better reason codes + `enumerateDevices` **only in failure logs** |
| QR camera (`qr-scanner-utils`) | Direct `getUserMedia({ video: true })`; string errors, no shared consent dialog |

## Findings

1. **No consent owner** — OS/WebView prompt is the only “ask”; if denied/blocked, UX collapses to toast.
2. **Device detection exists only as diagnostics** on voice-call failure — never shown to the user.
3. **Product note:** no video conferencing. Camera remains for **QR / invite scan** only; mic for **voice notes + realtime voice**.
4. **Not PAUSED** — messaging/composer UX; maintainer pivot from chat-image-restart slice.

## Desired product behavior

1. Before first capture of mic (or camera for QR), show an **in-app dialog**: enable device? purpose copy.
2. Dialog **lists detected inputs** (`enumerateDevices`); refresh after grant so labels appear.
3. User confirms → `getUserMedia` (triggers OS prompt if needed) → proceed; cancel → no toast spam.
4. Denied/not-found → dialog inline error with specific copy (not only generic toast).

## Design pointer

See `media-device-consent-design-2026-08.md` + frontend notes therein.
