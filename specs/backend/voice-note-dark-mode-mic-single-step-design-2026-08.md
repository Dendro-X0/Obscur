# Design — Voice note dark contrast + single-step mic grant

**Date (UTC):** 2026-08-04  
**Investigation:** [voice-note-dark-mode-mic-single-step-investigation-2026-08.md](./voice-note-dark-mode-mic-single-step-investigation-2026-08.md)

---

## A. Outgoing voice note contrast (dark)

Match bubble theme tokens:

| Element | Light outgoing (purple bubble) | Dark outgoing (zinc-100 bubble) |
|---------|--------------------------------|----------------------------------|
| Play | white/18 on purple | purple→indigo gradient (same as incoming) |
| Waveform | white/35–90 | purple-400/45 · purple-600 played |
| Duration | white/90 | zinc-800 |

Owner files: `voice-note-player.tsx`, `voice-note-player-body.tsx`, `voice-playback-waveform.tsx`.

## B. Mic permission — one user decision for first grant

**Invariant:** Browser/WebView security owns the first `getUserMedia` prompt. App cannot merge OS UI.

**Policy:**

```ts
shouldRequestMediaPermissionDirectly(permission):
  granted | prompt | unknown → true  // call getUserMedia immediately
  denied → false                     // recovery dialog only
```

| State | UX |
|-------|-----|
| First use (`prompt`/`unknown`) | Mic tap → OS prompt only |
| Already `granted` | Direct stream (no dialog) |
| `denied` or OS deny | In-app recovery dialog (settings guidance + Allow retry) |
| not_found / unavailable | Toast (voice note) or null (voice call); no extra confirm |

Wire: `VoiceRecorder.requestConsentOrStart`, `ensureVoiceLocalStream`.

Keep `shouldSkipMediaConsentDialog` for granted+devices (legacy callers / tests).

## Proof

- **L1:** `media-device-access` — `shouldRequestMediaPermissionDirectly` cases  
- **L3:** Dark mode outgoing voice note readable; first mic → one OS dialog only
