# Investigation — Voice note dark mode + mic double prompt

**Date (UTC):** 2026-08-04  
**Status:** Closed (design + implement same thread)

---

```text
HANDOFF ATOMIC STEP: Voice call invite send honesty Pass (L1) — maintainer desktop verify
USER PIVOT:          Voice note invisible in dark mode; mic requires two confirms
PAUSED / CANCELLED:  COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION · groups/**
CANONICAL OWNER:     VoiceNotePlayer* · media-device-access · VoiceRecorder · ensureVoiceLocalStream
PROOF BEFORE DONE:   L1 media-device-access · L3 dark-mode voice note + single OS mic prompt
OUT OF SCOPE:        Soft L3 · AUTH-SESSION · groups/** · video conferencing · removing OS permission UI
```

---

## Evidence

1. **Outgoing voice note (dark mode):** Bubble uses `dark:from-zinc-100 dark:to-zinc-200 dark:text-zinc-900` (light surface). Player chrome used `text-white` / `bg-white/*` waveform → near-zero contrast.
2. **Incoming (light mode):** Purple play + lavender waveform on white — fine.
3. **Mic UX:** In-app `MediaDeviceConsentDialog` then WebView `getUserMedia` prompt at `http://127.0.0.1:1430`. OS/WebView prompt cannot be removed.

## Root cause

| Issue | Cause |
|-------|--------|
| Invisible controls | Outgoing dark bubble flipped to light; voice player still assumed purple/dark bubble |
| Double confirm | Prior design showed in-app dialog for `prompt`/`unknown` before OS grant |

## Fix direction

See [voice-note-dark-mode-mic-single-step-design-2026-08.md](./voice-note-dark-mode-mic-single-step-design-2026-08.md).
